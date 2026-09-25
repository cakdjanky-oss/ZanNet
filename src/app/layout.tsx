import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZanNet — Speed Test",
  description: "ZanNet internet speed test. Download, upload, ping, connection intel.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
