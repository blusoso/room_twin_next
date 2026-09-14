// lib/data/icons.ts

export const PRODUCT_ICONS: Record<string, string> = {
  door: "🚪",
  window: "🪟",
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
};

export function getProductIcon(p: { id: string }): string {
  return PRODUCT_ICONS[p.id] || "📦";
}

export const ZONE_ICON_CATEGORIES = [
  {
    label: "เฟอร์นิเจอร์",
    icons: [
      "🛏️", "🛋️", "🪑", "🚪", "🪟", "🚿", "🛁", "🚽", "🧺", "🗄️",
      "🖥️", "📺", "🪞", "🕰️", "💡", "🕯️", "🖼️", "🧴", "🧹", "🧽",
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