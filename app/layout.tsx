import type { Metadata } from "next";
import { Fraunces, Inter, Noto_Sans_Thai } from "next/font/google";

import "./globals.css";
import "../styles/tokens.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const noto = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "RoomTwin — แต่งห้องนอนก่อนซื้อจริง",
  description: "ลองแต่งห้องใน 3D ก่อนตัดสินใจซื้อ",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body
        className={`${fraunces.variable} ${inter.variable} ${noto.variable}`}
      >
        {children}
      </body>
    </html>
  );
}