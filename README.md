# ZanNet v2

Tes kecepatan internet via edge Cloudflare, satu layar, gaya glass iOS.
Built by [zandev.id](https://zandev.id)

## Isi layar
- Jam live + zona (WIB/WITA/WIT)
- Tanggal Masehi, hari + pasaran Jawa (ganti saat Magrib → "Malam Sabtu Legi"), neptu,
  tanggal & tahun Jawa, Hijriah (latin + Arab). Ketuk kartu tanggal untuk koreksi Hijriah ±1 hari.
- Unduh/Unggah (koneksi paralel, durasi tetap, pemanasan dibuang), Ping, Jitter, Ping saat beban (bufferbloat)
- IP publik, ISP/ASN, server Cloudflare (colo), protokol, data terpakai
- GPS: nama tempat (OpenStreetMap), area, koordinat ±akurasi, selisih lokasi IP vs GPS
- Jadwal shalat hitungan lokal (Subuh -20°, Isya -18°, Asar Syafi'i, ihtiyat +2 mnt)
- SSID manual + riwayat + auto-isi berdasarkan IP publik yang pernah dipakai
- Bagikan: kartu PNG 1080×1350 lewat share sheet (WA), atau teks ke WA.
  Koordinat & IP lengkap disembunyikan secara bawaan.

## Catatan
- Browser tidak bisa membaca SSID, jadi tetap diisi manual.
- Hijriah memakai Umm al-Qura bawaan browser; penetapan Kemenag bisa beda ±1 hari.
- Jadwal shalat bisa selisih 1–3 menit dari jadwal resmi.

## Run
```bash
npm i
npm run dev
```
