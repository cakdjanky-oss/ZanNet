// Penyimpanan log pengunjung via Upstash Redis REST API (tanpa dependency).
// Butuh env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
// Kalau env belum diisi, semua fungsi jadi no-op supaya web tetap jalan.

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
export const storeReady = () => !!(URL && TOKEN);

const KEY = "zannet:visits";
const CAP = 500; // simpan 500 kunjungan terakhir

async function pipeline(cmds: unknown[][]) {
  if (!storeReady()) return null;
  const r = await fetch(`${URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store"
  });
  if (!r.ok) throw new Error(`upstash ${r.status}`);
  return r.json();
}

export async function pushVisit(entry: unknown) {
  return pipeline([
    ["LPUSH", KEY, JSON.stringify(entry)],
    ["LTRIM", KEY, 0, CAP - 1]
  ]);
}

export async function readVisits(limit = 200): Promise<unknown[]> {
  if (!storeReady()) return [];
  const r = await fetch(`${URL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(["LRANGE", KEY, 0, limit - 1]),
    cache: "no-store"
  });
  if (!r.ok) throw new Error(`upstash ${r.status}`);
  const j = await r.json();
  const arr: string[] = j.result ?? [];
  return arr.map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
}

export async function countVisits(): Promise<number> {
  if (!storeReady()) return 0;
  const r = await fetch(`${URL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(["LLEN", KEY]),
    cache: "no-store"
  });
  if (!r.ok) return 0;
  const j = await r.json();
  return j.result ?? 0;
}
