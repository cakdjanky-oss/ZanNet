const CF = "https://speed.cloudflare.com";

export type Phase = "idle" | "ping" | "down" | "up" | "done" | "error";

export type SpeedResult = {
  downMbps: number | null;
  upMbps: number | null;
  pingMs: number | null;
  jitterMs: number | null;
};

function mbps(bytes: number, ms: number) {
  if (ms <= 0) return 0;
  return (bytes * 8) / (ms / 1000) / 1_000_000;
}

async function pingOnce(): Promise<number> {
  const t0 = performance.now();
  await fetch(`${CF}/__down?bytes=0`, { cache: "no-store" });
  return performance.now() - t0;
}

export async function measurePing(samples = 6): Promise<{ ping: number; jitter: number }> {
  const times: number[] = [];
  await pingOnce(); // warm
  for (let i = 0; i < samples; i++) {
    times.push(await pingOnce());
  }
  const ping = [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)];
  let jitter = 0;
  for (let i = 1; i < times.length; i++) jitter += Math.abs(times[i] - times[i - 1]);
  jitter = times.length > 1 ? jitter / (times.length - 1) : 0;
  return { ping, jitter };
}

export async function measureDownload(
  onTick?: (mbpsNow: number) => void
): Promise<number> {
  const sizes = [250_000, 1_000_000, 5_000_000, 15_000_000];
  const scores: number[] = [];
  for (const size of sizes) {
    const t0 = performance.now();
    const res = await fetch(`${CF}/__down?bytes=${size}`, { cache: "no-store" });
    const buf = await res.arrayBuffer();
    const dt = performance.now() - t0;
    const rate = mbps(buf.byteLength, dt);
    scores.push(rate);
    onTick?.(rate);
    if (dt > 4500) break;
  }
  scores.sort((a, b) => a - b);
  return scores[Math.floor(scores.length * 0.7)] ?? scores[scores.length - 1] ?? 0;
}

export async function measureUpload(
  onTick?: (mbpsNow: number) => void
): Promise<number> {
  const sizes = [250_000, 1_000_000, 4_000_000];
  const scores: number[] = [];
  for (const size of sizes) {
    const payload = new Uint8Array(size);
    const t0 = performance.now();
    await fetch(`${CF}/__up`, {
      method: "POST",
      cache: "no-store",
      body: payload
    });
    const dt = performance.now() - t0;
    const rate = mbps(size, dt);
    scores.push(rate);
    onTick?.(rate);
    if (dt > 4500) break;
  }
  scores.sort((a, b) => a - b);
  return scores[Math.floor(scores.length * 0.7)] ?? scores[scores.length - 1] ?? 0;
}

export type LinkIntel = {
  ip: string;
  city: string;
  region: string;
  country: string;
  org: string;
  asn: string;
};

export async function fetchIntel(): Promise<LinkIntel> {
  const empty: LinkIntel = {
    ip: "—",
    city: "—",
    region: "—",
    country: "—",
    org: "—",
    asn: "—"
  };
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!res.ok) return empty;
    const j = await res.json();
    return {
      ip: j.ip || "—",
      city: j.city || "—",
      region: j.region || j.region_code || "—",
      country: j.country_name || j.country || "—",
      org: j.org || "—",
      asn: j.asn || "—"
    };
  } catch {
    return empty;
  }
}

export function connectionHint(): { type: string; downlink: string } {
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { connection?: { effectiveType?: string; type?: string; downlink?: number } }) : null;
  const c = nav?.connection;
  const type = (c?.type || c?.effectiveType || "unknown").toLowerCase();
  const downlink = typeof c?.downlink === "number" ? `${c.downlink} Mbps est` : "n/a";
  return { type, downlink };
}
