// Kartu hasil untuk dibagikan (PNG 1080x1350, rasio feed/WA).

export type CardData = {
  down: string; up: string; ping: string; jitter: string; bloat: string;
  ssid: string; spot: string; area: string; coords: string;
  isp: string; server: string; ip: string;
  masehi: string; hariPasaran: string; jawa: string; hijri: string; arab: string;
  time: string;
};

const W = 1080;
const H = 1350;
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const SANS = '-apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif';
const ARAB = '"Geeza Pro", "Noto Naskh Arabic", "Traditional Arabic", serif';

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glass(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 44) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

export async function renderCard(d: CardData): Promise<Blob> {
  try { await document.fonts.ready; } catch {}
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // latar
  ctx.fillStyle = "#040812";
  ctx.fillRect(0, 0, W, H);
  const orb = (x: number, y: number, r: number, col: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  orb(120, 180, 620, "rgba(40,120,255,0.45)");
  orb(1000, 520, 560, "rgba(150,70,255,0.35)");
  orb(420, 1300, 620, "rgba(0,230,190,0.22)");
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let y = 0; y < H; y += 24) for (let x = 0; x < W; x += 24) ctx.fillRect(x, y, 2, 2);

  const L = 64;
  // header
  ctx.fillStyle = "#e9f1ff";
  ctx.font = `700 46px ${SANS}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("ZanNet", L, 112);
  ctx.fillStyle = "#3cf0ff";
  ctx.beginPath(); ctx.arc(L + 180, 96, 8, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(233,241,255,0.7)";
  ctx.font = `500 32px ${MONO}`;
  ctx.fillText(d.time, W - L, 110);
  ctx.textAlign = "left";

  // tanggal
  glass(ctx, L - 16, 150, W - 2 * L + 32, 206);
  ctx.fillStyle = "#e9f1ff";
  ctx.font = `600 36px ${SANS}`;
  ctx.fillText(fit(ctx, d.masehi, W - 2 * L - 20), L + 20, 206);
  ctx.fillStyle = "#ffd166";
  ctx.font = `500 30px ${SANS}`;
  ctx.fillText(fit(ctx, `${d.hariPasaran} · ${d.jawa}`, W - 2 * L - 20), L + 20, 256);
  ctx.fillStyle = "rgba(233,241,255,0.72)";
  ctx.fillText(d.hijri, L + 20, 304);
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.font = `500 32px ${ARAB}`;
  ctx.fillStyle = "rgba(233,241,255,0.9)";
  ctx.fillText(d.arab, W - L - 20, 304);
  ctx.direction = "ltr";
  ctx.textAlign = "left";

  // kecepatan
  const colW = (W - 2 * L - 24) / 2;
  const big = (x: number, label: string, val: string, color: string) => {
    glass(ctx, x - 16, 384, colW + 16, 250);
    ctx.fillStyle = color;
    ctx.font = `600 30px ${SANS}`;
    ctx.fillText(label, x + 12, 438);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 110px ${MONO}`;
    ctx.fillText(fit(ctx, val, colW - 20), x + 8, 560);
    ctx.fillStyle = "rgba(233,241,255,0.55)";
    ctx.font = `500 30px ${SANS}`;
    ctx.fillText("Mbps", x + 12, 608);
  };
  big(L, "↓ Unduh", d.down, "#3cf0ff");
  big(L + colW + 24, "↑ Unggah", d.up, "#c38bff");

  // latency
  const cw = (W - 2 * L - 32) / 3;
  [["Ping", d.ping], ["Jitter", d.jitter], ["Saat beban", d.bloat]].forEach(([k, v], i) => {
    const x = L + i * (cw + 16);
    glass(ctx, x - 16, 662, cw + 16, 136, 36);
    ctx.fillStyle = "rgba(233,241,255,0.55)";
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText(k, x + 10, 708);
    ctx.fillStyle = "#ffd166";
    ctx.font = `600 44px ${MONO}`;
    ctx.fillText(fit(ctx, v, cw - 16), x + 10, 768);
  });

  // lokasi & wifi
  glass(ctx, L - 16, 826, W - 2 * L + 32, 250);
  ctx.fillStyle = "#3dffa2";
  ctx.font = `700 54px ${SANS}`;
  ctx.fillText(fit(ctx, `📶 ${d.ssid || "Wi-Fi"}`, W - 2 * L - 30), L + 16, 900);
  ctx.fillStyle = "#e9f1ff";
  ctx.font = `600 34px ${SANS}`;
  ctx.fillText(fit(ctx, `📍 ${d.spot || d.area || "Lokasi tidak diaktifkan"}`, W - 2 * L - 30), L + 16, 962);
  ctx.fillStyle = "rgba(233,241,255,0.6)";
  ctx.font = `500 28px ${SANS}`;
  if (d.spot && d.area) ctx.fillText(fit(ctx, d.area, W - 2 * L - 30), L + 16, 1008);
  if (d.coords) {
    ctx.font = `500 26px ${MONO}`;
    ctx.fillText(fit(ctx, d.coords, W - 2 * L - 30), L + 16, 1050);
  }

  // jaringan
  ctx.font = `500 28px ${MONO}`;
  const rows: [string, string][] = [["ISP", d.isp], ["Server", d.server], ["IP", d.ip]];
  rows.forEach(([k, v], i) => {
    const y = 1140 + i * 46;
    ctx.fillStyle = "rgba(233,241,255,0.45)";
    ctx.fillText(k, L, y);
    ctx.fillStyle = "#e9f1ff";
    ctx.fillText(fit(ctx, v || "—", W - 2 * L - 170), L + 170, y);
  });

  ctx.fillStyle = "rgba(233,241,255,0.4)";
  ctx.font = `500 24px ${SANS}`;
  ctx.fillText("Tes via edge Cloudflare · zan-net.vercel.app", L, H - 44);
  ctx.textAlign = "right";
  ctx.fillText("built by zandev.id", W - L, H - 44);

  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
}

export async function shareCard(blob: Blob, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], `zannet-${Date.now()}.png`, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return "downloaded";
}
