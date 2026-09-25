import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZanNet — cek kecepatan internet",
  description: "Tes kecepatan ke edge Cloudflare, lengkap dengan lokasi, jadwal shalat, dan tanggal Jawa & Hijriah. Built by zandev.id",
  icons: { icon: "/favicon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ZanNet" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#040812"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="preconnect" href="https://speed.cloudflare.com" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
