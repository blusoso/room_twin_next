// app/layout.tsx
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import {
  Fraunces,
  Inter,
  Noto_Sans_Thai,
  Gochi_Hand,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import "./roomtwin.css";
import "./ui.css";     

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

const gochi = Gochi_Hand({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-gochi",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RoomTwin — แต่งห้องนอนก่อนซื้อจริง",
  description: "ลองแต่งห้องใน 3D ก่อนตัดสินใจซื้อ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// ⭐ Theme bootstrap — รันก่อน paint กัน FOUC
//    rt-theme: "light" | "dark" (ไม่มี key = ตามระบบ)
const THEME_SCRIPT = `
(function(){
  window.__RT_THEME_INIT__ = 'start';
  try {
    var t = localStorage.getItem('rt-theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
      window.__RT_THEME_INIT__ = 'applied:' + t;
    } else {
      window.__RT_THEME_INIT__ = 'no-pref';
    }
  } catch (e) {
    window.__RT_THEME_INIT__ = 'error:' + (e && e.message);
  }
})();
`;
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
    >
      <body
        className={[
          fraunces.variable,
          inter.variable,
          noto.variable,
          gochi.variable,
          jetbrains.variable,
        ].join(" ")}
      >
        <Script id="rt-theme-init" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}