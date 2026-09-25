# ZANNET

Cloudflare-edge speed receipt. One viewport. Monospace. Screenshot-ready.

```
ZANNET                                          LOCK ●
RESULT 1790…                                 T+00:08.4
DOWN        212.00 Mbps
UP          117.95 Mbps
RTT            54 ms
SSID        RUMAH-ZAN                 manual
PUB         114.8.218.235
─────────────────────────────────────────────────────
built by zandev.id                    v1.0 · cf-edge
```

## Engine

- Download `GET https://speed.cloudflare.com/__down?bytes=`
- Upload `POST https://speed.cloudflare.com/__up`
- RTT / jitter from zero-byte edge pings
- Public IP / GEO / ASN via `ipapi.co`
- SSID cannot be read by the browser — tap the `SSID` row and label it manually so it lands in the screenshot

## Run

```bash
npm i
npm run dev
```

## Deploy

Push this folder to GitHub, import on Vercel. No env vars required.

Built by [zandev.id](https://zandev.id)
