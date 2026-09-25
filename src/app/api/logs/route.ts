import { NextRequest, NextResponse } from "next/server";
import { readVisits, countVisits, storeReady } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!storeReady()) {
    return NextResponse.json({ error: "Penyimpanan belum dikonfigurasi. Set UPSTASH_REDIS_REST_URL & _TOKEN di Vercel." }, { status: 503 });
  }
  const admin = process.env.ZAN_ADMIN_KEY;
  if (!admin) {
    return NextResponse.json({ error: "ZAN_ADMIN_KEY belum diset di Vercel." }, { status: 503 });
  }
  const key = req.nextUrl.searchParams.get("k") || req.headers.get("x-admin-key") || "";
  if (key !== admin) {
    return NextResponse.json({ error: "Kunci admin salah." }, { status: 401 });
  }
  try {
    const limit = Math.min(500, Number(req.nextUrl.searchParams.get("n")) || 200);
    const [visits, total] = await Promise.all([readVisits(limit), countVisits()]);
    return NextResponse.json({ ok: true, total, visits });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
