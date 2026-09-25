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
} from "@/lib/speed";

function fmt(n: number | null, digits = 2) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function Row({
  k,
  v,
  extra
}: {
  k: string;
  v: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "7ch 1fr auto",
        gap: 12,
        alignItems: "baseline",
        minHeight: 22,
        fontSize: 13,
        lineHeight: "22px"
      }}
    >
      <span style={{ color: "#7a7a84", letterSpacing: "0.04em" }}>{k}</span>
      <span className="num" style={{ color: "#e8e6de", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {v}
      </span>
      <span style={{ color: "#6b6b74", fontSize: 10 }}>{extra}</span>
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
  const [editing, setEditing] = useState(false);
  const [intel, setIntel] = useState<LinkIntel | null>(null);
  const [resultId, setResultId] = useState(() => Date.now().toString());
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const conn = useMemo(() => connectionHint(), []);

  useEffect(() => {
    fetchIntel().then(setIntel);
  }, []);

  useEffect(() => {
    if (!startedAt || phase === "idle" || phase === "done" || phase === "error") return;
    const id = window.setInterval(() => setElapsed((performance.now() - startedAt) / 1000), 80);
    return () => window.clearInterval(id);
  }, [startedAt, phase]);

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
  const ssidValue = ssid.trim() ? ssid.trim() : "— locked";

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        maxWidth: 520,
        margin: "0 auto",
        padding: "18px 16px 0"
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
              width: 14,
              height: 14,
              background: "linear-gradient(135deg,#4da3ff,#7cffb2)",
              display: "inline-block"
            }}
          />
          <span style={{ letterSpacing: "0.18em", fontSize: 13, fontWeight: 600 }}>ZANNET</span>
        </div>
        <div style={{ fontSize: 11, color: locked ? "#7cffb2" : "#6b6b74", letterSpacing: "0.08em" }}>
          {locked ? "LOCK ●" : phase === "idle" ? "READY" : phase === "error" ? "FAULT" : "PROBE"}
        </div>
      </header>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#6b6b74",
          padding: "10px 0 16px"
        }}
      >
        <span className="num">RESULT {resultId}</span>
        <span className="num">T+{elapsed.toFixed(1).padStart(5, "0")}</span>
      </div>

      <section
        style={{
          background: "#0c0c10",
          border: "1px solid #22222a",
          padding: "18px 16px 14px",
          flex: "0 0 auto"
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "7ch 1fr auto", gap: 12, alignItems: "end", marginBottom: 10 }}>
          <span style={{ color: "#7cffb2", fontSize: 11, letterSpacing: "0.08em" }}>DOWN</span>
          <span className="num" style={{ fontSize: 36, lineHeight: 1, letterSpacing: "-0.03em" }}>
            {fmt(down)}
          </span>
          <span style={{ color: "#6b6b74", fontSize: 11, paddingBottom: 4 }}>Mbps</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "7ch 1fr auto", gap: 12, alignItems: "end", marginBottom: 18 }}>
          <span style={{ color: "#c8ccd4", fontSize: 11, letterSpacing: "0.08em" }}>UP</span>
          <span className="num" style={{ fontSize: 28, lineHeight: 1, letterSpacing: "-0.03em" }}>
            {fmt(up)}
          </span>
          <span style={{ color: "#6b6b74", fontSize: 11, paddingBottom: 2 }}>Mbps</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Row k="RTT" v={ping === null ? "—" : `${fmt(ping, 0)} ms`} />
          <Row k="JITTER" v={jitter === null ? "—" : `${fmt(jitter, 0)} ms`} />
        </div>

        <div style={{ height: 1, background: "#22222a", margin: "4px 0 12px" }} />

        <Row k="IFACE" v={`${conn.type} · ${conn.downlink}`} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "7ch 1fr auto",
            gap: 12,
            alignItems: "center",
            minHeight: 22,
            fontSize: 13
          }}
        >
          <span style={{ color: "#7a7a84", letterSpacing: "0.04em" }}>SSID</span>
          {editing ? (
            <input
              autoFocus
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
              placeholder="nama wifi"
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #3a3a44",
                color: "#e8e6de",
                outline: "none",
                fontSize: 13,
                padding: "2px 0"
              }}
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              style={{
                background: "none",
                border: "none",
                color: "#e8e6de",
                textAlign: "left",
                cursor: "text",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {ssidValue}
            </button>
          )}
          <span style={{ color: "#6b6b74", fontSize: 10 }}>{ssid.trim() ? "manual" : "tap"}</span>
        </div>
        <Row k="EDGE" v="speed.cloudflare.com" />
        <Row k="PUB" v={intel?.ip ?? "…"} />
        <Row
          k="GEO"
          v={intel ? `${intel.city} · ${intel.region} · ${intel.country}` : "…"}
        />
        <Row k="ASN" v={intel ? `${intel.asn} ${intel.org}`.trim() : "…"} />

        <button
          onClick={run}
          disabled={phase === "ping" || phase === "down" || phase === "up"}
          style={{
            marginTop: 16,
            width: "100%",
            height: 42,
            background: "transparent",
            color: "#e8e6de",
            border: "1px solid #3d5cff",
            cursor: "pointer",
            letterSpacing: "0.08em",
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

      <div style={{ flex: 1 }} />

      <footer
        style={{
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
        <span style={{ color: "#6b6b74" }}>v1.0 · cf-edge · id</span>
      </footer>
    </main>
  );
}
