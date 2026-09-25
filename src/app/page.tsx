"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const CF_DOWN = "https://speed.cloudflare.com/__down?bytes=";
const CF_UP = "https://speed.cloudflare.com/__up";

type Phase = "idle" | "ping" | "download" | "upload" | "done" | "error";

type NetInfo = {
  type: string;
  effectiveType: string;
  downlink: number | null;
  rtt: number | null;
  saveData: boolean;
};

function formatMbps(n: number | null) {
  if (n == null) return "—";
  return n.toFixed(2);
}

function connLabel(info: NetInfo | null) {
  if (!info) return "Unknown";
  const t = (info.type || "").toLowerCase();
  if (t === "wifi") return "Wi‑Fi";
  if (t === "cellular") return "Cellular";
  if (t === "ethernet") return "Ethernet";
  if (t === "wimax") return "WiMAX";
  if (info.effectiveType) return info.effectiveType.toUpperCase();
  return "Multi";
}

async function measurePing(samples = 6) {
  const times: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    await fetch(`${CF_DOWN}1000&tid=${Math.random()}`, { cache: "no-store" });
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const core = times.slice(1, -1).length ? times.slice(1, -1) : times;
  const avg = core.reduce((a, b) => a + b, 0) / core.length;
  return { idle: Math.round(times[0]), loaded: Math.round(avg) };
}

async function measureDownload(onTick: (mbps: number) => void) {
  const bytes = 20_000_000;
  const t0 = performance.now();
  const res = await fetch(`${CF_DOWN}${bytes}&tid=${Math.random()}`, {
    cache: "no-store",
  });
  if (!res.body) throw new Error("no download stream");
  const reader = res.body.getReader();
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value?.byteLength ?? 0;
    const elapsed = (performance.now() - t0) / 1000;
    if (elapsed > 0.12) onTick((received * 8) / elapsed / 1_000_000);
  }
  const elapsed = (performance.now() - t0) / 1000;
  return (received * 8) / elapsed / 1_000_000;
}

async function measureUpload(onTick: (mbps: number) => void) {
  const size = 8_000_000;
  const payload = new Uint8Array(size);
  crypto.getRandomValues(payload.subarray(0, Math.min(65536, size)));
  const t0 = performance.now();
  const res = await fetch(`${CF_UP}?tid=${Math.random()}`, {
    method: "POST",
    body: payload,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upload HTTP ${res.status}`);
  const elapsed = (performance.now() - t0) / 1000;
  const mbps = (size * 8) / elapsed / 1_000_000;
  onTick(mbps);
  return mbps;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [download, setDownload] = useState<number | null>(null);
  const [upload, setUpload] = useState<number | null>(null);
  const [pingIdle, setPingIdle] = useState<number | null>(null);
  const [pingLoaded, setPingLoaded] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [resultId, setResultId] = useState(() =>
    String(Date.now() + Math.floor(Math.random() * 1e6))
  );
  const [isp, setIsp] = useState("resolving…");
  const [ip, setIp] = useState("");
  const [city, setCity] = useState("");
  const [net, setNet] = useState<NetInfo | null>(null);
  const [ssidHint, setSsidHint] = useState("");

  useEffect(() => {
    const n = (navigator as Navigator & { connection?: any }).connection;
    const read = () => {
      if (!n) {
        setNet({
          type: "unknown",
          effectiveType: "",
          downlink: null,
          rtt: null,
          saveData: false,
        });
        return;
      }
      setNet({
        type: n.type || n.effectiveType || "unknown",
        effectiveType: n.effectiveType || "",
        downlink: typeof n.downlink === "number" ? n.downlink : null,
        rtt: typeof n.rtt === "number" ? n.rtt : null,
        saveData: !!n.saveData,
      });
    };
    read();
    n?.addEventListener?.("change", read);
    return () => n?.removeEventListener?.("change", read);
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await fetch("https://ipapi.co/json/");
        const j = await r.json();
        if (dead) return;
        setIsp(j.org || j.asn || "ISP unknown");
        setIp(j.ip || "");
        setCity([j.city, j.region, j.country_name].filter(Boolean).join(" · "));
      } catch {
        if (!dead) setIsp("ISP lookup blocked");
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  const run = useCallback(async () => {
    try {
      setResultId(String(Date.now() + Math.floor(Math.random() * 1e6)));
      setDownload(null);
      setUpload(null);
      setPingIdle(null);
      setPingLoaded(null);

      setPhase("ping");
      setStatus("probing latency ke Cloudflare edge…");
      const p = await measurePing();
      setPingIdle(p.idle);
      setPingLoaded(p.loaded);

      setPhase("download");
      setStatus("download stream 20MB…");
      const dl = await measureDownload((live) => setDownload(live));
      setDownload(dl);

      setPhase("upload");
      setStatus("upload 8MB payload…");
      const ul = await measureUpload((live) => setUpload(live));
      setUpload(ul);

      setPhase("done");
      setStatus("signal locked");
    } catch (e) {
      setPhase("error");
      setStatus(e instanceof Error ? e.message : "probe failed");
    }
  }, []);

  const wifiName = useMemo(() => {
    if (ssidHint.trim()) return ssidHint.trim();
    const t = (net?.type || "").toLowerCase();
    if (t === "wifi") return "SSID locked by browser";
    if (t === "cellular") return "bukan Wi‑Fi — cellular radio";
    if (t === "ethernet") return "kabel / tether";
    return "SSID tidak terekspos ke web";
  }, [net, ssidHint]);

  const busy = phase === "ping" || phase === "download" || phase === "upload";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" />
          ZANNET
        </div>
        <div className="theme-toggle" aria-hidden />
      </header>
      <div className="rainbow" />

      <div className="meta">
        Result ID: <b>{resultId}</b>
      </div>

      <section className="card">
        <div className="dl-label">
          <span className="arrow">↓</span>
          DOWNLOAD Mbps
        </div>
        <div className={`speed ${phase === "download" ? "live" : ""}`}>
          {formatMbps(download)}
        </div>

        <div className="submetrics">
          <div>
            <span className="mini-label">UPLOAD Mbps</span>
            <span className={phase === "upload" ? "live-num" : ""}>
              {formatMbps(upload)}
            </span>
          </div>
        </div>

        <div className="pings">
          <div>
            Ping ms <span className="dot-y">●</span>{" "}
            <span>{pingIdle ?? "—"}</span>
          </div>
          <div>
            <span className="dot-g">●</span> <span>{pingLoaded ?? "—"}</span>
          </div>
        </div>

        <button className="btn" onClick={run} disabled={busy}>
          {busy ? "Testing…" : phase === "idle" ? "Start Test" : "Test Again"}
        </button>
        <div className="status">{status}</div>
      </section>

      <p className="hint">
        Engine nembak Cloudflare edge (`speed.cloudflare.com`). Browser{" "}
        <b>tidak bisa baca SSID Wi‑Fi</b> — cuma tipe tautan + ISP dari public
        IP. Isi label manual kalau mau nama jaringan tampil di footer.
      </p>

      <div className="panel">
        <div className="intel">
          <div className="intel-k">LINK INTEL</div>
          <div className="intel-ip">{ip || "—"}</div>
          <div className="intel-geo">{city || "geo pending"}</div>
        </div>
      </div>

      <footer className="footer">
        <div className="row">
          <div className="ico">⇄</div>
          <div>
            Connections
            <small>
              {connLabel(net)}
              {net?.effectiveType ? ` · ${net.effectiveType}` : ""}
              {net?.downlink != null ? ` · est ${net.downlink} Mbps` : ""}
            </small>
          </div>
        </div>
        <div className="row">
          <div className="ico">◉</div>
          <div>
            {isp}
            <small>provider / ASN dari public IP — bukan SSID</small>
          </div>
        </div>
        <div className="row">
          <div className="ico">⌁</div>
          <div style={{ flex: 1 }}>
            Wi‑Fi name
            <small>{wifiName}</small>
            <input
              value={ssidHint}
              onChange={(e) => setSsidHint(e.target.value)}
              placeholder="label SSID manual (opsional)"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
