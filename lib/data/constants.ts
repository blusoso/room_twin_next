// lib/data/constants.ts
import { ZONE_DEFINITIONS } from "./zones";

/* ============================================================
   ⭐ หมวดหมู่สินค้า (แยกย่อย ไม่รวมกัน)
   — ใช้ทั้งในแถบ tab และ section header ในแท็บ "ทั้งหมด"
   ============================================================ */

export const CATEGORIES = [
  { id: "zone",       label: "🏠 ชุดโซน" },
  { id: "structure",  label: "🧱 โครงสร้างพื้นฐาน" },

  { id: "bed",        label: "🛏️ เตียง" },
  { id: "seating",    label: "🛋️ ที่นั่ง" },
  { id: "table",      label: "🖥️ โต๊ะ" },
  { id: "cabinet",    label: "🗄️ ตู้" },
  { id: "shelf",      label: "📚 ชั้นวาง" },
  { id: "lamp",       label: "💡 โคมไฟ" },
  { id: "decor",      label: "🖼️ ของตกแต่ง" },
  { id: "curtain",    label: "🪟 ม่าน" },
  { id: "air",        label: "❄️ แอร์" },
  { id: "fan",        label: "🌀 พัดลม" },
  { id: "rug",        label: "🧶 พรม" },
  { id: "misc",       label: "📦 อื่น ๆ" },

  { id: "ceiling",    label: "⬜ เพดาน" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

/* ============================================================
   ⭐ Main Categories (2 ชั้น) — ใช้กับการ์ดหมวดในแถวบน
   ============================================================ */

export interface SubCategoryDef {
  id: string;
  label: string;
  /** product cats ที่จะดึงมาแสดง (union กับ ids ถ้ามีทั้งคู่) */
  cats?: string[];
  /** product ids เจาะจง (ใช้กับโครงสร้าง/ของที่ต้องแยกชิ้น) */
  ids?: string[];
  /** zone ids (ใช้กับ "ชุดโซน" เท่านั้น) */
  zoneIds?: string[];
}

export interface MainCategoryDef {
  id: string;
  label: string;
  icon: string;
  subs?: SubCategoryDef[];
}

export const MAIN_CATEGORIES: MainCategoryDef[] = [
  /* ── 1. ทั้งหมด ────────────────────────────── */
  {
    id: "all",
    label: "ทั้งหมด",
    icon: "▦",
  },

  /* ── 2. ชุดโซน ─────────────────────────────── */
  {
    id: "zone",
    label: "ชุดโซน",
    icon: "🏠",
    // ⭐ ไม่มี subs — เลือกแล้วเห็นโซนทั้งหมดทันที
  },

  /* ── 3. เฟอร์นิเจอร์ ─────────────────────────── */
  {
    id: "furniture",
    label: "เฟอร์นิเจอร์",
    icon: "🛋️",
    subs: [
      { id: "all",     label: "ทั้งหมด" },
      { id: "bed",     label: "เตียง",       cats: ["bed"] },
      { id: "seating", label: "ที่นั่ง",     cats: ["seating"] },
      { id: "table",   label: "โต๊ะ",         cats: ["table"] },
      { id: "storage", label: "ที่เก็บของ",  cats: ["cabinet", "shelf"] },
    ],
  },

  /* ── 4. ไฟ & เครื่องใช้ไฟฟ้า ─────────────────── */
  {
    id: "electric",
    label: "ไฟ & เครื่องใช้ไฟฟ้า",
    icon: "💡",
    subs: [
      { id: "all",  label: "ทั้งหมด" },
      {
        id: "lamp",
        label: "โคมไฟ",
        cats: ["lamp"],
        ids: ["pendantlamp", "downlight"],
      },
      { id: "air", label: "แอร์",  cats: ["air"] },
      { id: "fan", label: "พัดลม", ids: ["ceilingfan"] },
      { id: "tv",  label: "จอและทีวี", ids: [] },
    ],
  },

  /* ── 5. ตกแต่ง ───────────────────────────────── */
  {
    id: "decor",
    label: "ตกแต่ง",
    icon: "🖼️",
    subs: [
      { id: "all",     label: "ทั้งหมด" },
      { id: "curtain", label: "ม่าน",           cats: ["curtain"] },
      { id: "rug",     label: "พรม",             cats: ["rug"] },
      { id: "art",     label: "ภาพ & ของตกแต่ง", cats: ["decor"] },
      { id: "plant",   label: "ต้นไม้",          ids: ["plant", "hangingplant"] },
    ],
  },

  /* ── 6. โครงสร้าง ───────────────────────────── */
  {
    id: "structure",
    label: "โครงสร้าง",
    icon: "🧱",
    subs: [
      { id: "all",     label: "ทั้งหมด" },
      { id: "door",    label: "ประตู",    ids: ["door", "slidingdoor"] },
      { id: "window",  label: "หน้าต่าง",  ids: ["window"] },
      { id: "wall",    label: "ผนัง",      ids: ["column", "partition"] },
      { id: "ceiling", label: "เพดาน",    cats: ["ceiling"] },
    ],
  },
];

/* ⭐ helper: ดึงสินค้าตาม sub */
export function productsForSub(sub: SubCategoryDef): string[] {
  const set = new Set<string>();
  sub.cats?.forEach((c) => {
    PRODUCTS_LIST.filter((p) => p.cat === c).forEach((p) => set.add(p.id));
  });
  sub.ids?.forEach((id) => set.add(id));
  return Array.from(set);
}

/* ⭐ ต้อง import PRODUCTS เข้ามาเพื่อใช้ใน helper — หรือย้าย helper ไปไว้ที่อื่น */
import { PRODUCTS as PRODUCTS_LIST } from "./products";

/* ⭐ หมวดที่จะไม่โชว์เป็น section ในแท็บ "ทั้งหมด"
   (เพราะถูกจัดการแยกไปแล้ว เช่น zone มี ZONES ของตัวเอง) */
export const HIDDEN_IN_ALL_TAB: CategoryId[] = ["zone", "ceiling"];

/* ⭐ ลำดับ section ที่จะแสดงในแท็บ "ทั้งหมด" (เฉพาะที่ต้องการ) */
export const ALL_TAB_SECTIONS = CATEGORIES.filter(
  (c) => !HIDDEN_IN_ALL_TAB.includes(c.id),
);

/* ============================================================
   Room / Units
   ============================================================ */

export const CELL_SIZE = 0.5;
export const GRID = 0.1;

/* ============================================================
   Storage keys
   ============================================================ */

export const STORAGE_KEY = "roomtwin_state_v14";

/** ⭐ key รุ่นก่อน — อ่านเป็น fallback ใน loadFromStorage() */
export const LEGACY_STORAGE_KEYS = [
  "roomtwin_state_v13",
  "roomtwin_state_v12",
  "roomtwin_state_v11",
];

/** ⭐ view preference: ผนังรอบด้าน */
export const SHOW_ALL_WALLS_KEY = "roomtwin_show_all_walls";

/** ⭐ view preference: โหมดวัดขนาด (📏) */
export const MEASURE_KEY = "roomtwin_show_measure";

/** ⭐ view preference: โหมดแสง + สวิตช์ไฟโคม */
export const LIGHTING_PREF_KEY = "roomtwin_lighting_pref";

/** ⭐ id ของช่องค้นหาสินค้าในแคตตาล็อก */
export const CATALOG_SEARCH_INPUT_ID = "catalogSearchInput";

/* ============================================================
   Wall colors
   ============================================================ */

/* ⭐ ผนัง — 12 สี จาก ref */
export const WALL_COLOR_PALETTE = [
  0xfbf6ec, // ขาวนวล
  0xf3e6cf, // ครีม
  0xefd9bf, // ทราย
  0xe8c9b8, // ชมพูอิฐ
  0xddb5a8, // กุหลาบ
  0xcfe0d0, // มิ้นต์
  0xb8cdb3, // เขียวเสจ
  0xd5e3ea, // ฟ้าหมอก
  0xafc6d8, // ฟ้าใส
  0xebd98f, // เหลืองเนย
  0xc9b79f, // เทาน้ำตาล
  0x8e9bb0, // เทาน้ำเงิน
] as const;

/* ⭐ เพดาน — 6 สี จาก ref */
export const CEILING_COLOR_PALETTE = [
  0xffffff, // ขาว
  0xfbf6ec, // ขาวนวล
  0xf3e6cf, // ครีม
  0xe6eef3, // ฟ้าจาง
  0xf4e3dc, // ชมพูจาง
  0xe9e6f1, // ม่วงจาง
] as const;

/* ⭐ บัว — 8 สี คลาสสิก + ไม้ + เข้ม */
export const BASEBOARD_COLOR_PALETTE = [
  0xffffff, // ขาว
  0xfbf6ec, // ขาวนวล
  0xf3e6cf, // ครีม
  0xd8b07a, // ไม้โอ๊ค
  0x8b6f47, // วอลนัท
  0xa8a29a, // เทา
  0x4a4038, // น้ำตาลเข้ม
  0x2a2333, // ดำ
] as const;

export type BaseboardColor = (typeof BASEBOARD_COLOR_PALETTE)[number];

/* ⭐ สีพื้น — tint คูณกับลายวัสดุ (12 สี) */
export const FLOOR_TINT_PALETTE = [
  0xffffff, // ขาว (ไม่แต้ม — วัสดุเดิม)
  0xfdf4e3, // ครีม
  0xf5e0b8, // น้ำผึ้งอ่อน
  0xe8c896, // น้ำผึ้ง
  0xd4a574, // ไม้สัก
  0xb98860, // โอ๊คกลาง
  0x8b6547, // วอลนัท
  0x5c3f2a, // มะฮอกกานี
  0xd9d2c5, // เทาอ่อน
  0xa8a29a, // เทากลาง
  0x6b7a6b, // เขียวเสจ
  0x2f2a26, // ดำอุ่น
] as const;

export type FloorTintColor = (typeof FLOOR_TINT_PALETTE)[number];

export const WALL_COLORS = WALL_COLOR_PALETTE.slice(0, 4);

/* ============================================================
   Room defaults & limits
   ============================================================ */

export const ROOM_DEFAULT = {
  w: 4.2,
  d: 3.6,
  h: 2.6,
  shape: "rect" as const,
  blocks: null as Set<string> | null,
  cellSize: CELL_SIZE,
};

export const ROOM_LIMITS = {
  w: { min: 3.0, max: 12.0, step: 0.1 },
  d: { min: 3.0, max: 12.0, step: 0.1 },
  h: { min: 2.3, max: 3.2, step: 0.05 },
};

/* ============================================================
   Zone / Wall
   ============================================================ */

export const ZONE_ATTACH_MAX_DIST = 0.6;
export const ZONE_AMBIGUOUS_GAP = 0.4;

export const WALL_LABELS: Record<string, string> = {
  back: "หลัง",
  front: "หน้า",
  side: "ซ้าย",
  right: "ขวา",
};

export const WALL_LABEL_FULL: Record<string, string> = {
  back: "ผนังหลัง",
  front: "ผนังหน้า",
  side: "ผนังซ้าย",
  right: "ผนังขวา",
};

export const WALL_ROT_Y: Record<string, number> = {
  back: 0,
  side: Math.PI / 2,
  right: -Math.PI / 2,
  front: Math.PI,
};

export const WALL_MARGIN = 0.05;
export const WALL_V_MIN = 0.55;
export const WALL_OUTWARD = 0.012;
export const CEILING_CLEARANCE_MIN = 0.18;

/* ⭐ สีโซน — ดึงจาก ZONE_DEFINITIONS ก่อน เพื่อไม่ให้สี drift */
export const ZONE_COLOR_CHOICES = Array.from(
  new Set([
    ...ZONE_DEFINITIONS.map((z) => z.color),
    0xd9c7a8, 0xb8a4d4, 0xe6a878, 0x7ba4c9, 0xc998b8, 0x88b8a8,
  ]),
);

/* ============================================================
   Floors
   ============================================================ */

export const FLOOR_STYLES = [
  { id: "wood", name: "ไม้โอ๊ค" },
  { id: "walnut", name: "วอลนัท" },
  { id: "tile", name: "กระเบื้อง" },
  { id: "marble", name: "หินอ่อน" },
  { id: "concrete", name: "คอนกรีต" },
  { id: "carpet", name: "พรม" },
];

export const FLOOR_PALETTES: Record<
  string,
  { base: string; line: string; fine: string }
> = {
  wood: {
    base: "#CBAA7C",
    line: "rgba(90,60,30,0.20)",
    fine: "rgba(90,60,30,0.10)",
  },
  walnut: {
    base: "#6a4a30",
    line: "rgba(30,18,8,0.30)",
    fine: "rgba(30,18,8,0.16)",
  },
  tile: {
    base: "#e8e4dc",
    line: "rgba(120,116,108,0.45)",
    fine: "rgba(120,116,108,0.15)",
  },
  marble: {
    base: "#f2eee6",
    line: "rgba(160,150,130,0.50)",
    fine: "rgba(160,150,130,0.18)",
  },
  concrete: {
    base: "#b8b4ac",
    line: "rgba(90,88,84,0.18)",
    fine: "rgba(90,88,84,0.10)",
  },
  carpet: {
    base: "#a8b0a0",
    line: "rgba(70,80,65,0.15)",
    fine: "rgba(70,80,65,0.10)",
  },
};

/* ============================================================
   Gizmo
   ============================================================ */

export const GIZMO_SNAP_DEG = 15;
export const GIZMO_SNAP_THRESHOLD_DEG = 4;

/* ============================================================
   Levels
   ============================================================ */

export const LEVEL_PRESETS = [
  { id: "l0", label: "0", value: 0.0, color: "#e8dcc4" },
  { id: "l1", label: "+15", value: 0.15, color: "#dccfaf" },
  { id: "l2", label: "+30", value: 0.3, color: "#d0c09a" },
  { id: "l3", label: "+50", value: 0.5, color: "#c4b185" },
  { id: "l4", label: "+75", value: 0.75, color: "#b8a270" },
  { id: "l5", label: "+100", value: 1.0, color: "#ac935b" },
] as const;

export const LEVEL_MIN = 0.0;
export const LEVEL_MAX = 1.5;
export const LEVEL_STEP = 0.05;

/* ============================================================
   Room Setup — Progress Tracker (ใช้ใน RoomStructurePanel)
   ============================================================ */

export const ROOM_SETUP_TABS = [
  "size",
  "structure",
  "floor",
  "wall",
] as const;

export type RoomSetupTab = (typeof ROOM_SETUP_TABS)[number];

export interface RoomSetupStepDef {
  id: RoomSetupTab;
  num: number;
  label: string;
}

export const ROOM_SETUP_STEPS: RoomSetupStepDef[] = [
  { id: "size",      num: 1, label: "ขนาด" },
  { id: "structure", num: 2, label: "โครงสร้าง" },
  { id: "floor",     num: 3, label: "พื้น" },
  { id: "wall",      num: 4, label: "ผนัง" },
];

/** meta ของแต่ละ step — icon / title / desc / tint */
export const ROOM_SETUP_STEP_META: Record<
  RoomSetupTab,
  { icon: string; title: string; desc: string; tint: string }
> = {
  size: {
    icon: "📐",
    title: "ปรับขนาดห้อง",
    desc: "ทำผังห้อง Layout ได้ตามต้องการ",
    tint: "#C8A06E",
  },
  structure: {
    icon: "🚪",
    title: "วางโครงสร้างห้อง",
    desc: "ประตู หน้าต่าง ม่าน แอร์ — ลากไปวางบนผัง",
    tint: "#B4702B",
  },
  floor: {
    icon: "🟫",
    title: "เลือกวัสดุพื้น",
    desc: "แตะเพื่อเปลี่ยน ห้องจะอัปเดตทันที",
    tint: "#A5B58A",
  },
  wall: {
    icon: "🎨",
    title: "ทาสีผนัง",
    desc: "เลือกสี แล้วดูผลบนผนังในผัง",
    tint: "#E0A7C4",
  },
};

/** label ปุ่ม CTA ของแต่ละ step (index = step ที่ 0..3) */
export const ROOM_SETUP_CTA_LABEL = [
  "ต่อไป: วางโครงสร้าง ›",
  "ต่อไป: เลือกพื้น ›",
  "ต่อไป: ทาสีผนัง ›",
  "เสร็จแล้ว ไปเลือกของ ✓",
] as const;