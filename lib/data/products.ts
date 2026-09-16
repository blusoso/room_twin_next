// lib/data/products.ts
import type * as THREE from "three";
import * as B from "@/lib/three/builders";
import type { Params } from "@/lib/state/types";

export interface ProductDef {
  id: string;
  name: string;
  cat: string;
  dims: { w: number; d: number; h: number };
  price: number;
  color: number;
  build: (dims: any, color: any, opts?: any) => THREE.Group;
  /**
   * ⭐ คำค้น/คำพ้องสำหรับ smart search (ไทย + อังกฤษ)
   *    ใช้เฉพาะ lib/data/productSearch.ts — ไม่มีผลต่อ build()/geometry/serialized state
   */
  tags?: string[];
  surface?: number;
  rug?: boolean;
  wallMount?: boolean;
  ceilingMount?: boolean;
  groundAnchor?: boolean;
  structural?: boolean;
  /** ⭐ เป็นพื้นผิวให้ของติดผนังอื่นแขวนได้ (เสา/ฉากกั้น/ประตู/หน้าต่าง) */
  hostSurface?: boolean;
  /** ⭐ แขวนกับพื้นผิวของไอเทมอื่นได้ (กรอบภาพ/แอร์/ม่าน) */
  attachToSurface?: boolean;
  extraDefaults?: Record<string, any>;
}

export const PRODUCTS: ProductDef[] = [
  // ===== structure =====
  {
    id: "door",
    name: "ประตูห้อง",
    cat: "structure",
    tags: ["ประตู", "บานประตู", "door", "ทางเข้า", "entry"],
    dims: { w: 95, d: 6, h: 205 },
    price: 3200,
    color: 0xc9a776,
    build: B.buildDoor,
    wallMount: true,
    groundAnchor: true,
    hostSurface: true,
    extraDefaults: { frameColor: 0xf7f3ea },
  },
  {
    id: "window",
    name: "หน้าต่างบานกระจก",
    cat: "structure",
    tags: ["หน้าต่าง", "บานกระจก", "window", "กระจก", "glass"],
    dims: { w: 110, d: 6, h: 130 },
    price: 4200,
    color: 0xcfe0e8,
    build: B.buildWindow,
    wallMount: true,
    hostSurface: true,
    extraDefaults: {
      frameColor: 0xf7f3ea,
      glassColor: 0xcfe0e8,
      hasCurtains: false,
      curtainColor: 0xd8b7ae,
    },
  },

  // ===== sleep =====
  {
    id: "bed",
    name: "เตียงนอน 6 ฟุต",
    cat: "sleep",
    tags: ["เตียง", "เตียงนอน", "ที่นอน", "bed", "นอน", "ห้องนอน"],
    dims: { w: 160, d: 200, h: 95 },
    price: 8990,
    color: 0xd9c7a8,
    build: B.buildBed,
    extraDefaults: {
      baseColor: 0xede3cf,
      mattressColor: 0xfbf8f2,
      pillowColor: 0xffffff,
    },
  },
  {
    id: "armchair",
    name: "อาร์มแชร์ทรงกล่อง",
    cat: "sleep",
    tags: ["อาร์มแชร์", "เก้าอี้", "โซฟา", "sofa", "armchair", "chair", "นั่ง"],
    dims: { w: 75, d: 80, h: 85 },
    price: 6590,
    color: 0x7c9082,
    build: B.buildArmchair,
    extraDefaults: { legColor: 0x3a3138 },
  },
  {
    id: "bench",
    name: "ม้านั่งปลายเตียง",
    cat: "sleep",
    tags: ["ม้านั่ง", "ที่นั่ง", "bench", "ปลายเตียง", "นั่ง"],
    dims: { w: 110, d: 40, h: 45 },
    price: 2290,
    color: 0xd9cbb0,
    build: B.buildBench,
    surface: 1.0,
    extraDefaults: { legColor: 0x3a3138 },
  },
  {
    id: "stool",
    name: "สตูลเครื่องแป้ง",
    cat: "sleep",
    tags: ["สตูล", "เก้าอี้", "stool", "นั่ง", "เครื่องแป้ง"],
    dims: { w: 35, d: 35, h: 45 },
    price: 990,
    color: 0xc48b87,
    build: B.buildStool,
    extraDefaults: { poleColor: 0xb9a88f },
  },

  // ===== storage =====
  {
    id: "nightstand",
    name: "โต๊ะข้างเตียง",
    cat: "storage",
    tags: ["โต๊ะข้างเตียง", "โต๊ะ", "หัวเตียง", "nightstand", "เก็บของ"],
    dims: { w: 45, d: 40, h: 55 },
    price: 1290,
    color: 0x8fafa0,
    build: B.buildNightstand,
    surface: 1.0,
    extraDefaults: { drawerColor: 0xf2e9dc, knobColor: 0x8a6a4f },
  },
  {
    id: "wardrobe",
    name: "ตู้เสื้อผ้าบานเลื่อน",
    cat: "storage",
    tags: ["ตู้เสื้อผ้า", "ตู้", "wardrobe", "เสื้อผ้า", "บานเลื่อน", "เก็บของ"],
    dims: { w: 150, d: 60, h: 200 },
    price: 12900,
    color: 0xb9a88f,
    build: B.buildWardrobe,
    surface: 1.0,
    extraDefaults: { doorGapColor: 0x8f7c5c, handleColor: 0xe8dcc4 },
  },
  {
    id: "dressing",
    name: "โต๊ะเครื่องแป้ง + กระจก",
    cat: "storage",
    tags: [
      "โต๊ะเครื่องแป้ง",
      "โต๊ะ",
      "กระจก",
      "แต่งตัว",
      "vanity",
      "dressing",
    ],
    dims: { w: 90, d: 45, h: 140 },
    price: 5490,
    color: 0xd8b7ae,
    build: B.buildDressing,
    surface: 0.53,
    extraDefaults: {
      legColor: 0xd8b7ae,
      mirrorFrameColor: 0xc9a15a,
      mirrorGlassColor: 0xcfe0e8,
    },
  },
  {
    id: "bookshelf",
    name: "ชั้นวางหนังสือ 4 ชั้น",
    cat: "storage",
    tags: ["ชั้นวางหนังสือ", "ชั้น", "หนังสือ", "bookshelf", "shelf", "จัดเก็บ"],
    dims: { w: 80, d: 30, h: 180 },
    price: 3290,
    color: 0x8a6a4f,
    build: B.buildBookshelf,
    surface: 1.0,
    extraDefaults: { backColor: 0xe8dcc4 },
  },
  {
    id: "desk",
    name: "โต๊ะทำงานไม้",
    cat: "storage",
    tags: ["โต๊ะทำงาน", "โต๊ะ", "ทำงาน", "desk", "study", "เขียนหนังสือ"],
    dims: { w: 110, d: 55, h: 75 },
    price: 3990,
    color: 0xc9a776,
    build: B.buildDesk,
    surface: 0.97,
    extraDefaults: { legColor: 0x3a3138 },
  },
  {
    id: "officechair",
    name: "เก้าอี้ทำงาน",
    cat: "storage",
    tags: ["เก้าอี้ทำงาน", "เก้าอี้", "chair", "office chair", "ทำงาน", "นั่ง"],
    dims: { w: 55, d: 55, h: 95 },
    price: 2590,
    color: 0x4a4550,
    build: B.buildOfficeChair,
    extraDefaults: { poleColor: 0x2a2330 },
  },

  // ===== light =====
  {
    id: "floorlamp",
    name: "โคมไฟตั้งพื้นทรงกลม",
    cat: "light",
    tags: ["โคมไฟ", "โคมไฟตั้งพื้น", "โคม", "lamp", "floor lamp", "ไฟ", "แสงสว่าง"],
    dims: { w: 35, d: 35, h: 150 },
    price: 1590,
    color: 0xc9a15a,
    build: B.buildFloorLamp,
    extraDefaults: { baseColor: 0x3a3138, poleColor: 0xb8862b },
  },
  {
    id: "tablelamp",
    name: "โคมไฟตั้งโต๊ะเซรามิก",
    cat: "light",
    tags: ["โคมไฟ", "โคมไฟตั้งโต๊ะ", "โคม", "lamp", "table lamp", "ไฟ", "แสงสว่าง"],
    dims: { w: 20, d: 20, h: 40 },
    price: 890,
    color: 0xe8dcc4,
    build: B.buildTableLamp,
    extraDefaults: { baseColor: 0xe0d4bc, poleColor: 0xc9a15a },
  },
  {
    id: "mirror",
    name: "กระจกเงาตั้งพื้น",
    cat: "light",
    tags: ["กระจก", "กระจกเงา", "mirror", "ตั้งพื้น", "เงา"],
    dims: { w: 50, d: 5, h: 160 },
    price: 2190,
    color: 0xb8862b,
    build: B.buildMirror,
    extraDefaults: { glassColor: 0xcfe0e8, footColor: 0x3a3138 },
  },
  {
    id: "wallart",
    name: "กรอบภาพติดผนัง",
    cat: "light",
    tags: ["กรอบภาพ", "กรอบรูป", "ภาพ", "wall art", "รูป", "ตกแต่งผนัง"],
    dims: { w: 50, d: 4, h: 70 },
    price: 590,
    color: 0x2a2330,
    build: B.buildWallArt,
    wallMount: true,
    attachToSurface: true,
    extraDefaults: { canvasColor: 0xd8b7ae, accentColor: 0x8fafa0 },
  },
  {
    id: "plant",
    name: "ต้นไม้กระถางตกแต่ง",
    cat: "light",
    tags: ["ต้นไม้", "กระถาง", "plant", "ต้นไม้ประดับ", "ตกแต่ง", "ต้น"],
    dims: { w: 40, d: 40, h: 100 },
    price: 690,
    color: 0xb9705a,
    build: B.buildPlant,
    extraDefaults: { trunkColor: 0x6b4a2e },
  },

  // ===== floor =====
  {
    id: "roundrug",
    name: "พรมปูพื้นทรงกลม",
    cat: "floor",
    tags: ["พรม", "พรมกลม", "rug", "ปูพื้น", "ทรงกลม"],
    dims: { w: 150, d: 150, h: 2 },
    price: 1290,
    color: 0xc4886e,
    build: B.buildRoundRug,
    rug: true,
  },
  {
    id: "rectrug",
    name: "พรมปูพื้นทรงเหลี่ยม",
    cat: "floor",
    tags: ["พรม", "พรมเหลี่ยม", "rug", "ปูพื้น", "ทรงเหลี่ยม"],
    dims: { w: 160, d: 230, h: 2 },
    price: 1890,
    color: 0x5f7a63,
    build: B.buildRectRug,
    rug: true,
  },
  {
    id: "pouf",
    name: "พัฟเก็บของทรงกลม",
    cat: "floor",
    tags: ["พัฟ", "เบาะ", "pouf", "นั่ง", "เก็บของ", "ทรงกลม"],
    dims: { w: 45, d: 45, h: 40 },
    price: 1190,
    color: 0xd9b679,
    build: B.buildPouf,
  },

  // ===== ceiling =====
  {
    id: "pendantlamp",
    name: "โคมไฟแขวนเพดาน",
    cat: "ceiling",
    tags: ["โคมไฟ", "โคมไฟแขวน", "โคม", "pendant", "lamp", "ไฟ", "เพดาน"],
    dims: { w: 32, d: 32, h: 55 },
    price: 1490,
    color: 0xc9a15a,
    build: B.buildPendantLamp,
    ceilingMount: true,
    extraDefaults: { cordColor: 0x3a3138, bulbColor: 0xffe9b8 },
  },
  {
    id: "ceilingfan",
    name: "พัดลมเพดาน",
    cat: "ceiling",
    tags: ["พัดลม", "พัดลมเพดาน", "fan", "ceiling fan", "เพดาน", "ลม"],
    dims: { w: 105, d: 105, h: 32 },
    price: 3290,
    color: 0x8a6a4f,
    build: B.buildCeilingFan,
    ceilingMount: true,
    extraDefaults: { motorColor: 0x4a4550, rodColor: 0x3a3138 },
  },
  {
    id: "downlight",
    name: "ไฟดาวน์ไลท์ฝังฝ้า",
    cat: "ceiling",
    tags: ["ไฟดาวน์ไลท์", "ไฟฝังฝ้า", "downlight", "ไฟ", "เพดาน", "สปอตไลท์"],
    dims: { w: 16, d: 16, h: 6 },
    price: 390,
    color: 0xe8dcc4,
    build: B.buildDownlight,
    ceilingMount: true,
    extraDefaults: { trimColor: 0x3a3138 },
  },
  {
    id: "hangingplant",
    name: "กระถางไม้แขวนเพดาน",
    cat: "ceiling",
    tags: ["กระถางแขวน", "ไม้แขวน", "hanging plant", "ต้นไม้", "เพดาน", "ตกแต่ง"],
    dims: { w: 28, d: 28, h: 48 },
    price: 790,
    color: 0x8a6a4f,
    build: B.buildHangingPlant,
    ceilingMount: true,
    extraDefaults: { cordColor: 0x3a3138 },
  },
  // ===== fixtures (ม่าน & แอร์) =====
  {
    id: "curtain",
    name: "ม่านแขวนผนัง",
    cat: "fixtures",
    tags: ["ม่าน", "ผ้าม่าน", "curtain", "ม่านผนัง", "ผ้า"],
    dims: { w: 150, d: 4, h: 240 },
    price: 890,
    color: 0xd8b7ae,
    build: B.buildCurtain,
    wallMount: true,
    groundAnchor: true,
    attachToSurface: true,
    extraDefaults: { foldColor: 0xc9a88f },
  },
  {
    id: "ac",
    name: "แอร์ติดผนัง",
    cat: "fixtures",
    tags: ["แอร์", "เครื่องปรับอากาศ", "air conditioner", "ac", "ติดผนัง", "เย็น"],
    dims: { w: 80, d: 22, h: 30 },
    price: 12900,
    color: 0xe8e8e8,
    build: B.buildAc,
    wallMount: true,
    attachToSurface: true,
    extraDefaults: { ventColor: 0x4a4550 },
  },

  // ===== room structure =====
  {
    id: "column",
    name: "เสาโครงสร้าง",
    cat: "structure",
    tags: ["เสา", "เสาโครงสร้าง", "column", "pillar", "โครงสร้าง"],
    dims: { w: 30, d: 30, h: 260 },
    price: 4500,
    color: 0xe8dcc4,
    build: B.buildColumn,
    structural: true,
    hostSurface: true,
    extraDefaults: {
      baseColor: 0xf7f3ea,
      accentColor: 0xb9a88f,
    },
  },
  {
    id: "partition",
    name: "ฉากกั้นห้อง",
    cat: "structure",
    tags: ["ฉากกั้น", "ฉากกั้นห้อง", "partition", "กั้นห้อง", "โครงสร้าง"],
    dims: { w: 120, d: 8, h: 200 },
    price: 5990,
    color: 0xf0ece4,
    build: B.buildPartition,
    structural: true,
    hostSurface: true,
    extraDefaults: {
      frameColor: 0xb9a88f,
    },
  },
  {
    id: "stairs",
    name: "บันไดตรงพื้นฐาน",
    cat: "structure",
    tags: ["บันได", "stairs", "ขั้นบันได", "โครงสร้าง"],
    dims: { w: 90, d: 180, h: 100 },
    price: 8900,
    color: 0xc9a776,
    build: B.buildStairs,
    structural: true,
    extraDefaults: {
      treadColor: 0xd9c7a8,
    },
  },
    // ⭐ เพิ่ม sliding door ต่อจาก stairs
  {
    id: "slidingdoor",
    name: "ประตูระเบียงบานเลื่อน",
    cat: "structure",
    tags: ["ประตูเลื่อน", "ประตูบานเลื่อน", "ประตูระเบียง", "ประตู", "sliding door"],
    dims: { w: 180, d: 8, h: 210 },
    price: 15900,
    color: 0xb9a88f,
    build: B.buildSlidingDoor,
    wallMount: true,
    groundAnchor: true,
    hostSurface: true,
    extraDefaults: {
      frameColor: 0xf7f3ea,
      glassColor: 0xcfe0e8,
    },
  },
];

export const PRODUCT_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

/** ⭐ หมวดที่ห้ามจัดเข้าโซนอัตโนมัติ (โครงสร้างพื้นฐาน + ม่าน & แอร์) */
export const AUTO_ZONE_EXCLUDED_CATS = new Set(["structure", "fixtures"]);

/**
 * ⭐ ไอเทมกลุ่มโครงสร้าง (ประตู/หน้าต่าง/เสา/ฉากกั้น/บันได) และม่าน & แอร์
 *    ต้องไม่ถูกจัดเข้าโซนอัตโนมัติเมื่อวางบนพื้น
 *    (การลากเข้าโซนเองของผู้ใช้ยังทำได้ตามเดิม)
 */
export function isAutoZoneExcludedProduct(productId: string): boolean {
  const p = PRODUCT_BY_ID.get(productId);
  return !!p && AUTO_ZONE_EXCLUDED_CATS.has(p.cat);
}

/**
 * ⭐ ไอเทมนี้เป็น "พื้นผิว" ให้ของติดผนังอื่นแขวนได้หรือไม่
 *    (เสา / ฉากกั้น / ประตู / ประตูเลื่อน / หน้าต่าง)
 */
export function isHostSurfaceProduct(productId: string): boolean {
  return !!PRODUCT_BY_ID.get(productId)?.hostSurface;
}

/**
 * ⭐ ไอเทมนี้แขวนกับพื้นผิวของไอเทมอื่นได้หรือไม่
 *    (กรอบภาพ / แอร์ / ม่าน) — ประตู/หน้าต่างยังติดได้แค่ผนังห้อง
 */
export function isAttachToSurfaceProduct(productId: string): boolean {
  return !!PRODUCT_BY_ID.get(productId)?.attachToSurface;
}

export function defaultParamsFor(product: ProductDef): Params {
  const p: Params = {
    w: product.dims.w,
    d: product.dims.d,
    h: product.dims.h,
    color: product.color,
  };
  if (product.extraDefaults) Object.assign(p, product.extraDefaults);
  return p;
}
