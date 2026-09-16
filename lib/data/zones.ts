// lib/data/zones.ts

export interface ZoneSlot {
  slotId: string;
  label: string;
  productId: string;
  dx: number;
  dz: number;
  parentSlot?: string;
  swapCats: string[];
}

export interface ZoneDef {
  id: string;
  name: string;
  icon: string;
  color: number;
  slots: ZoneSlot[];
}

export const ZONES: ZoneDef[] = [
  {
    id: "sleepzone",
    name: "โซนนอน",
    icon: "🛏️",
    color: 0xd9a8a8,
    slots: [
      {
        slotId: "bed",
        label: "เตียง",
        productId: "bed",
        dx: 0,
        dz: 0.1,
        swapCats: ["sleep"],
      },
      {
        slotId: "nightstand",
        label: "โต๊ะข้างเตียง",
        productId: "nightstand",
        dx: 1.05,
        dz: -0.85,
        swapCats: ["storage", "sleep"],
      },
      {
        slotId: "lamp",
        label: "โคมไฟ",
        productId: "tablelamp",
        dx: 1.05,
        dz: -0.85,
        parentSlot: "nightstand",
        swapCats: ["light"],
      },
    ],
  },
  {
    id: "workzone",
    name: "โซนทำงาน",
    icon: "💼",
    color: 0xc9a776,
    slots: [
      {
        slotId: "desk",
        label: "โต๊ะทำงาน",
        productId: "desk",
        dx: 0,
        dz: -0.1,
        swapCats: ["storage"],
      },
      {
        slotId: "chair",
        label: "เก้าอี้",
        productId: "officechair",
        dx: 0,
        dz: 0.75,
        swapCats: ["storage", "sleep"],
      },
      {
        slotId: "lamp",
        label: "โคมไฟ",
        productId: "tablelamp",
        dx: -0.4,
        dz: -0.1,
        parentSlot: "desk",
        swapCats: ["light"],
      },
    ],
  },
  {
    id: "readingzone",
    name: "โซนอ่านหนังสือ",
    icon: "📚",
    color: 0x8fafa0,
    slots: [
      {
        slotId: "chair",
        label: "อาร์มแชร์",
        productId: "armchair",
        dx: -0.5,
        dz: 0,
        swapCats: ["sleep"],
      },
      {
        slotId: "lamp",
        label: "โคมไฟตั้งพื้น",
        productId: "floorlamp",
        dx: 0.55,
        dz: -0.5,
        swapCats: ["light"],
      },
      {
        slotId: "shelf",
        label: "ชั้นวางหนังสือ",
        productId: "bookshelf",
        dx: 0.5,
        dz: 0.6,
        swapCats: ["storage"],
      },
    ],
  },
  {
    id: "gamezone",
    name: "โซนเล่นเกม",
    icon: "🎮",
    color: 0x8a8fb0,
    slots: [
      {
        slotId: "desk",
        label: "โต๊ะเกม",
        productId: "desk",
        dx: 0,
        dz: -0.1,
        swapCats: ["storage"],
      },
      {
        slotId: "chair",
        label: "เก้าอี้",
        productId: "officechair",
        dx: 0,
        dz: 0.75,
        swapCats: ["storage"],
      },
      {
        slotId: "lamp",
        label: "โคมไฟ",
        productId: "tablelamp",
        dx: -0.4,
        dz: -0.1,
        parentSlot: "desk",
        swapCats: ["light"],
      },
      {
        slotId: "plant",
        label: "ต้นไม้",
        productId: "plant",
        dx: 0.95,
        dz: 0.55,
        swapCats: ["light"],
      },
    ],
  },
  {
    id: "vanityzone",
    name: "โซนแต่งตัว",
    icon: "💄",
    color: 0xe0b0c0,
    slots: [
      {
        slotId: "dressing",
        label: "โต๊ะเครื่องแป้ง",
        productId: "dressing",
        dx: 0,
        dz: -0.2,
        swapCats: ["storage"],
      },
      {
        slotId: "stool",
        label: "สตูล",
        productId: "stool",
        dx: 0,
        dz: 0.55,
        swapCats: ["sleep"],
      },
      {
        slotId: "mirror",
        label: "กระจก",
        productId: "mirror",
        dx: -0.75,
        dz: 0.1,
        swapCats: ["light"],
      },
    ],
  },
  {
    id: "storagezone",
    name: "โซนจัดเก็บ",
    icon: "🗄️",
    color: 0xa8b890,
    slots: [
      {
        slotId: "wardrobe",
        label: "ตู้เสื้อผ้า",
        productId: "wardrobe",
        dx: -0.2,
        dz: 0,
        swapCats: ["storage"],
      },
      {
        slotId: "shelf",
        label: "ชั้นวาง",
        productId: "bookshelf",
        dx: 0.9,
        dz: 0,
        swapCats: ["storage"],
      },
    ],
  },
];

/**
 * ⭐ Single Source of Truth ของ "available zone definitions"
 * ทุกส่วน (My Room / zone editor / 3D / zone chooser) ต้อง derive จากชุดนี้เท่านั้น
 * ห้าม hardcode name/icon/color ของโซนซ้ำที่อื่น — ใช้ resolveZoneDisplay() ใน lib/data/zoneResolve.ts
 */
export const ZONE_DEFINITIONS: ZoneDef[] = ZONES;

/**
 * ⭐ ค่า fallback ของโซนที่มี item แต่ resolve ZoneDef ไม่ได้ (ข้อมูลเก่า / ย้ายโซน)
 * ประกาศที่เดียวทั้งระบบ — ห้าม hardcode ค่านี้ซ้ำใน UI หรือ 3D
 */
export const ZONE_FALLBACK = {
  name: "โซน",
  icon: "📦",
  color: 0xb8752e,
} as const;

export const ZONE_BY_ID = new Map(ZONES.map((z) => [z.id, z]));