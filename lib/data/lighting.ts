// lib/data/lighting.ts
//
// ⭐ แหล่งข้อมูลเดียวของ "โหมดแสงในฉาก" และสเปกไฟของโคมแต่ละชนิด
//    - LIGHTING_PRESETS : ค่า sun/sky/background/fog/exposure/envMapIntensity ต่อโหมด
//    - LAMP_LIGHT_SPECS : ไฟจริง (Point/SpotLight) ที่ผูกกับสินค้าหมวดโคม
//
//    ไฟล์นี้ไม่แตะ serialized state — ยกเว้นการเปิด/ปิดไฟต่อโคมที่เก็บใน
//    params.lightOn ของสินค้า (ดู products.ts + schemas.ts)

export type LightingMode = "day" | "evening" | "night";

export const LIGHTING_MODES: LightingMode[] = ["day", "evening", "night"];

export const LIGHTING_MODE_LABELS: Record<LightingMode, string> = {
  day: "☀️ วัน",
  evening: "🌆 เย็น",
  night: "🌙 คืน",
};

export const LIGHTING_MODE_TITLES: Record<LightingMode, string> = {
  day: "แสงกลางวันที่สว่างนุ่ม",
  evening: "แสงเย็น โทนอบอุ่น เงายาวขึ้น",
  night: "โหมดกลางคืน — แดดดับ เปิดไฟในห้องอัตโนมัติ",
};

export interface LightingPreset {
  /** สีพื้นหลังฉาก */
  background: number;
  /** ช่วง fog (เมตร) — สีเดียวกับ background */
  fog: { near: number; far: number };
  /** toneMappingExposure ของ renderer */
  exposure: number;
  hemi: { sky: number; ground: number; intensity: number };
  sun: { color: number; intensity: number; pos: [number, number, number] };
  fill: { color: number; intensity: number; pos: [number, number, number] };
  /** envMapIntensity ของวัสดุห้อง (ผนัง/พื้น/เพดาน/บัว) */
  envRoom: number;
  /** envMapIntensity ของวัสดุเฟอร์นิเจอร์ */
  envItem: number;
  /** ตัวคูณความเข้มไฟโคม (ให้โคมดูสว่างขึ้นในโหมดมืด) */
  lampScale: number;
}

export const LIGHTING_PRESETS: Record<LightingMode, LightingPreset> = {
  day: {
    background: 0xede4d2,
    fog: { near: 22, far: 52 },
    exposure: 1.02,
    hemi: { sky: 0xfff3e0, ground: 0xcfc6b0, intensity: 0.75 },
    sun: { color: 0xfff2df, intensity: 1.05, pos: [-3.2, 4.5, 2.6] },
    fill: { color: 0xd9e3f0, intensity: 0.28, pos: [3, 2, -2] },
    envRoom: 0.35,
    envItem: 0.6,
    lampScale: 1.0,
  },
  evening: {
    background: 0xd9bda4,
    fog: { near: 20, far: 48 },
    exposure: 1.06,
    hemi: { sky: 0xffe0bb, ground: 0xb59a86, intensity: 0.55 },
    sun: { color: 0xffb87a, intensity: 0.9, pos: [-4.2, 2.6, 2.2] },
    fill: { color: 0xbcd0e8, intensity: 0.22, pos: [3, 2, -2] },
    envRoom: 0.28,
    envItem: 0.5,
    lampScale: 1.15,
  },
  night: {
    background: 0x161a24,
    fog: { near: 18, far: 44 },
    exposure: 1.15,
    hemi: { sky: 0x2c3550, ground: 0x11141c, intensity: 0.28 },
    sun: { color: 0x9fb6e0, intensity: 0.14, pos: [-2.4, 4.6, 2.0] },
    fill: { color: 0x33405e, intensity: 0.12, pos: [3, 2, -2] },
    envRoom: 0.1,
    envItem: 0.22,
    lampScale: 1.35,
  },
};

// ============================================================
// ไฟของโคม (PointLight / SpotLight)
// ============================================================

export type LampLightKind = "point" | "spot";

export interface LampLightSpec {
  kind: LampLightKind;
  color: number;
  /**
   * ความเข้ม (หน่วยกายภาพ — three r155+ ไม่ใช้ legacy lights)
   * ปรับค่านี้ได้ที่ไฟล์นี้ไฟล์เดียว
   */
  intensity: number;
  /** ระยะที่แสงตกถึง (เมตร) */
  distance: number;
  decay: number;
  /** เฉพาะ spot */
  angle?: number;
  penumbra?: number;
  /** เฉพาะ spot — ตำแหน่งเป้าไฟใน local Y ของ anchor */
  targetY?: number;
}

export const LAMP_LIGHT_SPECS: Record<string, LampLightSpec> = {
  floorlamp: {
    kind: "point",
    color: 0xffd9a0,
    intensity: 9,
    distance: 9,
    decay: 2,
  },
  tablelamp: {
    kind: "point",
    color: 0xffd9a0,
    intensity: 4,
    distance: 6,
    decay: 2,
  },
  pendantlamp: {
    kind: "point",
    color: 0xffe3b8,
    intensity: 8,
    distance: 8,
    decay: 2,
  },
  downlight: {
    kind: "spot",
    color: 0xfff0cf,
    intensity: 12,
    distance: 8,
    decay: 2,
    angle: 0.5,
    penumbra: 0.7,
    targetY: -1,
  },
};

/** productId ของโคมที่มีไฟจริง */
export const LAMP_PRODUCT_IDS = new Set(Object.keys(LAMP_LIGHT_SPECS));

/** เพดานจำนวนไฟจริงในฉาก (เกินนี้ยังมี glow แต่ไม่มีแสงตก) */
export const MAX_LAMP_LIGHTS = 16;

/** ค่า emissive ของหลอด/โป๊ะ เมื่อเปิด-ปิดไฟ */
export const LAMP_BULB_EMISSIVE_ON = 2.4;
export const LAMP_BULB_EMISSIVE_OFF = 0.4;
export const LAMP_SHADE_EMISSIVE_ON = 0.18;

export function isLightingMode(v: unknown): v is LightingMode {
  return v === "day" || v === "evening" || v === "night";
}
