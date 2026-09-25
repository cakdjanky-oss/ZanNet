// Waktu shalat — perhitungan astronomis lokal (tanpa API).
// Parameter mengikuti kriteria yang umum dipakai Kemenag RI: Subuh -20°, Isya -18°,
// Asar mazhab Syafi'i (bayangan 1x), ihtiyat +2 menit, Imsak = Subuh - 10 menit.
// Hasil bisa beda 1–3 menit dari jadwal resmi Kemenag/ormas setempat.

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => ((a % b) + b) % b;

function julian(y: number, m: number, d: number) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sun(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15;
  const eqt = q / 15 - fix(RA, 24);
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))));
  return { decl, eqt };
}

export type PrayerName = "Imsak" | "Subuh" | "Terbit" | "Zuhur" | "Asar" | "Magrib" | "Isya";
export type PrayerTime = { name: PrayerName; at: Date };

export function prayerTimes(date: Date, lat: number, lng: number): PrayerTime[] {
  const tz = -date.getTimezoneOffset() / 60;
  const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);

  const noon = (t: number) => fix(12 - sun(jd + t).eqt, 24);
  const angleTime = (angle: number, t: number, before: boolean) => {
    const { decl } = sun(jd + t);
    const cosH = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat)));
    const T = deg(Math.acos(Math.max(-1, Math.min(1, cosH)))) / 15;
    return noon(t) + (before ? -T : T);
  };
  const asrTime = (t: number) => {
    const { decl } = sun(jd + t);
    const a = -deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(lat - decl))))));
    return angleTime(a, t, false);
  };

  // dua iterasi supaya deklinasi dihitung pada jam yang mendekati
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let i = 0; i < 2; i++) {
    const f = (h: number) => h / 24;
    t = {
      fajr: angleTime(20, f(t.fajr), true),
      sunrise: angleTime(0.833, f(t.sunrise), true),
      dhuhr: noon(f(t.dhuhr)),
      asr: asrTime(f(t.asr)),
      maghrib: angleTime(0.833, f(t.maghrib), false),
      isha: angleTime(18, f(t.isha), false)
    };
  }

  const toDate = (h: number, addMin: number) => {
    const local = h + tz - lng / 15;
    const mins = Math.ceil(local * 60) + addMin; // dibulatkan ke atas, lalu ihtiyat
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    d.setMinutes(mins);
    return d;
  };

  const subuh = toDate(t.fajr, 2);
  return [
    { name: "Imsak", at: new Date(subuh.getTime() - 10 * 60000) },
    { name: "Subuh", at: subuh },
    { name: "Terbit", at: toDate(t.sunrise, -2) },
    { name: "Zuhur", at: toDate(t.dhuhr, 2) },
    { name: "Asar", at: toDate(t.asr, 2) },
    { name: "Magrib", at: toDate(t.maghrib, 2) },
    { name: "Isya", at: toDate(t.isha, 2) }
  ];
}

export const WAJIB: PrayerName[] = ["Subuh", "Zuhur", "Asar", "Magrib", "Isya"];

export function nextPrayer(now: Date, lat: number, lng: number) {
  const today = prayerTimes(now, lat, lng).filter((p) => WAJIB.includes(p.name));
  const n = today.find((p) => p.at > now);
  if (n) return n;
  const tmr = new Date(now);
  tmr.setDate(tmr.getDate() + 1);
  return prayerTimes(tmr, lat, lng).find((p) => p.name === "Subuh")!;
}
