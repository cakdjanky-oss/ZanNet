"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  connectionHint,
  fetchIntel,
  measureDownload,
  measurePing,
  measureUpload,
  type LinkIntel,
  type Phase
} from "@/lib/engine";

function fmt(n: number | null, digits = 2) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function geoLine(intel: LinkIntel) {
  const parts = [intel.city, intel.region, intel.country].filter(Boolean);
  const uniq: string[] = [];
  for (const p of parts) {
    if (!uniq.some((u) => u.toLowerCase() === p.toLowerCase())) uniq.push(p);
  }
  return uniq.join(" · ") || "—";
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "7ch minmax(0,1fr)",
        gap: 12,
        alignItems: "baseline",
        minHeight: 26,
        fontSize: 13,
        lineHeight: "26px"
      }}
    >
      <span style={{ color: "#7a7a84", letterSpacing: "0.06em" }}>{k}</span>
      <span className="num" style={{ color: "#e8e6de", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {v}
      </span>
    </div>
  );
}

export default function Page() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [down, setDown] = useState<number | null>(null);
  const [up, setUp] = useState<number | null>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [jitter, setJitter] = useState<number | null>(null);
  const [ssid, setSsid] = useState("");
  const [intel, setIntel] = useState<LinkIntel | null>(null);
  const [resultId, setResultId] = useState(() => Date.now().toString());
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const conn = useMemo(() => connectionHint(), []);
  const busy = phase === "ping" || phase === "down" || phase === "up";

  useEffect(() => {
    const saved = window.localStorage.getItem("zannet.ssid");
    if (saved) setSsid(saved);
    fetchIntel().then(setIntel);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("zannet.ssid", ssid);
  }, [ssid]);

  useEffect(() => {
    if (!startedAt || !busy) return;
    const id = window.setInterval(() => setElapsed((performance.now() - startedAt) / 1000), 80);
    return () => window.clearInterval(id);
  }, [startedAt, busy]);

  const run = useCallback(async () => {
    setResultId(Date.now().toString());
    setDown(null);
    setUp(null);
    setPing(null);
    setJitter(null);
    setElapsed(0);
    const t0 = performance.now();
    setStartedAt(t0);
    try {
      setPhase("ping");
      const p = await measurePing();
      setPing(p.ping);
      setJitter(p.jitter);
      setPhase("down");
      const d = await measureDownload((live) => setDown(live));
      setDown(d);
      setPhase("up");
      const u = await measureUpload((live) => setUp(live));
      setUp(u);
      setElapsed((performance.now() - t0) / 1000);
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }, []);

  const locked = phase === "done";

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        maxWidth: 440,
        margin: "0 auto",
        padding: "16px 16px 0"
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 10,
          borderBottom: "1px solid #22222a"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 12,
              height: 12,
              background: "linear-gradient(135deg,#4da3ff,#7cffb2)",
              display: "inline-block"
            }}
          />
          <span style={{ letterSpacing: "0.2em", fontSize: 13, fontWeight: 600 }}>ZANNET</span>
        </div>
        <div style={{ fontSize: 11, color: locked ? "#7cffb2" : "#6b6b74", letterSpacing: "0.12em" }}>
          {locked ? "LOCK ●" : busy ? "PROBE" : phase === "error" ? "FAULT" : "READY"}
        </div>
      </header>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#6b6b74",
          padding: "10px 0 14px",
          letterSpacing: "0.04em"
        }}
      >
        <span className="num">RESULT {resultId}</span>
        <span className="num">T+{elapsed.toFixed(1)}</span>
      </div>

      <section
        style={{
          background: "#0c0c10",
          border: "1px solid #22222a",
          padding: "16px 14px 14px"
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "7ch minmax(0,1fr) auto", gap: 10, alignItems: "end", marginBottom: 8 }}>
          <span style={{ color: "#7cffb2", fontSize: 11, letterSpacing: "0.1em" }}>DOWN</span>
          <span className="num" style={{ fontSize: 34, lineHeight: 1, letterSpacing: "-0.03em" }}>
            {fmt(down)}
          </span>
          <span style={{ color: "#6b6b74", fontSize: 11, paddingBottom: 4 }}>Mbps</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "7ch minmax(0,1fr) auto", gap: 10, alignItems: "end", marginBottom: 14 }}>
          <span style={{ color: "#c8ccd4", fontSize: 11, letterSpacing: "0.1em" }}>UP</span>
          <span className="num" style={{ fontSize: 28, lineHeight: 1, letterSpacing: "-0.03em" }}>
            {fmt(up)}
          </span>
          <span style={{ color: "#6b6b74", fontSize: 11, paddingBottom: 3 }}>Mbps</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <Row k="RTT" v={ping === null ? "—" : `${fmt(ping, 0)} ms`} />
          <Row k="JITTER" v={jitter === null ? "—" : `${fmt(jitter, 0)} ms`} />
        </div>

        <div style={{ height: 1, background: "#22222a", margin: "0 0 12px" }} />

        <Row k="IFACE" v={`${conn.type} · ${conn.downlink}`} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "7ch minmax(0,1fr)",
            gap: 12,
            alignItems: "center",
            minHeight: 36,
            margin: "4px 0 6px"
          }}
        >
          <span style={{ color: "#7a7a84", letterSpacing: "0.06em", fontSize: 13 }}>SSID</span>
          <input
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            placeholder="nama Wi-Fi — isi manual"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            style={{
              width: "100%",
              height: 36,
              background: "#111116",
              border: "1px solid #2e2e36",
              color: ssid ? "#e8e6de" : "#6b6b74",
              outline: "none",
              fontSize: 13,
              padding: "0 10px"
            }}
          />
        </div>

        <Row k="EDGE" v="speed.cloudflare.com" />
        <Row k="PUB" v={intel?.ip ?? "…"} />
        <Row k="GEO" v={intel ? geoLine(intel) : "…"} />
        <Row k="ASN" v={intel ? [intel.asn, intel.org].filter((x) => x && x !== "—").join(" ") || "—" : "…"} />

        <button
          onClick={run}
          disabled={busy}
          style={{
            marginTop: 16,
            width: "100%",
            height: 44,
            background: busy ? "#111116" : "transparent",
            color: "#e8e6de",
            border: "1px solid #3d5cff",
            cursor: busy ? "wait" : "pointer",
            letterSpacing: "0.12em",
            fontSize: 12
          }}
        >
          {phase === "idle" && "START TEST"}
          {phase === "ping" && "PROBE RTT…"}
          {phase === "down" && "PULL DOWN…"}
          {phase === "up" && "PUSH UP…"}
          {phase === "done" && "TEST AGAIN"}
          {phase === "error" && "RETRY"}
        </button>
      </section>

      <footer
        style={{
          marginTop: "auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: 48,
          borderTop: "1px solid #22222a",
          fontSize: 11,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap"
        }}
      >
        <a href="https://zandev.id" style={{ color: "#c8ccd4", textDecoration: "none" }}>
          <span style={{ color: "#6b6b74" }}>built by </span>zandev.id
        </a>
        <span style={{ color: "#6b6b74" }}>v1.1 · cf-edge · id</span>
      </footer>
    </main>
  );
}
