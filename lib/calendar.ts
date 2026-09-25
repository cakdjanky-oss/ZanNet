// Kalender Masehi, Jawa (pasaran, neptu, bulan & tahun Jawa), dan Hijriah.
// Catatan jujur:
// - Hijriah dihitung dengan kalender Umm al-Qura (bawaan browser). Penetapan
//   Kemenag (rukyat/imkanur rukyat) bisa selisih ±1 hari, jadi ada koreksi manual.
// - Bulan & tahun Jawa diturunkan dari tanggal Hijriah (tahun Jawa = tahun H + 512),
//   jadi ikut koreksi yang sama. Hitungan Aboge/Asapon bisa berbeda 1 hari.
// - Hari Jawa & Hijriah berganti saat Magrib ("malam Sabtu Pahing").

export const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const NEPTU_HARI = [5, 4, 3, 7, 8, 6, 9];
export const PASARAN = ["Legi", "Pahing", "Pon", "Wage", "Kliwon"];
const NEPTU_PASARAN = [5, 9, 7, 4, 8];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HIJRI = ["Muharam", "Safar", "Rabiulawal", "Rabiulakhir", "Jumadilawal", "Jumadilakhir", "Rajab", "Syakban", "Ramadan", "Syawal", "Zulkaidah", "Zulhijah"];
const JAWA = ["Sura", "Sapar", "Mulud", "Bakdamulud", "Jumadilawal", "Jumadilakir", "Rejeb", "Ruwah", "Pasa", "Sawal", "Sela", "Besar"];
const TAHUN_JAWA = ["Alip", "Ehe", "Jimawal", "Je", "Dal", "Be", "Wawu", "Jimakir"];
const HARI_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// Jangkar: 17 Agustus 1945 = Jumat Legi
const ANCHOR = Date.UTC(1945, 7, 17) / 86400000;

function dayNumber(d: Date) {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
}
const mod = (a: number, n: number) => ((a % n) + n) % n;

export function pasaranOf(d: Date) {
  return mod(dayNumber(d) - ANCHOR, 5);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function hijriParts(d: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "numeric",
      year: "numeric"
    }).formatToParts(d);
    const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
    return { day: get("day"), month: get("month"), year: get("year") };
  } catch {
    return null;
  }
}

function toArabicDigits(n: number) {
  return String(n).replace(/\d/g, (c) => "٠١٢٣٤٥٦٧٨٩"[+c]);
}
const HIJRI_AR = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];

export type Tanggal = {
  masehi: string; // Jumat, 25 September 2026
  hariPasaran: string; // Jumat Legi  atau  Malam Sabtu Pahing
  malam: boolean;
  neptu: number;
  jawa: string; // 13 Bakdamulud 1960 Dal
  hijri: string; // 13 Rabiulakhir 1448 H
  arab: string; // الجمعة ١٣ ربيع الآخر ١٤٤٨ هـ
};

/**
 * @param now waktu sekarang
 * @param afterMaghrib true jika sudah lewat Magrib (hari Jawa/Hijriah berganti)
 * @param hijriOffset koreksi manual Hijriah (-2..+2 hari)
 */
export function tanggalLengkap(now: Date, afterMaghrib: boolean, hijriOffset = 0): Tanggal {
  const civilDow = now.getDay();
  const masehi = `${HARI[civilDow]}, ${now.getDate()} ${BULAN[now.getMonth()]} ${now.getFullYear()}`;

  const eff = afterMaghrib ? addDays(now, 1) : now; // hari "Jawa/Islam" yang berlaku
  const dow = eff.getDay();
  const pas = pasaranOf(eff);
  const neptu = NEPTU_HARI[dow] + NEPTU_PASARAN[pas];
  const hariPasaran = afterMaghrib ? `Malam ${HARI[dow]} ${PASARAN[pas]}` : `${HARI[dow]} ${PASARAN[pas]}`;

  const h = hijriParts(addDays(eff, hijriOffset));
  let hijri = "—";
  let jawa = "—";
  let arab = "";
  if (h && h.month >= 1 && h.month <= 12) {
    hijri = `${h.day} ${HIJRI[h.month - 1]} ${h.year} H`;
    const aj = h.year + 512;
    jawa = `${h.day} ${JAWA[h.month - 1]} ${aj} ${TAHUN_JAWA[mod(aj - 1956, 8)]}`;
    arab = `${afterMaghrib ? "ليلة " : ""}${HARI_AR[dow]}، ${toArabicDigits(h.day)} ${HIJRI_AR[h.month - 1]} ${toArabicDigits(h.year)} هـ`;
  }
  return { masehi, hariPasaran, malam: afterMaghrib, neptu, jawa, hijri, arab };
}

export function zonaWaktu(d: Date) {
  const off = -d.getTimezoneOffset() / 60;
  if (off === 7) return "WIB";
  if (off === 8) return "WITA";
  if (off === 9) return "WIT";
  return `UTC${off >= 0 ? "+" : ""}${off}`;
}
