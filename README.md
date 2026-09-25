# ZanNet

Internet speed test — dark command-desk UI. Deploy ke Vercel dengan project name `zannet`.

## What it measures

- **Download** — stream ~20MB dari `speed.cloudflare.com/__down`
- **Upload** — POST 8MB ke `speed.cloudflare.com/__up`
- **Ping** — RTT sample ke edge yang sama (idle + rata-rata)
- **Link intel** — Network Information API (tipe tautan) + ISP/ASN/city dari IP
- **SSID** — browser **tidak** expose nama Wi‑Fi. Ada input label manual.

## Local

```bash
npm install
npm run dev
```

Buka http://localhost:3000

## Deploy Vercel

1. Push folder ini ke GitHub (repo root = folder `zannet`).
2. vercel.com → Add New Project → import repo.
3. Project Name: `zannet` → domain jadi `zannet.vercel.app`.
4. Framework Preset: Next.js. Build command default. Deploy.

Atau CLI:

```bash
npx vercel --yes
npx vercel --prod
```

## Notes

- Angka bukan 1:1 dengan Speedtest.net (server & metodologi beda). Ini ukur path ke Cloudflare edge terdekat.
- Cloudflare boleh kumpulin hasil agregat dari endpoint publik mereka.
- Jangan expect SSID — itu OS-level, web lock.
