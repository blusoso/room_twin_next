// lib/data/schemas.ts

export interface DimDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

export interface ColorDef {
  key: string;
  label: string;
}

export interface BoolDef {
  key: string;
  label: string;
}

export interface ParamSchema {
  dims?: DimDef[];
  colors?: ColorDef[];
  bools?: BoolDef[];
}

export const PARAM_SCHEMA: Record<string, ParamSchema> = {
  door: {
    dims: [
      { key: "w", label: "กว้าง", min: 60, max: 180, step: 5 },
      { key: "h", label: "สูง", min: 150, max: 260, step: 5 },
    ],
    colors: [
      { key: "color", label: "สีบานประตู" },
      { key: "frameColor", label: "สีวงกบ" },
    ],
  },
  window: {
    dims: [
      { key: "w", label: "กว้าง", min: 40, max: 260, step: 5 },
      { key: "h", label: "สูง", min: 40, max: 200, step: 5 },
    ],
    colors: [
      { key: "frameColor", label: "สีกรอบ" },
      { key: "glassColor", label: "สีกระจก" },
      { key: "curtainColor", label: "สีผ้าม่าน" },
    ],
    bools: [{ key: "hasCurtains", label: "มีผ้าม่าน" }],
  },
  bed: {
    dims: [
      { key: "w", label: "กว้าง", min: 90, max: 220, step: 5 },
      { key: "d", label: "ยาว", min: 170, max: 240, step: 5 },
      { key: "h", label: "สูงหัวเตียง", min: 60, max: 140, step: 5 },
    ],
    colors: [
      { key: "color", label: "หัวเตียง" },
      { key: "baseColor", label: "ฐานเตียง" },
      { key: "mattressColor", label: "ที่นอน" },
      { key: "pillowColor", label: "หมอน" },
    ],
  },
  armchair: {
    dims: [
      { key: "w", label: "กว้าง", min: 55, max: 110, step: 5 },
      { key: "d", label: "ลึก", min: 55, max: 110, step: 5 },
      { key: "h", label: "สูง", min: 60, max: 120, step: 5 },
    ],
    colors: [
      { key: "color", label: "เบาะ/พนัก" },
      { key: "legColor", label: "ขา" },
    ],
  },
  bench: {
    dims: [
      { key: "w", label: "กว้าง", min: 60, max: 180, step: 5 },
      { key: "d", label: "ลึก", min: 30, max: 70, step: 5 },
      { key: "h", label: "สูง", min: 30, max: 70, step: 5 },
    ],
    colors: [
      { key: "color", label: "เบาะ" },
      { key: "legColor", label: "ขา" },
    ],
  },
  stool: {
    dims: [
      { key: "w", label: "กว้าง", min: 25, max: 55, step: 5 },
      { key: "h", label: "สูง", min: 30, max: 70, step: 5 },
    ],
    colors: [
      { key: "color", label: "เบาะ" },
      { key: "poleColor", label: "ขา" },
    ],
  },
  nightstand: {
    dims: [
      { key: "w", label: "กว้าง", min: 30, max: 80, step: 5 },
      { key: "d", label: "ลึก", min: 30, max: 60, step: 5 },
      { key: "h", label: "สูง", min: 40, max: 80, step: 5 },
    ],
    colors: [
      { key: "color", label: "ตัวตู้" },
      { key: "drawerColor", label: "ลิ้นชัก" },
      { key: "knobColor", label: "มือจับ" },
    ],
  },
  wardrobe: {
    dims: [
      { key: "w", label: "กว้าง", min: 90, max: 260, step: 5 },
      { key: "d", label: "ลึก", min: 45, max: 80, step: 5 },
      { key: "h", label: "สูง", min: 180, max: 260, step: 5 },
    ],
    colors: [
      { key: "color", label: "บานตู้" },
      { key: "doorGapColor", label: "ร่องกลาง" },
      { key: "handleColor", label: "มือจับ" },
    ],
  },
  dressing: {
    dims: [
      { key: "w", label: "กว้าง", min: 60, max: 140, step: 5 },
      { key: "d", label: "ลึก", min: 35, max: 70, step: 5 },
      { key: "h", label: "สูง", min: 120, max: 180, step: 5 },
    ],
    colors: [
      { key: "color", label: "ตัวโต๊ะ" },
      { key: "mirrorFrameColor", label: "กรอบกระจก" },
      { key: "mirrorGlassColor", label: "กระจก" },
    ],
  },
  bookshelf: {
    dims: [
      { key: "w", label: "กว้าง", min: 50, max: 180, step: 5 },
      { key: "d", label: "ลึก", min: 20, max: 50, step: 5 },
      { key: "h", label: "สูง", min: 100, max: 240, step: 5 },
    ],
    colors: [
      { key: "color", label: "โครงชั้น" },
      { key: "backColor", label: "หลังชั้น" },
    ],
  },
  desk: {
    dims: [
      { key: "w", label: "กว้าง", min: 70, max: 200, step: 5 },
      { key: "d", label: "ลึก", min: 40, max: 90, step: 5 },
      { key: "h", label: "สูง", min: 60, max: 110, step: 5 },
    ],
    colors: [
      { key: "color", label: "หน้าโต๊ะ" },
      { key: "legColor", label: "ขา" },
    ],
  },
  officechair: {
    dims: [
      { key: "w", label: "กว้าง", min: 40, max: 80, step: 5 },
      { key: "h", label: "สูง", min: 70, max: 130, step: 5 },
    ],
    colors: [
      { key: "color", label: "เบาะ/พนัก" },
      { key: "poleColor", label: "ขา/ฐาน" },
    ],
  },
  floorlamp: {
    dims: [
      { key: "w", label: "กว้าง", min: 20, max: 60, step: 5 },
      { key: "h", label: "สูง", min: 100, max: 200, step: 5 },
    ],
    colors: [
      { key: "color", label: "โป๊ะ" },
      { key: "poleColor", label: "เสา" },
      { key: "baseColor", label: "ฐาน" },
    ],
  },
  tablelamp: {
    dims: [
      { key: "w", label: "กว้าง", min: 12, max: 40, step: 2 },
      { key: "h", label: "สูง", min: 25, max: 70, step: 5 },
    ],
    colors: [
      { key: "color", label: "โป๊ะ" },
      { key: "poleColor", label: "เสา" },
      { key: "baseColor", label: "ฐาน" },
    ],
  },
  mirror: {
    dims: [
      { key: "w", label: "กว้าง", min: 30, max: 120, step: 5 },
      { key: "h", label: "สูง", min: 100, max: 220, step: 5 },
    ],
    colors: [
      { key: "color", label: "กรอบ" },
      { key: "glassColor", label: "กระจก" },
      { key: "footColor", label: "ขาตั้ง" },
    ],
  },
  wallart: {
    dims: [
      { key: "w", label: "กว้าง", min: 25, max: 150, step: 5 },
      { key: "h", label: "สูง", min: 25, max: 180, step: 5 },
    ],
    colors: [
      { key: "color", label: "กรอบ" },
      { key: "canvasColor", label: "พื้นภาพ" },
      { key: "accentColor", label: "แถบตกแต่ง" },
    ],
  },
  plant: {
    dims: [
      { key: "w", label: "ทรงพุ่ม", min: 20, max: 80, step: 5 },
      { key: "h", label: "สูง", min: 30, max: 200, step: 5 },
    ],
    colors: [
      { key: "color", label: "กระถาง" },
      { key: "trunkColor", label: "ลำต้น" },
    ],
  },
  roundrug: {
    dims: [
      {
        key: "w",
        label: "เส้นผ่านศูนย์กลาง",
        min: 60,
        max: 350,
        step: 10,
      },
    ],
    colors: [{ key: "color", label: "สีพรม" }],
  },
  rectrug: {
    dims: [
      { key: "w", label: "กว้าง", min: 80, max: 350, step: 10 },
      { key: "d", label: "ยาว", min: 100, max: 400, step: 10 },
    ],
    colors: [{ key: "color", label: "สีพรม" }],
  },
  pouf: {
    dims: [
      { key: "w", label: "กว้าง", min: 30, max: 70, step: 5 },
      { key: "h", label: "สูง", min: 25, max: 60, step: 5 },
    ],
    colors: [{ key: "color", label: "สี" }],
  },
  pendantlamp: {
    dims: [
      { key: "w", label: "โป๊ะ", min: 15, max: 80, step: 5 },
      { key: "h", label: "สูงรวม", min: 25, max: 120, step: 5 },
    ],
    colors: [
      { key: "color", label: "โป๊ะ" },
      { key: "cordColor", label: "สาย/ฝ้า" },
      { key: "bulbColor", label: "หลอด" },
    ],
  },
  ceilingfan: {
    dims: [
      { key: "w", label: "ใบพัด", min: 60, max: 180, step: 5 },
      { key: "h", label: "สูงรวม", min: 20, max: 70, step: 5 },
    ],
    colors: [
      { key: "color", label: "ใบพัด" },
      { key: "motorColor", label: "มอเตอร์" },
      { key: "rodColor", label: "แกน/ฝ้า" },
    ],
  },
  downlight: {
    dims: [
      { key: "w", label: "กว้าง", min: 8, max: 30, step: 1 },
      { key: "h", label: "สูง", min: 3, max: 15, step: 1 },
    ],
    colors: [
      { key: "color", label: "เลนส์" },
      { key: "trimColor", label: "ขอบ" },
    ],
  },
  hangingplant: {
    dims: [
      { key: "w", label: "ทรงพุ่ม", min: 15, max: 60, step: 5 },
      { key: "h", label: "สูงรวม", min: 25, max: 100, step: 5 },
    ],
    colors: [
      { key: "color", label: "กระถาง" },
      { key: "cordColor", label: "สาย" },
    ],
  },
};