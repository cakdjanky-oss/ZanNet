import { NextRequest, NextResponse } from "next/server";
import { pushVisit, storeReady } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dec = (v: string | null) => { try { return v ? decodeURIComponent(v) : ""; } catch { return v ?? ""; } };

export async function POST(req: NextRequest) {
  // Kalau penyimpanan belum diset, jangan error — cukup no-op.
  if (!storeReady()) return NextResponse.json({ ok: false, stored: false });

  const h = req.headers;
  const ip = (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "").trim();

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const entry = {
    t: Date.now(),
    ip,
    // Geo tingkat kota dari IP (disediakan Vercel) — bukan GPS perangkat.
    city: dec(h.get("x-vercel-ip-city")),
    region: dec(h.get("x-vercel-ip-country-region")),
    country: h.get("x-vercel-ip-country") || "",
    tzHdr: h.get("x-vercel-ip-timezone") || "",
    ua: h.get("user-agent") || "",
    ref: h.get("referer") || "",
    // Data ringan dari klien (opsional):
    lang: String(body.lang ?? ""),
    tz: String(body.tz ?? ""),
    screen: String(body.screen ?? ""),
    gpu: String(body.gpu ?? ""),
    cores: body.cores ?? null,
    ram: body.ram ?? null,
    plat: String(body.plat ?? "")
  };

  try {
    await pushVisit(entry);
    return NextResponse.json({ ok: true, stored: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
