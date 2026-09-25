// Info jaringan & lokasi.
// Urutan sumber IP/ISP: speed.cloudflare.com/meta -> /cdn-cgi/trace -> ipwho.is -> ipapi.co
// Lokasi presisi: GPS perangkat (butuh izin) + reverse geocode OpenStreetMap Nominatim.

export type NetMeta = {
  ip: string;
  v6: boolean;
  asn: string;
  isp: string;
  colo: string;
  city: string;
  region: string;
  country: string;
  lat: number | null;
  lon: number | null;
  source: string;
};

const COLO: Record<string, string> = {
  CGK: "Jakarta", SUB: "Surabaya", JOG: "Yogyakarta", DPS: "Denpasar", KNO: "Medan", BTH: "Batam",
  UPG: "Makassar", BPN: "Balikpapan", PLM: "Palembang", SIN: "Singapura", KUL: "Kuala Lumpur",
  BKK: "Bangkok", MNL: "Manila", HKG: "Hong Kong", NRT: "Tokyo", KIX: "Osaka", ICN: "Seoul",
  TPE: "Taipei", SYD: "Sydney", PER: "Perth", BOM: "Mumbai", DEL: "Delhi", MAA: "Chennai",
  DXB: "Dubai", FRA: "Frankfurt", AMS: "Amsterdam", LHR: "London", CDG: "Paris",
  LAX: "Los Angeles", SJC: "San Jose", SEA: "Seattle", IAD: "Ashburn", ORD: "Chicago"
};
export const coloName = (c: string) => (c ? `${c}${COLO[c] ? " " + COLO[c] : ""}` : "—");

async function getJson(url: string, ms = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" ? parseFloat(v) : null);

export async function fetchMeta(): Promise<NetMeta> {
  const m: NetMeta = { ip: "", v6: false, asn: "", isp: "", colo: "", city: "", region: "", country: "", lat: null, lon: null, source: "" };

  try {
    const j = JSON.parse(await getJson("https://speed.cloudflare.com/meta"));
    m.ip = j.clientIp ?? "";
    m.asn = j.asn ? `AS${j.asn}` : "";
    m.isp = j.asOrganization ?? "";
    m.colo = j.colo ?? "";
    m.city = j.city ?? "";
    m.region = j.region ?? "";
    m.country = j.country ?? "";
    m.lat = num(j.latitude);
    m.lon = num(j.longitude);
    m.source = "cloudflare";
  } catch {}

  if (!m.ip || !m.colo) {
    try {
      const txt = await getJson("https://speed.cloudflare.com/cdn-cgi/trace");
      const kv = Object.fromEntries(txt.trim().split("\n").map((l) => l.split("=") as [string, string]));
      m.ip ||= kv.ip ?? "";
      m.colo ||= kv.colo ?? "";
      m.country ||= kv.loc ?? "";
      m.source ||= "cf-trace";
    } catch {}
  }

  if (!m.isp || m.lat === null) {
    try {
      const j = JSON.parse(await getJson("https://ipwho.is/"));
      if (j.success !== false) {
        m.ip ||= j.ip ?? "";
        m.isp ||= j.connection?.isp || j.connection?.org || "";
        m.asn ||= j.connection?.asn ? `AS${j.connection.asn}` : "";
        m.city ||= j.city ?? "";
        m.region ||= j.region ?? "";
        m.country ||= j.country_code ?? "";
        m.lat ??= num(j.latitude);
        m.lon ??= num(j.longitude);
        m.source ||= "ipwho.is";
      }
    } catch {}
  }

  if (!m.isp) {
    try {
      const j = JSON.parse(await getJson("https://ipapi.co/json/"));
      m.ip ||= j.ip ?? "";
      m.isp ||= j.org ?? "";
      m.asn ||= j.asn ?? "";
      m.city ||= j.city ?? "";
      m.lat ??= num(j.latitude);
      m.lon ??= num(j.longitude);
      m.source ||= "ipapi.co";
    } catch {}
  }

  m.v6 = m.ip.includes(":");
  return m;
}

export function maskIp(ip: string) {
  if (!ip) return "—";
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + ":••••";
  const p = ip.split(".");
  return p.length === 4 ? `${p[0]}.${p[1]}.•••.•••` : ip;
}

export type Gps = { lat: number; lon: number; acc: number; alt: number | null; at: number };

export function getGps(): Promise<Gps> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("UNSUPPORTED"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude, at: p.timestamp }),
      (e) => reject(new Error(e.code === 1 ? "DENIED" : e.code === 3 ? "TIMEOUT" : "UNAVAILABLE")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}

export async function gpsAlreadyAllowed() {
  try {
    const s = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return s.state === "granted";
  } catch {
    return false;
  }
}

export type Place = { spot: string; area: string; city: string };

export async function reverseGeocode(lat: number, lon: number): Promise<Place | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=id`;
    const j = JSON.parse(await getJson(url, 7000));
    const a = j.address ?? {};
    const spot = j.name || a.amenity || a.shop || a.building || a.road || "";
    const area = a.village || a.suburb || a.neighbourhood || a.quarter || a.city_district || "";
    const city = a.city || a.town || a.regency || a.county || a.state || "";
    return { spot, area, city };
  } catch {
    return null;
  }
}

export function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
