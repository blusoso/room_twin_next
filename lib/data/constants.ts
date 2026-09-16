// lib/data/constants.ts
import { ZONE_DEFINITIONS } from "./zones";

export const CATEGORIES = [
  { id: "zone", label: "🏠 โซนสำเร็จรูป" },
  { id: "structure", label: "🧱 โครงสร้างพื้นฐาน" },
  { id: "sleep", label: "🛏️ เตียง & ที่นั่ง" },
  { id: "storage", label: "🗄️ โต๊ะ & จัดเก็บ" },
  { id: "light", label: "💡 โคมไฟ & ตกแต่ง" },
  { id: "fixtures", label: "🔧 ม่าน & แอร์" },
  { id: "floor", label: "🟫 พรม & อื่นๆ" },
  { id: "ceiling", label: "⬜ เพดาน" },
] as const;

export const CELL_SIZE = 0.5;
export const GRID = 0.1;
export const STORAGE_KEY = "roomtwin_state_v11";

// ⭐ แหล่งเดียวของสีผนัง — ใช้ร่วมกันทั้ง header/panel/per-wall/คัสตอม
export const WALL_COLOR_PALETTE = [
  0xf2e9dc, 0xdce6dd, 0xe7d6cc, 0xd7dee6, 0xf5efe3, 0xc8d4c0,
  0xe8d0c0, 0xc0cedc, 0xd4c4ac, 0xbfc9b4, 0xe6d0c6, 0xa8b4c0,
];

export const WALL_COLORS = WALL_COLOR_PALETTE.slice(0, 4);

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

// ⭐ สีเริ่มต้นของแต่ละโซนใน palette ต้องมาจาก ZONE_DEFINITIONS (กันสี drift กับ definition)
export const ZONE_COLOR_CHOICES = Array.from(
  new Set([
    ...ZONE_DEFINITIONS.map((z) => z.color),
    0xd9c7a8, 0xb8a4d4, 0xe6a878, 0x7ba4c9, 0xc998b8, 0x88b8a8,
  ]),
);

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

export const GIZMO_SNAP_DEG = 15;
export const GIZMO_SNAP_THRESHOLD_DEG = 4;

// ⭐ ระดับความสูงของพื้น
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