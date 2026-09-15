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
  surface?: number;
  rug?: boolean;
  wallMount?: boolean;
  ceilingMount?: boolean;
  groundAnchor?: boolean;
  extraDefaults?: Record<string, any>;
}

export const PRODUCTS: ProductDef[] = [
  // ===== structure =====
  {
    id: "door",
    name: "ประตูห้อง",
    cat: "structure",
    dims: { w: 95, d: 6, h: 205 },
    price: 3200,
    color: 0xc9a776,
    build: B.buildDoor,
    wallMount: true,
    groundAnchor: true,
    extraDefaults: { frameColor: 0xf7f3ea },
  },
  {
    id: "window",
    name: "หน้าต่างบานกระจก",
    cat: "structure",
    dims: { w: 110, d: 6, h: 130 },
    price: 4200,
    color: 0xcfe0e8,
    build: B.buildWindow,
    wallMount: true,
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
    dims: { w: 50, d: 4, h: 70 },
    price: 590,
    color: 0x2a2330,
    build: B.buildWallArt,
    wallMount: true,
    extraDefaults: { canvasColor: 0xd8b7ae, accentColor: 0x8fafa0 },
  },
  {
    id: "plant",
    name: "ต้นไม้กระถางตกแต่ง",
    cat: "light",
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
    dims: { w: 28, d: 28, h: 48 },
    price: 790,
    color: 0x8a6a4f,
    build: B.buildHangingPlant,
    ceilingMount: true,
    extraDefaults: { cordColor: 0x3a3138 },
  },
  // ===== room structure =====
  {
    id: "column",
    name: "เสาโครงสร้าง",
    cat: "structure",
    dims: { w: 30, d: 30, h: 260 },
    price: 4500,
    color: 0xe8dcc4,
    build: B.buildColumn,
    extraDefaults: {
      baseColor: 0xf7f3ea,
      accentColor: 0xb9a88f,
    },
  },
  {
    id: "partition",
    name: "ฉากกั้นห้อง",
    cat: "structure",
    dims: { w: 120, d: 8, h: 200 },
    price: 5990,
    color: 0xf0ece4,
    build: B.buildPartition,
    extraDefaults: {
      frameColor: 0xb9a88f,
    },
  },
  {
    id: "stairs",
    name: "บันไดตรงพื้นฐาน",
    cat: "structure",
    dims: { w: 90, d: 180, h: 100 },
    price: 8900,
    color: 0xc9a776,
    build: B.buildStairs,
    extraDefaults: {
      treadColor: 0xd9c7a8,
    },
  },
];

export const PRODUCT_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

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
