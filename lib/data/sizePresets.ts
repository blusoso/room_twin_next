// lib/data/sizePresets.ts
// ⭐ ขนาดสำเร็จรูป (size presets) — ตัวเลือกขนาดที่ผู้ใช้ "รู้จักชื่อ" เช่น เตียง 5 ฟุต / ควีน / คิง
//
// หลักการสำคัญ:
//   - ไฟล์นี้เป็น **derived data** ล้วน ๆ — ไม่เก็บลง state และไม่ใช่ source of truth ที่สอง
//     ค่าจริงของไอเทมอยู่ใน PlacedItem.params เท่านั้น (เลือก preset = เขียน params ผ่าน applyParamsPatch)
//   - preset แก้เฉพาะ key ที่ตัวเองประกาศ (ปกติคือ w/d) → ไม่ทับค่าอื่นที่ผู้ใช้ตั้งไว้ (สี/ความสูง)
//   - productId ที่ไม่มีในตาราง = สินค้านั้นไม่มีตัวเลือกขนาด → UI ต้องไม่แสดงปุ่ม 📐
//   - ไม่กระทบ serialized state → ไม่ต้อง bump STORAGE_KEY

import { PARAM_SCHEMA } from "./schemas";
import type { Params } from "@/lib/state/types";

export interface SizePreset {
  id: string;
  /** ⭐ ชื่อสั้นบนปุ่ม toolbar / chip ในแผงปรับแต่ง เช่น "6 ฟุต" */
  label: string;
  /** ⭐ บรรทัดอธิบายในเมนู (ต้องมีตัวเลข ซม. ให้ผู้ใช้เทียบขนาดได้ทันที) */
  sub: string;
  /** ⭐ key ที่ preset นี้แก้ — เก็บเฉพาะ w/d (เว้นแต่จำเป็น) */
  params: Partial<Params>;
}

export interface SizePresetGroup {
  /** หัวเมนูภาษาไทย เช่น "ขนาดเตียง" */
  title: string;
  presets: SizePreset[];
}

/**
 * ⭐ ตารางขนาดสำเร็จรูป (เรียงจากเล็ก → ใหญ่)
 *    ค่าทุกตัวอยู่ในช่วง PARAM_SCHEMA ของสินค้านั้น (ตรวจแล้ว + มี clamp ชั้นสองตอน apply)
 */
export const SIZE_PRESETS: Record<string, SizePresetGroup> = {
  // ===== เตียง =====
  bed: {
    title: "ขนาดเตียง",
    presets: [
      {
        id: "bed-3",
        label: "3 ฟุต",
        sub: "เตียงเดี่ยว 90×200 ซม. · Single",
        params: { w: 90, d: 200 },
      },
      {
        id: "bed-35",
        label: "3.5 ฟุต",
        sub: "เตียงเดี่ยวใหญ่ 105×200 ซม.",
        params: { w: 105, d: 200 },
      },
      {
        id: "bed-4",
        label: "4 ฟุต",
        sub: "เตียงคู่ 120×200 ซม. · Double",
        params: { w: 120, d: 200 },
      },
      {
        id: "bed-5",
        label: "5 ฟุต",
        sub: "ควีน 150×200 ซม. · Queen",
        params: { w: 150, d: 200 },
      },
      {
        id: "bed-6",
        label: "6 ฟุต",
        sub: "คิง 180×200 ซม. · King",
        params: { w: 180, d: 200 },
      },
      {
        id: "bed-65",
        label: "6.5 ฟุต",
        sub: "เตียงใหญ่พิเศษ 200×200 ซม.",
        params: { w: 200, d: 200 },
      },
    ],
  },

  // ===== พรม =====
  rectrug: {
    title: "ขนาดพรม",
    presets: [
      {
        id: "rectrug-s",
        label: "80×150",
        sub: "พรมผืนเล็ก 80×150 ซม.",
        params: { w: 80, d: 150 },
      },
      {
        id: "rectrug-m",
        label: "120×170",
        sub: "พรมหน้าประตู/ข้างเตียง 120×170 ซม.",
        params: { w: 120, d: 170 },
      },
      {
        id: "rectrug-l",
        label: "160×230",
        sub: "พรมผืนกลาง 160×230 ซม. (ค่าเริ่มต้น)",
        params: { w: 160, d: 230 },
      },
      {
        id: "rectrug-xl",
        label: "200×300",
        sub: "พรมผืนใหญ่ 200×300 ซม.",
        params: { w: 200, d: 300 },
      },
    ],
  },
  roundrug: {
    title: "ขนาดพรมกลม",
    presets: [
      {
        id: "roundrug-120",
        label: "Ø120",
        sub: "พรมกลม Ø120 ซม.",
        params: { w: 120, d: 120 },
      },
      {
        id: "roundrug-150",
        label: "Ø150",
        sub: "พรมกลม Ø150 ซม. (ค่าเริ่มต้น)",
        params: { w: 150, d: 150 },
      },
      {
        id: "roundrug-200",
        label: "Ø200",
        sub: "พรมกลม Ø200 ซม.",
        params: { w: 200, d: 200 },
      },
      {
        id: "roundrug-250",
        label: "Ø250",
        sub: "พรมกลม Ø250 ซม.",
        params: { w: 250, d: 250 },
      },
    ],
  },

  // ===== เปิดช่อง (ของติดผนัง) =====
  door: {
    title: "ขนาดประตู",
    presets: [
      { id: "door-70", label: "70 ซม.", sub: "ประตูห้องน้ำ 70×205 ซม.", params: { w: 70 } },
      { id: "door-80", label: "80 ซม.", sub: "ประตูมาตรฐาน 80×205 ซม.", params: { w: 80 } },
      { id: "door-90", label: "90 ซม.", sub: "ประตูห้องนอน 90×205 ซม.", params: { w: 90 } },
      { id: "door-100", label: "100 ซม.", sub: "ประตูทางเข้า 100×205 ซม.", params: { w: 100 } },
    ],
  },
  window: {
    title: "ขนาดหน้าต่าง",
    presets: [
      { id: "window-60", label: "60×100", sub: "หน้าต่างเล็ก 60×100 ซม.", params: { w: 60, h: 100 } },
      { id: "window-90", label: "90×130", sub: "หน้าต่างมาตรฐาน 90×130 ซม.", params: { w: 90, h: 130 } },
      { id: "window-120", label: "120×130", sub: "หน้าต่างกว้าง 120×130 ซม.", params: { w: 120, h: 130 } },
      { id: "window-180", label: "180×150", sub: "หน้าต่างบานใหญ่ 180×150 ซม.", params: { w: 180, h: 150 } },
    ],
  },
  slidingdoor: {
    title: "ขนาดบานเลื่อน",
    presets: [
      { id: "sliding-160", label: "160", sub: "บานเลื่อน 2 บาน 160×230 ซม.", params: { w: 160 } },
      { id: "sliding-200", label: "200", sub: "บานเลื่อน 200×230 ซม.", params: { w: 200 } },
      { id: "sliding-240", label: "240", sub: "บานเลื่อน 4 บาน 240×230 ซม.", params: { w: 240 } },
    ],
  },

  // ===== ตู้ / โต๊ะ / ชั้นวาง =====
  wardrobe: {
    title: "ขนาดตู้",
    presets: [
      { id: "wardrobe-90", label: "90", sub: "ตู้ 2 บาน 90×200 ซม.", params: { w: 90 } },
      { id: "wardrobe-120", label: "120", sub: "ตู้ 3 บาน 120×200 ซม.", params: { w: 120 } },
      { id: "wardrobe-150", label: "150", sub: "ตู้ 4 บาน 150×200 ซม.", params: { w: 150 } },
      { id: "wardrobe-180", label: "180", sub: "ตู้ 5 บาน 180×200 ซม.", params: { w: 180 } },
    ],
  },
  desk: {
    title: "ขนาดโต๊ะ",
    presets: [
      { id: "desk-90", label: "90×60", sub: "โต๊ะทำงานเล็ก 90×60 ซม.", params: { w: 90, d: 60 } },
      { id: "desk-120", label: "120×60", sub: "โต๊ะทำงานมาตรฐาน 120×60 ซม.", params: { w: 120, d: 60 } },
      { id: "desk-150", label: "150×70", sub: "โต๊ะทำงานกว้าง 150×70 ซม.", params: { w: 150, d: 70 } },
      { id: "desk-180", label: "180×80", sub: "โต๊ะทำงานใหญ่ 180×80 ซม.", params: { w: 180, d: 80 } },
    ],
  },
  bookshelf: {
    title: "ขนาดชั้นวาง",
    presets: [
      { id: "bookshelf-60", label: "60", sub: "ชั้นวาง 60×180 ซม.", params: { w: 60 } },
      { id: "bookshelf-90", label: "90", sub: "ชั้นวาง 90×180 ซม.", params: { w: 90 } },
      { id: "bookshelf-120", label: "120", sub: "ชั้นวาง 120×180 ซม.", params: { w: 120 } },
    ],
  },
};

/** ⭐ ของชิ้นนี้มีตัวเลือกขนาดสำเร็จรูปไหม (ใช้ตัดสินว่าจะโชว์ปุ่ม 📐) */
export function sizePresetGroup(productId: string): SizePresetGroup | null {
  return SIZE_PRESETS[productId] || null;
}

export function hasSizePresets(productId: string): boolean {
  return !!sizePresetGroup(productId);
}

/**
 * ⭐ preset ที่ตรงกับ params ปัจจุบัน (เทียบเฉพาะ key ที่ preset ประกาศ, เผื่อ ±0.5 ซม.)
 *    → ใช้ไฮไลต์แถว "ใช้อยู่" และใช้เป็นชื่อสั้นบนปุ่ม toolbar
 */
export function matchSizePreset(
  productId: string,
  params: Params | undefined | null,
): SizePreset | null {
  const group = sizePresetGroup(productId);
  if (!group || !params) return null;

  for (const preset of group.presets) {
    const ok = Object.entries(preset.params).every(([key, want]) => {
      const have = params[key];
      return typeof have === "number" && Math.abs(have - (want as number)) <= 0.5;
    });
    if (ok) return preset;
  }
  return null;
}

/**
 * ⭐ ข้อความบนปุ่ม 📐 — ถ้าไม่ตรง preset ใดเลยให้ fallback เป็นขนาดจริง
 *    (ปุ่มต้องสื่อความหมายได้เสมอ ไม่เป็น icon เปล่า ๆ)
 *    เลือกคู่ตัวเลขตาม schema ของสินค้า: มี d → W×D, มีแค่ h (ของติดผนัง) → W×H
 */
export function sizeChipLabel(
  productId: string,
  params: Params | undefined | null,
): string {
  const preset = matchSizePreset(productId, params);
  if (preset) return preset.label;
  if (!params) return "ขนาด";
  if (productId === "roundrug") return `Ø${params.w}`;

  const keys = (PARAM_SCHEMA[productId]?.dims || []).map((d) => d.key);
  if (keys.includes("d")) return `${params.w}×${params.d}`;
  if (keys.includes("h")) return `${params.w}×${params.h}`;
  return `${params.w}`;
}

/**
 * ⭐ clamp ค่าของ preset ให้อยู่ในช่วงที่ PARAM_SCHEMA อนุญาต ก่อนเขียนลง store
 *    (กันข้อมูลในไฟล์นี้หลุดช่วงในอนาคต → slider/ตัวเลขในแผงปรับแต่งไม่พัง)
 */
export function clampPresetParams(
  productId: string,
  patch: Partial<Params>,
): Partial<Params> {
  const dims = PARAM_SCHEMA[productId]?.dims;
  if (!dims || !dims.length) return { ...patch };

  const out: Partial<Params> = { ...patch };
  for (const def of dims) {
    const v = out[def.key];
    if (typeof v !== "number" || !isFinite(v)) continue;
    out[def.key] = Math.min(def.max, Math.max(def.min, Math.round(v)));
  }
  return out;
}
