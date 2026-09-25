// Panel recon — kumpulkan info sedetail mungkin tentang PERANGKAT yang sedang
// membuka halaman ini (bukan riwayat pengunjung lain; situs statis tak menyimpan itu).
// Semua dibungkus try/catch: browser berbeda mengekspos hal berbeda.

export type Recon = {
  fingerprint: string;
  device: { ua: string; platform: string; vendor: string; cores: number | null; ram: number | null; touch: number; mobile: boolean | null };
  screen: { res: string; viewport: string; dpr: number; depth: number; orient: string };
  locale: { tz: string; offset: string; langs: string; cookies: boolean; dnt: string };
  gpu: { vendor: string; renderer: string };
  battery: { level: number | null; charging: boolean | null; supported: boolean };
  conn: { type: string; downlink: number | null; rtt: number | null; save: boolean | null };
  webrtc: { ips: string[]; masked: boolean };
  storage: { ls: boolean; quota: string };
  extra: { referrer: string; online: boolean; pdf: boolean; cpuClass: string };
};

function fnv1a(str: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function gpuInfo() {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return { vendor: "—", renderer: "tidak didukung" };
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR));
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    return { vendor, renderer };
  } catch {
    return { vendor: "—", renderer: "tidak terbaca" };
  }
}

async function batteryInfo() {
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> };
    if (!nav.getBattery) return { level: null, charging: null, supported: false };
    const b = await nav.getBattery();
    return { level: Math.round(b.level * 100), charging: b.charging, supported: true };
  } catch {
    return { level: null, charging: null, supported: false };
  }
}

// Bocorkan IP lokal lewat kandidat ICE. Banyak browser modern menyamarkan
// jadi <acak>.local (mDNS); kalau begitu, ditandai "disamarkan".
function webrtcIps(timeout = 2500): Promise<{ ips: string[]; masked: boolean }> {
  return new Promise((resolve) => {
    const out = new Set<string>();
    let masked = false;
    try {
      const RTC = window.RTCPeerConnection;
      if (!RTC) return resolve({ ips: [], masked: false });
      const pc = new RTC({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pc.createDataChannel("x");
      const re = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{0,4}){2,7})/gi;
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const cand = e.candidate.candidate;
        if (/\.local/i.test(cand)) masked = true;
        const m = cand.match(re);
        if (m) m.forEach((ip) => { if (!ip.startsWith("0.0.0.0")) out.add(ip); });
      };
      pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => {});
      setTimeout(() => { try { pc.close(); } catch {} resolve({ ips: Array.from(out), masked }); }, timeout);
    } catch {
      resolve({ ips: [], masked: false });
    }
  });
}

async function storageInfo() {
  let ls = false;
  try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); ls = true; } catch {}
  let quota = "—";
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota) quota = `${(est.quota / 1e9).toFixed(1)} GB`;
  } catch {}
  return { ls, quota };
}

export async function collectRecon(): Promise<Recon> {
  const n = navigator as Navigator & {
    deviceMemory?: number; vendor?: string; userAgentData?: { mobile?: boolean };
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    cpuClass?: string; pdfViewerEnabled?: boolean;
  };
  const s = screen as Screen & { orientation?: { type?: string } };
  const tzOffMin = -new Date().getTimezoneOffset();
  const offset = `UTC${tzOffMin >= 0 ? "+" : "-"}${Math.floor(Math.abs(tzOffMin) / 60)}`;

  const gpu = gpuInfo();
  const [battery, webrtc, storage] = await Promise.all([batteryInfo(), webrtcIps(), storageInfo()]);
  const c = n.connection ?? {};

  const device = {
    ua: navigator.userAgent,
    platform: navigator.platform || "—",
    vendor: n.vendor || "—",
    cores: navigator.hardwareConcurrency ?? null,
    ram: n.deviceMemory ?? null,
    touch: navigator.maxTouchPoints ?? 0,
    mobile: n.userAgentData?.mobile ?? null
  };
  const scr = {
    res: `${screen.width}×${screen.height}`,
    viewport: `${innerWidth}×${innerHeight}`,
    dpr: devicePixelRatio || 1,
    depth: screen.colorDepth,
    orient: s.orientation?.type || "—"
  };
  const locale = {
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "—",
    offset,
    langs: navigator.languages?.join(", ") || navigator.language || "—",
    cookies: navigator.cookieEnabled,
    dnt: navigator.doNotTrack === "1" ? "aktif" : "nonaktif"
  };

  const fp = fnv1a([
    device.ua, device.platform, device.vendor, device.cores, device.ram,
    scr.res, scr.dpr, scr.depth, locale.tz, locale.langs, gpu.renderer, gpu.vendor
  ].join("|"));

  return {
    fingerprint: fp,
    device,
    screen: scr,
    locale,
    gpu,
    battery,
    conn: { type: c.effectiveType || "—", downlink: c.downlink ?? null, rtt: c.rtt ?? null, save: c.saveData ?? null },
    webrtc,
    storage,
    extra: {
      referrer: document.referrer || "langsung / tak ada",
      online: navigator.onLine,
      pdf: !!n.pdfViewerEnabled,
      cpuClass: n.cpuClass || "—"
    }
  };
}
