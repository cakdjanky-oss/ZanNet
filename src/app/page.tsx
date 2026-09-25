"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bloatGrade, lastProtocol, measureDownload, measureLatency, measureUpload, type LatencyResult, type Phase } from "@/lib/engine";
import { coloName, distanceKm, fetchMeta, getGps, gpsAlreadyAllowed, maskIp, reverseGeocode, type Gps, type NetMeta, type Place } from "@/lib/net";
import { prayerTimes, WAJIB } from "@/lib/prayer";
import { tanggalLengkap, zonaWaktu } from "@/lib/calendar";
import { renderCard, shareCard, type CardData } from "@/lib/card";

const SURABAYA: [number, number] = [-7.2575, 112.7521];
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const f = (n: number | null | undefined, dg = 1) => (n == null || !isFinite(n) ? "—" : n >= 100 ? n.toFixed(0) : n.toFixed(dg));

function load<T>(k: string, def: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def; } catch { return def; }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

/* ---------- komponen kecil ---------- */

function Logo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#3cf0ff" /><stop offset="1" stopColor="#c38bff" /></linearGradient></defs>
      <path d="M3 9.5a13 13 0 0 1 18 0M6.2 13a8.5 8.5 0 0 1 11.6 0M9.4 16.4a4 4 0 0 1 5.2 0" stroke="url(#lg)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="19.6" r="1.6" fill="#3dffa2" />
    </svg>
  );
}

function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <svg className="spark" />;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${18 - (v / max) * 16}`).join(" ");
  return (
    <svg className="spark" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

const TICKS = [0, 1, 5, 10, 50, 100, 500, 1000];
const pos = (v: number) => Math.min(1, Math.log10(1 + Math.max(0, v)) / Math.log10(1001));

function Gauge({ value, color, progress, center }: { value: number; color: string; progress: number; center: React.ReactNode }) {
  const R = 84, C = 100, START = 150, SWEEP = 240;
  const pt = (a: number, r = R) => [C + r * Math.cos((a * Math.PI) / 180), C + r * Math.sin((a * Math.PI) / 180)];
  const arc = (from: number, to: number, r = R) => {
    const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r);
    return `M${x1} ${y1} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const end = START + SWEEP * pos(value);
  return (
    <div className="gauge">
      <svg viewBox="0 0 200 200" aria-hidden>
        <path d={arc(START, START + SWEEP)} stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" strokeLinecap="round" />
        {progress > 0 && <path d={arc(START, START + SWEEP * Math.min(0.999, progress), 97)} stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" />}
        {value > 0 && (
          <path d={arc(START, Math.max(START + 0.5, end))} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "d 0.25s" }} />
        )}
        {TICKS.map((t) => {
          const a = START + SWEEP * pos(t);
          const [x, y] = pt(a, 68);
          return <text key={t} x={x} y={y + 3} fontSize="8.5" fill="rgba(233,241,255,0.35)" textAnchor="middle" fontFamily="var(--mono)">{t >= 1000 ? "1G" : t}</text>;
        })}
      </svg>
      <div className="center">{center}</div>
    </div>
  );
}

/* ---------- halaman ---------- */

const PHASE_TEXT: Record<Phase, string> = {
  idle: "Siap", latency: "Mengukur ping", download: "Mengukur unduh", upload: "Mengukur unggah", done: "Selesai", error: "Gagal"
};

export default function Page() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lat, setLat] = useState<LatencyResult | null>(null);
  const [liveMs, setLiveMs] = useState<number | null>(null);
  const [down, setDown] = useState<number | null>(null);
  const [up, setUp] = useState<number | null>(null);
  const [live, setLive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dSeries, setDSeries] = useState<number[]>([]);
  const [uSeries, setUSeries] = useState<number[]>([]);
  const [loaded, setLoaded] = useState<number | null>(null);
  const [usedMB, setUsedMB] = useState(0);
  const [proto, setProto] = useState("");

  const [meta, setMeta] = useState<NetMeta | null>(null);
  const [gps, setGps] = useState<Gps | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [gpsState, setGpsState] = useState<"off" | "loading" | "on" | "denied" | "error">("off");

  const [ssid, setSsid] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [ssidFocus, setSsidFocus] = useState(false);

  const [now, setNow] = useState<Date | null>(null);
  const [hOfs, setHOfs] = useState(0);

  const [sheet, setSheet] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [showCoords, setShowCoords] = useState(false);
  const [fullIp, setFullIp] = useState(false);
  const [toast, setToast] = useState("");
  const toastT = useRef<number>();

  const busy = phase === "latency" || phase === "download" || phase === "upload";
  const say = (m: string) => {
    setToast(m);
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(""), 3200);
  };

  /* init */
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    setSsid(load("zannet.ssid", ""));
    setHistory(load("zannet.ssidHistory", []));
    setHOfs(load("zannet.hijriOffset", 0));
    fetchMeta().then(setMeta);
    gpsAlreadyAllowed().then((ok) => { if (ok) locate(true); });
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* isi SSID otomatis berdasar IP publik yang pernah dipakai */
  useEffect(() => {
    if (!meta?.ip) return;
    const map = load<Record<string, string>>("zannet.ipSsid", {});
    if (!ssid && map[meta.ip]) setSsid(map[meta.ip]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.ip]);

  const commitSsid = useCallback((v: string) => {
    const s = v.trim();
    save("zannet.ssid", s);
    if (!s) return;
    const h = [s, ...load<string[]>("zannet.ssidHistory", []).filter((x) => x !== s)].slice(0, 8);
    setHistory(h);
    save("zannet.ssidHistory", h);
    if (meta?.ip) save("zannet.ipSsid", { ...load<Record<string, string>>("zannet.ipSsid", {}), [meta.ip]: s });
  }, [meta?.ip]);

  const locate = useCallback(async (silent = false) => {
    setGpsState("loading");
    try {
      const g = await getGps();
      setGps(g);
      setGpsState("on");
      reverseGeocode(g.lat, g.lon).then(setPlace);
    } catch (e) {
      const m = (e as Error).message;
      setGpsState(m === "DENIED" ? "denied" : "error");
      if (!silent) say(m === "DENIED" ? "Izin lokasi ditolak. Aktifkan di pengaturan browser untuk memakai GPS." : "GPS belum dapat sinyal. Coba lagi di area terbuka.");
    }
  }, []);

  /* koordinat untuk jadwal shalat */
  const coord: { ll: [number, number]; src: string } = useMemo(() => {
    if (gps) return { ll: [gps.lat, gps.lon], src: place?.city || "GPS" };
    if (meta?.lat != null && meta?.lon != null) return { ll: [meta.lat, meta.lon], src: meta.city ? `${meta.city} (IP)` : "perkiraan IP" };
    return { ll: SURABAYA, src: "Surabaya (bawaan)" };
  }, [gps, meta, place?.city]);

  const today = useMemo(() => (now ? prayerTimes(now, coord.ll[0], coord.ll[1]) : []), [now?.toDateString(), coord.ll[0], coord.ll[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const maghrib = today.find((p) => p.name === "Magrib")?.at;
  const wajib = today.filter((p) => WAJIB.includes(p.name));
  const next = now ? wajib.find((p) => p.at > now) : undefined;
  const nextAt = next?.at ?? (now ? prayerTimes(new Date(now.getTime() + 86400000), coord.ll[0], coord.ll[1]).find((p) => p.name === "Subuh")?.at : undefined);
  const nextName = next?.name ?? "Subuh";
  const cd = now && nextAt ? Math.max(0, Math.floor((nextAt.getTime() - now.getTime()) / 1000)) : 0;

  const tgl = now ? tanggalLengkap(now, !!maghrib && now >= maghrib, hOfs) : null;

  const cycleOfs = () => {
    const v = hOfs >= 1 ? -1 : hOfs + 1;
    setHOfs(v);
    save("zannet.hijriOffset", v);
    say(v === 0 ? "Hijriah: mengikuti Umm al-Qura" : `Hijriah dikoreksi ${v > 0 ? "+" : ""}${v} hari`);
  };

  /* tes */
  const run = useCallback(async () => {
    commitSsid(ssid);
    setLat(null); setDown(null); setUp(null); setLoaded(null); setLive(0); setProgress(0);
    setDSeries([]); setUSeries([]); setUsedMB(0); setLiveMs(null);
    let used = 0;
    try {
      setPhase("latency");
      const l = await measureLatency(14, (ms) => setLiveMs(ms));
      setLat(l);
      setProto(lastProtocol());

      setPhase("download");
      setLive(0);
      const d = await measureDownload((r, p) => { setLive(r); setProgress(p); setDSeries((s) => [...s.slice(-60), r]); }, { onLoadedPing: () => {} });
      setDown(d.mbps);
      setLoaded(d.loadedRtt);
      used += d.bytes;
      setUsedMB(used / 1e6);

      setPhase("upload");
      setLive(0); setProgress(0);
      const u = await measureUpload((r, p) => { setLive(r); setProgress(p); setUSeries((s) => [...s.slice(-60), r]); });
      setUp(u.mbps);
      used += u.bytes;
      setUsedMB(used / 1e6);
      setProgress(0);
      setPhase("done");
      if (navigator.vibrate) navigator.vibrate(30);
    } catch (e) {
      setPhase("error");
      setProgress(0);
      say((e as Error).message === "NO_DATA" || (e as Error).name === "TypeError"
        ? "Server tes tidak terjangkau. Matikan adblock/VPN atau ganti jaringan, lalu coba lagi."
        : `Tes berhenti: ${(e as Error).message}`);
    }
  }, [ssid, commitSsid]);

  /* kartu bagikan */
  const cardData = useCallback((): CardData => {
    const bl = lat && loaded != null ? bloatGrade(lat.rtt, loaded) : null;
    return {
      down: f(down), up: f(up),
      ping: lat ? `${f(lat.rtt, 0)} ms` : "—",
      jitter: lat ? `${f(lat.jitter, 1)} ms` : "—",
      bloat: bl ? `${bl.grade} +${f(bl.delta, 0)}ms` : "—",
      ssid, spot: place?.spot || "", area: [place?.area, place?.city].filter(Boolean).join(", ") || (meta?.city ?? ""),
      coords: showCoords && gps ? `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} ±${gps.acc.toFixed(0)}m` : "",
      isp: [meta?.isp, meta?.asn].filter(Boolean).join(" · "),
      server: coloName(meta?.colo ?? ""),
      ip: fullIp ? meta?.ip ?? "—" : maskIp(meta?.ip ?? ""),
      masehi: tgl?.masehi ?? "", hariPasaran: tgl?.hariPasaran ?? "", jawa: tgl?.jawa ?? "", hijri: tgl?.hijri ?? "", arab: tgl?.arab ?? "",
      time: now ? `${hhmm(now)} ${zonaWaktu(now)}` : ""
    };
  }, [down, up, lat, loaded, ssid, place, meta, gps, showCoords, fullIp, tgl, now]);

  useEffect(() => {
    if (!sheet) return;
    let url = "";
    renderCard(cardData()).then((blob) => { url = URL.createObjectURL(blob); setPreview({ url, blob }); });
    return () => { if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, showCoords, fullIp]);

  const waText = () => {
    const c = cardData();
    return [
      `📶 ${c.ssid || "Wi-Fi"}${c.spot || c.area ? ` — 📍 ${[c.spot, c.area].filter(Boolean).join(", ")}` : ""}`,
      `↓ ${c.down} Mbps  ↑ ${c.up} Mbps  ⏱ ${c.ping}`,
      `${c.hariPasaran}, ${c.masehi.split(", ")[1] ?? ""} · ${c.hijri}`,
      c.coords ? `🗺 https://maps.google.com/?q=${gps?.lat},${gps?.lon}` : "",
      "via zan-net.vercel.app"
    ].filter(Boolean).join("\n");
  };

  const doShare = async () => {
    if (!preview) return;
    const r = await shareCard(preview.blob, waText());
    if (r === "downloaded") say("Gambar disimpan. Lampirkan dari galeri ke WhatsApp.");
    if (r === "shared") setSheet(false);
  };

  /* tampilan */
  const color = phase === "upload" ? "var(--up)" : phase === "latency" ? "var(--lat)" : "var(--down)";
  const gaugeVal = phase === "download" || phase === "upload" ? live : phase === "done" ? down ?? 0 : 0;
  const center =
    phase === "latency" ? (<><div className="val mono" style={{ color: "var(--lat)" }}>{f(liveMs, 0)}</div><div className="unit">ms</div><div className="ph" style={{ color: "var(--lat)" }}>ping</div></>)
    : phase === "download" || phase === "upload" ? (<><div className="val mono">{f(live)}</div><div className="unit">Mbps</div><div className="ph" style={{ color }}>{phase === "download" ? "↓ unduh" : "↑ unggah"}</div></>)
    : phase === "done" ? (<><div className="val mono">{f(down)}</div><div className="unit">Mbps unduh</div><div className="ph" style={{ color: "var(--ok)" }}>selesai</div></>)
    : (<><div className="val mono" style={{ color: "var(--faint)" }}>0.0</div><div className="unit">Mbps</div><div className="ph" style={{ color: "var(--sub)" }}>{phase === "error" ? "gagal" : "siap"}</div></>);

  const bl = lat && loaded != null ? bloatGrade(lat.rtt, loaded) : null;
  const gap = gps && meta?.lat != null && meta?.lon != null ? distanceKm([gps.lat, gps.lon], [meta.lat, meta.lon]) : null;
  const pillState = busy ? "busy" : phase === "error" ? "error" : "ok";

  return (
    <>
      <div className="bg" aria-hidden><div className="orb a" /><div className="orb b" /><div className="orb c" /></div>

      <main className="app">
        <header className="top">
          <div className="brand"><Logo />ZanNet
            <span className="pill" data-s={pillState} role="status"><span className="dot" />{PHASE_TEXT[phase]}</span>
          </div>
          <div className="clock mono">{now ? `${hhmm(now)}:${pad(now.getSeconds())}` : "--:--:--"}<small>{now ? zonaWaktu(now) : ""}</small></div>
        </header>

        <section className="glass dates" onClick={cycleOfs} title="Ketuk untuk koreksi tanggal Hijriah ±1 hari">
          <div className="masehi">{tgl?.masehi ?? "…"}</div>
          <div className="ofs">{hOfs ? `koreksi H ${hOfs > 0 ? "+" : ""}${hOfs}` : "Umm al-Qura"}</div>
          <div className="jawa">{tgl?.hariPasaran} <span>· {tgl?.jawa} · neptu {tgl?.neptu}</span></div>
          <div className="hrow"><span className="hijri">{tgl?.hijri}</span><span className="arab" lang="ar">{tgl?.arab}</span></div>
        </section>

        <section className="glass hero">
          <Gauge value={gaugeVal} color={color} progress={busy && phase !== "latency" ? progress : 0} center={center} />
          <div className="speeds">
            <div className="spd">
              <div className="k" style={{ color: "var(--down)" }}>↓ Unduh <em>{down != null ? "4 koneksi" : ""}</em></div>
              <div className="v mono">{phase === "download" ? f(live) : f(down)}<small>Mbps</small></div>
              <Spark data={dSeries} color="#3cf0ff" />
            </div>
            <div className="spd">
              <div className="k" style={{ color: "var(--up)" }}>↑ Unggah <em>{up != null ? "3 koneksi" : ""}</em></div>
              <div className="v mono">{phase === "upload" ? f(live) : f(up)}<small>Mbps</small></div>
              <Spark data={uSeries} color="#c38bff" />
            </div>
          </div>
        </section>

        <section className="lat">
          <div className="glass tile"><div className="k">Ping</div><div className="v mono">{lat ? f(lat.rtt, 0) : phase === "latency" ? f(liveMs, 0) : "—"}<small>ms</small></div></div>
          <div className="glass tile"><div className="k">Jitter</div><div className="v mono">{lat ? f(lat.jitter, 1) : "—"}<small>ms</small></div></div>
          <div className="glass tile"><div className="k">Saat beban</div><div className="v mono">{bl ? <>{bl.grade}<small>+{f(bl.delta, 0)}ms</small></> : "—"}</div></div>
        </section>

        <section className="glass net">
          <div className="cell"><div className="k">IP publik {meta?.v6 ? "(IPv6)" : meta?.ip ? "(IPv4)" : ""}</div><div className="v mono">{meta ? meta.ip || "tidak terbaca" : "…"}</div></div>
          <div className="cell"><div className="k">ISP · {meta?.asn || "ASN"}</div><div className="v">{meta ? meta.isp || "tidak terbaca" : "…"}</div></div>
          <div className="cell"><div className="k">Server Cloudflare</div><div className="v mono">{meta ? coloName(meta.colo) : "…"}</div></div>
          <div className="cell opt"><div className="k">Protokol · data tes</div><div className="v mono">{proto || "—"} · {usedMB ? `${usedMB.toFixed(0)} MB` : "0 MB"}</div></div>
          <div className="cell">
            <div className="k">Lokasi GPS</div>
            {gpsState === "on" ? (
              <div className="v">{place ? place.spot || place.area || place.city : "mencari nama tempat…"}</div>
            ) : (
              <button className="v" onClick={() => locate()} disabled={gpsState === "loading"}>
                {gpsState === "loading" ? "Mencari sinyal…" : gpsState === "denied" ? "Izin ditolak — ketuk lagi" : "Aktifkan GPS"}
              </button>
            )}
          </div>
          <div className="cell opt2"><div className="k">Koordinat {gps ? `±${gps.acc.toFixed(0)} m` : ""}</div><div className={`v mono ${gps ? "" : "dim"}`}>{gps ? `${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` : "—"}</div></div>
          <div className="cell opt2"><div className="k">Area</div><div className={`v ${place ? "" : "dim"}`}>{place ? [place.area, place.city].filter(Boolean).join(", ") : meta?.city ? `${meta.city} (dari IP)` : "—"}</div></div>
          <div className="cell opt"><div className="k">Meleset lokasi IP</div><div className={`v mono ${gap != null ? "" : "dim"}`}>{gap != null ? `${gap < 10 ? gap.toFixed(1) : gap.toFixed(0)} km` : "butuh GPS"}</div></div>
        </section>

        <section className="glass salat" aria-label="Jadwal shalat">
          <div className="head"><span>Menuju <b>{nextName}</b> <span className="mono">{pad(Math.floor(cd / 3600))}:{pad(Math.floor((cd % 3600) / 60))}:{pad(cd % 60)}</span></span><span>{coord.src}</span></div>
          <div className="row">
            {wajib.map((p) => (
              <div key={p.name} className={`p ${p.name === nextName && next ? "next" : now && p.at < now ? "past" : ""}`}>
                <div className="n">{p.name}</div><div className="t mono">{hhmm(p.at)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="ssid">
          {ssidFocus && history.length > 0 && (
            <div className="pop glass">
              {history.map((h) => (
                <button key={h} className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => { setSsid(h); commitSsid(h); setSsidFocus(false); }}>{h}</button>
              ))}
            </div>
          )}
          <label className="glass">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="M2.5 9a14 14 0 0 1 19 0M5.8 12.5a9.3 9.3 0 0 1 12.4 0M9.1 16a4.6 4.6 0 0 1 5.8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="19.4" r="1.4" fill="currentColor" /></svg>
            <input value={ssid} onChange={(e) => setSsid(e.target.value)} onFocus={() => setSsidFocus(true)} onBlur={() => { setSsidFocus(false); commitSsid(ssid); }}
              placeholder="Nama Wi-Fi tempat nongkrong" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="done" aria-label="Nama Wi-Fi (SSID)" />
            <span className="hint">{history.length ? "riwayat" : "isi manual"}</span>
          </label>
        </section>

        <div className="actions">
          <button className="btn primary" onClick={run} disabled={busy}>
            {busy ? `${PHASE_TEXT[phase]}…` : phase === "done" ? "Tes lagi" : phase === "error" ? "Coba lagi" : "Mulai tes"}
          </button>
          <button className="btn ghost" onClick={() => { setPreview(null); setSheet(true); }} disabled={phase !== "done"}>Bagikan</button>
        </div>
      </main>

      {sheet && (
        <div className="scrim" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Bagikan hasil">
            <div className="grab" />
            <h2>Bagikan hasil</h2>
            {preview ? <img src={preview.url} alt="Pratinjau kartu hasil" /> : <div style={{ height: "30dvh", display: "grid", placeItems: "center", color: "var(--sub)" }}>Menyiapkan gambar…</div>}
            <div className="toggle"><div>Koordinat GPS persis<small>Orang lain bisa tahu titik lokasimu</small></div>
              <button className="switch" role="switch" aria-checked={showCoords} onClick={() => setShowCoords((v) => !v)} disabled={!gps} aria-label="Tampilkan koordinat" /></div>
            <div className="toggle"><div>IP publik lengkap<small>Bawaan: disamarkan</small></div>
              <button className="switch" role="switch" aria-checked={fullIp} onClick={() => setFullIp((v) => !v)} aria-label="Tampilkan IP lengkap" /></div>
            <div className="row2">
              <button className="btn ghost" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(waText())}`, "_blank")}>Teks ke WA</button>
              <button className="btn primary" onClick={doShare} disabled={!preview}>Kirim gambar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="alert">{toast}</div>}
    </>
  );
}
