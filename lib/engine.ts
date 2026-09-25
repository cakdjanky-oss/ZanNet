// Mesin tes kecepatan ke edge Cloudflare (speed.cloudflare.com).
// - Latency: request 0 byte; kalau browser memberi Resource Timing lengkap,
//   dipakai (responseStart - requestStart) dikurangi waktu proses server.
// - Download/Upload: beberapa koneksi paralel dengan durasi tetap, pemanasan
//   25% pertama dibuang supaya hasil tidak jatuh karena TCP slow start.
// - Loaded latency: ping berjalan paralel selama download (indikasi bufferbloat).

const CF = "https://speed.cloudflare.com";

export type Phase = "idle" | "latency" | "download" | "upload" | "done" | "error";

export type LatencyResult = { rtt: number; jitter: number; min: number; samples: number[]; precise: boolean };
export type ThroughputResult = { mbps: number; bytes: number; series: number[] };

const now = () => performance.now();
const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

let protocol = "";
export const lastProtocol = () => protocol;

function serverMs(entry?: PerformanceResourceTiming, res?: Response) {
  const st = entry?.serverTiming?.find((s) => /cfRequestDuration/i.test(s.name));
  if (st) return st.duration;
  const h = res?.headers.get("server-timing");
  const m = h?.match(/cfRequestDuration;dur=([\d.]+)/i);
  return m ? parseFloat(m[1]) : 0;
}

async function pingOnce(signal?: AbortSignal): Promise<{ ms: number; precise: boolean }> {
  const url = `${CF}/__down?bytes=0&r=${Math.random().toString(36).slice(2)}`;
  const t0 = now();
  const res = await fetch(url, { cache: "no-store", signal });
  await res.arrayBuffer();
  const total = now() - t0;
  const entry = performance.getEntriesByName(url).pop() as PerformanceResourceTiming | undefined;
  if (entry?.nextHopProtocol) protocol = entry.nextHopProtocol;
  const srv = serverMs(entry, res);
  if (entry && entry.requestStart > 0 && entry.responseStart > entry.requestStart) {
    return { ms: Math.max(0, entry.responseStart - entry.requestStart - srv), precise: true };
  }
  return { ms: Math.max(0, total - srv), precise: false };
}

export async function measureLatency(n = 14, onSample?: (ms: number) => void): Promise<LatencyResult> {
  try { performance.setResourceTimingBufferSize(2000); } catch {}
  await pingOnce(); // pemanasan: DNS, TLS, koneksi
  const samples: number[] = [];
  let precise = true;
  for (let i = 0; i < n; i++) {
    const p = await pingOnce();
    precise = precise && p.precise;
    samples.push(p.ms);
    onSample?.(p.ms);
  }
  let j = 0;
  for (let i = 1; i < samples.length; i++) j += Math.abs(samples[i] - samples[i - 1]);
  return {
    rtt: median(samples),
    jitter: samples.length > 1 ? j / (samples.length - 1) : 0,
    min: Math.min(...samples),
    samples,
    precise
  };
}

type Tick = (mbpsNow: number, progress: number) => void;

function finalRate(marks: { t: number; b: number }[], warmupMs: number) {
  const last = marks[marks.length - 1];
  const w = marks.find((m) => m.t >= warmupMs) ?? marks[0];
  if (!last || last.t - w.t < 300) return last ? (last.b * 8) / (last.t * 1000) : 0;
  return ((last.b - w.b) * 8) / ((last.t - w.t) * 1000); // bit/ms -> Mbps
}

function liveRate(marks: { t: number; b: number }[]) {
  const last = marks[marks.length - 1];
  const prev = [...marks].reverse().find((m) => last.t - m.t >= 900) ?? marks[0];
  if (!last || last.t === prev.t) return 0;
  return ((last.b - prev.b) * 8) / ((last.t - prev.t) * 1000);
}

export async function measureDownload(
  onTick: Tick,
  opts: { durationMs?: number; streams?: number; onLoadedPing?: (ms: number) => void } = {}
): Promise<ThroughputResult & { loadedRtt: number }> {
  const duration = opts.durationMs ?? 9000;
  const streams = opts.streams ?? 4;
  const ctrl = new AbortController();
  let bytes = 0;
  let stop = false;
  const t0 = now();
  const marks = [{ t: 0, b: 0 }];
  const series: number[] = [];
  const loaded: number[] = [];

  const worker = async () => {
    let size = 1_000_000;
    while (!stop) {
      const res = await fetch(`${CF}/__down?bytes=${size}`, { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (res.body) {
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (stop) { reader.cancel().catch(() => {}); break; }
        }
      } else {
        bytes += (await res.arrayBuffer()).byteLength;
      }
      size = Math.min(size * 2, 25_000_000);
    }
  };

  const pinger = async () => {
    while (!stop) {
      await new Promise((r) => setTimeout(r, 350));
      if (stop) break;
      try {
        const p = await pingOnce(ctrl.signal);
        loaded.push(p.ms);
        opts.onLoadedPing?.(p.ms);
      } catch {}
    }
  };

  const ticker = setInterval(() => {
    const t = now() - t0;
    marks.push({ t, b: bytes });
    const r = liveRate(marks);
    series.push(r);
    onTick(r, Math.min(1, t / duration));
    if (t >= duration) stop = true;
  }, 200);

  const jobs = Array.from({ length: streams }, worker).map((p) => p.catch((e) => { if (!stop) throw e; }));
  const pj = pinger();
  try {
    await Promise.race([
      Promise.all(jobs),
      new Promise<void>((r) => { const i = setInterval(() => { if (stop) { clearInterval(i); r(); } }, 50); })
    ]);
  } finally {
    stop = true;
    clearInterval(ticker);
    ctrl.abort();
  }
  await pj.catch(() => {});
  if (bytes === 0) throw new Error("NO_DATA");
  return { mbps: finalRate(marks, duration * 0.25), bytes, series, loadedRtt: median(loaded) };
}

let payload: Uint8Array | null = null;
function getPayload() {
  if (payload) return payload;
  payload = new Uint8Array(8_000_000);
  for (let i = 0; i < payload.length; i += 65536) {
    crypto.getRandomValues(payload.subarray(i, Math.min(i + 65536, payload.length)));
  }
  return payload;
}

export async function measureUpload(
  onTick: Tick,
  opts: { durationMs?: number; streams?: number } = {}
): Promise<ThroughputResult> {
  const duration = opts.durationMs ?? 8000;
  const streams = opts.streams ?? 3;
  const ctrl = new AbortController();
  const data = getPayload();
  let bytes = 0;
  let stop = false;
  const t0 = now();
  const marks = [{ t: 0, b: 0 }];
  const series: number[] = [];

  const worker = async () => {
    let size = 250_000;
    while (!stop) {
      const ts = now();
      const res = await fetch(`${CF}/__up`, {
        method: "POST",
        cache: "no-store",
        body: new Blob([data.subarray(0, size) as unknown as BlobPart]),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.arrayBuffer();
      if (stop) break;
      bytes += size;
      if (now() - ts < 1500) size = Math.min(size * 2, data.length);
    }
  };

  const ticker = setInterval(() => {
    const t = now() - t0;
    marks.push({ t, b: bytes });
    const r = liveRate(marks);
    series.push(r);
    onTick(r, Math.min(1, t / duration));
    if (t >= duration) stop = true;
  }, 200);

  const jobs = Array.from({ length: streams }, worker).map((p) => p.catch((e) => { if (!stop) throw e; }));
  try {
    await Promise.race([
      Promise.all(jobs),
      new Promise<void>((r) => { const i = setInterval(() => { if (stop) { clearInterval(i); r(); } }, 50); })
    ]);
  } finally {
    stop = true;
    clearInterval(ticker);
    ctrl.abort();
  }
  if (bytes === 0) throw new Error("NO_DATA");
  return { mbps: finalRate(marks, duration * 0.25), bytes, series };
}

/** Nilai bufferbloat sederhana dari kenaikan ping saat jaringan dibebani. */
export function bloatGrade(idle: number, loaded: number): { grade: string; delta: number } {
  if (!isFinite(idle) || !isFinite(loaded)) return { grade: "—", delta: NaN };
  const d = Math.max(0, loaded - idle);
  const grade = d < 5 ? "A+" : d < 30 ? "A" : d < 60 ? "B" : d < 200 ? "C" : d < 400 ? "D" : "F";
  return { grade, delta: d };
}
