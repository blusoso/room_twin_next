// lib/data/icons.ts

// lib/data/icons.tsx
import type { ReactNode } from "react";

/* ⭐ Emoji เริ่มต้น (ใช้ทั่วแอป) */
export const PRODUCT_ICONS: Record<string, string> = {
  door: "🚪",
  slidingdoor: "🚪",
  window: "🪟",
  column: "🏛️",
  partition: "🚧",
  stairs: "🪜",
  bed: "🛏️",
  armchair: "🪑",
  bench: "🛋️",
  stool: "🪑",
  nightstand: "🗄️",
  wardrobe: "🚪",
  dressing: "💄",
  bookshelf: "📚",
  desk: "🖥️",
  officechair: "🪑",
  floorlamp: "💡",
  tablelamp: "💡",
  mirror: "🪞",
  wallart: "🖼️",
  plant: "🌿",
  roundrug: "⬜",
  rectrug: "⬜",
  pouf: "🟡",
  pendantlamp: "💡",
  ceilingfan: "🌀",
  downlight: "💡",
  hangingplant: "🌿",
  curtain: "🪟",
  ac: "❄️",
};

export function getProductIcon(p: { id: string }): string {
  return PRODUCT_ICONS[p.id] || "📦";
}

/* ⭐ SVG override — เฉพาะที่ต้องการภาพสวยกว่า emoji
   ใช้ใน structure card ของ RoomStructurePanel */
export const STRUCTURE_SVG_ICONS: Record<string, ReactNode> = {
  slidingdoor: (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <rect x="2.5" y="3" width="19" height="18" rx="2.5"
        fill="#F8E7CF" stroke="#B4702B" strokeWidth="1.6" />
      <rect x="4.5" y="5" width="8" height="14" rx="1"
        fill="#fff" stroke="#B4702B" strokeWidth="1" />
      <rect x="11.5" y="5" width="8" height="14" rx="1"
        fill="#F1D3A6" stroke="#B4702B" strokeWidth="1" />
      <path d="M9 12h6m-2-2 2 2-2 2"
        stroke="#B4702B" strokeWidth="1.4" fill="none"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  curtain: (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <path d="M2.5 4h19" stroke="#8A6A4A" strokeWidth="1.8"
        strokeLinecap="round" />
      <path d="M3.8 5.6C3.8 11 5.2 14 4.6 21h4.8c-.6-7 .6-10 .6-15.4z"
        fill="#E8A9C0" />
      <path d="M14 5.6c0 5.4 1.2 8.4.6 15.4h4.8c-.6-7 .8-10 .8-15.4z"
        fill="#E8A9C0" />
      <path d="M6.6 6.5V20M16.8 6.5V20"
        stroke="#C7809B" strokeWidth="1" />
    </svg>
  ),
};

/* ⭐ helper: คืน ReactNode สำหรับ render
   → ถ้ามี SVG ใช้ SVG, ไม่งั้น fallback เป็น emoji string */
export function getProductIconNode(p: { id: string }): ReactNode {
  return STRUCTURE_SVG_ICONS[p.id] ?? getProductIcon(p);
}

export const ZONE_ICON_CATEGORIES = [
  {
    label: "เฟอร์นิเจอร์",
    icons: [
      "🛏️", "🛋️", "🪑", "🚪", "🪟", "🚿", "🛁", "🚽", "🧺", "🗄️",
      "💄", "🖥️", "📺", "🪞", "🕰️", "💡", "🕯️", "🖼️", "🧴", "🧹", "🧽",
    ],
  },
  {
    label: "กิจกรรม",
    icons: [
      "💼", "📚", "🎮", "🎨", "🎵", "🎧", "🎬", "🎯", "⚽", "🏀",
      "🏋️", "🧘", "🍵", "☕", "🍷", "🎸", "🎹", "🎤", "📷", "✂️",
    ],
  },
  {
    label: "ของแต่ง",
    icons: [
      "🌿", "🪴", "🌸", "🌻", "🌹", "🍀", "🧸", "🎀", "💎", "🪄",
      "🎁", "⭐", "💖", "✨", "🌈", "☁️", "🔥", "🌙", "☀️", "🍄",
    ],
  },
  {
    label: "สัตว์",
    icons: [
      "🐾", "🐱", "🐶", "🐰", "🐻", "🦊", "🐼", "🐨", "🦁", "🐯",
      "🐸", "🐥", "🦋", "🐝", "🐢", "🐙",
    ],
  },
  {
    label: "อื่นๆ",
    icons: [
      "📦", "📌", "📍", "🔖", "🏠", "🏡", "🏢", "🏰", "🎪", "🎭",
      "🚀", "⛺", "🗺️", "🧭", "⚓", "🎈",
    ],
  },
] as const;