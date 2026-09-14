// lib/data/themes.ts

export interface ZoneTheme {
  id: string;
  name: string;
  desc: string;
  swatch: number[];
  primary: number;
  secondary: number;
  accent: number;
  wood: number;
  neutral: number;
  dark: number;
  canvas: number;
  style: Record<string, any>;
}

export const ZONE_THEMES: ZoneTheme[] = [
  {
    id: "scandinavian",
    name: "สแกนดิเนเวียน",
    desc: "โอ๊คอ่อน · ผ้าลินิน · มินิมัล",
    swatch: [0xc9a776, 0xf5f0e6, 0x8fafa0, 0x3a3138],
    primary: 0x8fafa0,
    secondary: 0xf5f0e6,
    accent: 0x8fafa0,
    wood: 0xc9a776,
    neutral: 0xf5f0e6,
    dark: 0x3a3138,
    canvas: 0xe8dcc4,
    style: {
      bedHead: "slats",
      bedPlatform: 0.35,
      mattressH: 0.2,
      lampShade: "cone",
      lampBase: "metal",
      chairType: "wood-frame",
      shelfType: "open-thin",
      deskType: "slim",
      legType: "tapered",
      rugType: "flat",
      potType: "ceramic",
    },
  },
  {
    id: "muji",
    name: "มูจิ",
    desc: "ไม้ธรรมชาติ · กระดาษ · 謙虚",
    swatch: [0xb5a48a, 0xf0ece4, 0xa6b0a0, 0x2c2823],
    primary: 0xa6b0a0,
    secondary: 0xe5dfd2,
    accent: 0xb5a48a,
    wood: 0xb5a48a,
    neutral: 0xf0ece4,
    dark: 0x2c2823,
    canvas: 0xd8cfc0,
    style: {
      bedHead: "low-panel",
      bedPlatform: 0.22,
      mattressH: 0.16,
      lampShade: "paper-cylinder",
      lampBase: "thin-metal",
      chairType: "low-block",
      shelfType: "box",
      deskType: "straight",
      legType: "straight-wood",
      rugType: "jute",
      potType: "clay-simple",
    },
  },
  {
    id: "boho",
    name: "โบโฮ",
    desc: "หวาย · เทอร์รา · อบอุ่น",
    swatch: [0xc4886e, 0xd9b679, 0x8a6a4f, 0x3a3138],
    primary: 0xc4886e,
    secondary: 0xd9b679,
    accent: 0x8a6a4f,
    wood: 0xa8896a,
    neutral: 0xe8dcc4,
    dark: 0x3a3138,
    canvas: 0xb9705a,
    style: {
      bedHead: "rattan",
      bedPlatform: 0.32,
      mattressH: 0.22,
      lampShade: "woven-dome",
      lampBase: "rattan",
      chairType: "wide-arms",
      shelfType: "open-woven",
      deskType: "chunky",
      legType: "turned",
      rugType: "tassel",
      potType: "terracotta",
    },
  },
  {
    id: "coastal",
    name: "โคสทัล",
    desc: "ขาว · ผ้าลินิน · ฟ้าทะเล",
    swatch: [0xf0f4f8, 0xa8c8dc, 0xd8c8a8, 0x4a5a68],
    primary: 0xa8c8dc,
    secondary: 0xf0f4f8,
    accent: 0x8aa8b8,
    wood: 0xd8c8a8,
    neutral: 0xfbfdff,
    dark: 0x4a5a68,
    canvas: 0xa8c8dc,
    style: {
      bedHead: "upholstered",
      bedPlatform: 0.3,
      mattressH: 0.2,
      lampShade: "drum",
      lampBase: "ceramic-white",
      chairType: "slipcover",
      shelfType: "white-box",
      deskType: "whitewash",
      legType: "whitewashed",
      rugType: "striped",
      potType: "ceramic-white",
    },
  },
];

export const THEME_BY_ID = new Map(ZONE_THEMES.map((t) => [t.id, t]));

export const THEME_COLOR_MAP: Record<string, string | null> = {
  color: "primary",
  baseColor: "wood",
  mattressColor: "neutral",
  pillowColor: "neutral",
  legColor: "dark",
  poleColor: "dark",
  footColor: "dark",
  knobColor: "dark",
  frameColor: "secondary",
  handleColor: "accent",
  drawerColor: "secondary",
  doorGapColor: "wood",
  backColor: "neutral",
  mirrorFrameColor: "accent",
  mirrorGlassColor: null,
  glassColor: null,
  curtainColor: "secondary",
  canvasColor: "canvas",
  accentColor: "accent",
  cordColor: "dark",
  motorColor: "dark",
  rodColor: "dark",
  trimColor: "dark",
  bulbColor: null,
  trunkColor: null,
};

export const WOOD_MAIN_PRODUCTS = new Set([
  "desk",
  "bookshelf",
  "wardrobe",
  "nightstand",
  "dressing",
  "mirror",
  "door",
]);

export function getThemeStyle(id: string | undefined | null) {
  if (!id) return null;
  const t = THEME_BY_ID.get(id);
  return t ? t.style : null;
}

const THEME_DISPLAY_MAP: Record<string, Record<string, string>> = {
  scandinavian: {
    bed: "เตียงนอนสแกนดิ",
    tablelamp: "โคมไฟสแกนดิ",
    armchair: "อาร์มแชร์สแกนดิ",
    desk: "โต๊ะสแกนดิ",
    officechair: "เก้าอี้สแกนดิ",
    bookshelf: "ชั้นวางสแกนดิ",
    nightstand: "โต๊ะข้างสแกนดิ",
    floorlamp: "โคมไฟพื้นสแกนดิ",
    roundrug: "พรมสแกนดิ",
    rectrug: "พรมสแกนดิ",
    plant: "ต้นไม้สแกนดิ",
  },
  muji: {
    bed: "เตียงมูจิ",
    tablelamp: "โคมไฟกระดาษมูจิ",
    armchair: "อาร์มแชร์มูจิ",
    desk: "โต๊ะมูจิ",
    officechair: "เก้าอี้มูจิ",
    bookshelf: "ชั้นวางมูจิ",
    nightstand: "โต๊ะข้างมูจิ",
    floorlamp: "โคมไฟพื้นมูจิ",
    roundrug: "พรมป่านมูจิ",
    rectrug: "พรมป่านมูจิ",
    plant: "ต้นไม้มูจิ",
  },
  boho: {
    bed: "เตียงหวายโบโฮ",
    tablelamp: "โคมหวายโบโฮ",
    armchair: "อาร์มแชร์โบโฮ",
    desk: "โต๊ะโบโฮ",
    officechair: "เก้าอี้โบโฮ",
    bookshelf: "ชั้นวางโบโฮ",
    nightstand: "โต๊ะข้างโบโฮ",
    floorlamp: "โคมไผ่โบโฮ",
    roundrug: "พรมปอมโบโฮ",
    rectrug: "พรมปอมโบโฮ",
    plant: "ต้นไม้โบโฮ",
  },
  coastal: {
    bed: "เตียงโคสทัล",
    tablelamp: "โคมเซรามิกโคสทัล",
    armchair: "อาร์มแชร์โคสทัล",
    desk: "โต๊ะโคสทัล",
    officechair: "เก้าอี้โคสทัล",
    bookshelf: "ชั้นวางโคสทัล",
    nightstand: "โต๊ะข้างโคสทัล",
    floorlamp: "โคมพื้นโคสทัล",
    roundrug: "พรมลายเรือ",
    rectrug: "พรมลายเรือ",
    plant: "ต้นไม้โคสทัล",
  },
};

export function themeDisplayName(
  pid: string,
  tid: string | null | undefined,
): string | null {
  if (!tid) return null;
  return (THEME_DISPLAY_MAP[tid] && THEME_DISPLAY_MAP[tid][pid]) || null;
}

export function themedSwatchColor(pid: string, tid: string): number {
  const t = THEME_BY_ID.get(tid);
  if (!t) return 0xcccccc;
  return WOOD_MAIN_PRODUCTS.has(pid) ? t.wood : t.primary;
}