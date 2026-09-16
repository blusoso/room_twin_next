// lib/state/storage.ts
import { LEGACY_STORAGE_KEYS, STORAGE_KEY, SHOW_ALL_WALLS_KEY, MEASURE_KEY, LIGHTING_PREF_KEY } from "@/lib/data/constants";
import { isAutoZoneExcludedProduct } from "@/lib/data/products";
import { LAMP_PRODUCT_IDS, isLightingMode, type LightingMode } from "@/lib/data/lighting";
import type { SerializedState } from "./types";

export function saveToStorage(state: SerializedState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* ignore */
  }
}

/**
 * ⭐ ย้ายไอเทมโครงสร้าง/ม่าน & แอร์ (ที่ติดค้างอยู่ในโซนจากเซฟเดิม) ออกเป็น "ของลอย"
 *    แล้วล้าง entry zoneMeta ที่ไม่เหลือสมาชิก
 * @returns true ถ้ามีการแก้ข้อมูลจริง (ต้องเขียนกลับ)
 */
function stripExcludedZoneMembership(state: SerializedState): boolean {
  if (!Array.isArray(state.items)) return false;

  let changed = false;
  state.items.forEach((it) => {
    if (!it.zoneUid) return;
    if (!isAutoZoneExcludedProduct(it.productId)) return;
    it.zoneUid = null;
    it.zoneDefId = null;
    it.slotId = undefined;
    changed = true;
  });

  if (changed && Array.isArray(state.zoneMeta)) {
    const live = new Set(
      state.items.filter((i) => i.zoneUid).map((i) => i.zoneUid as string),
    );
    state.zoneMeta = state.zoneMeta.filter(([zuid]) => live.has(zuid));
  }

  return changed;
}

/**
 * ⭐ Migration: ตรวจ link การแขวนกับพื้นผิวไอเทมอื่น (mountUid / mountFace)
 *    - item ที่อ้าง host ที่ไม่มีอยู่แล้ว → ลบทิ้ง (นโยบาย "ลบ host = ลบของที่แขวนทั้งชุด")
 *    - mountFace ไม่ถูกต้อง / host เป็นของที่แขวนซ้อนอีกชั้น → ล้าง link เป็นของติดผนังห้อง
 * @returns true ถ้ามีการแก้ข้อมูลจริง (ต้องเขียนกลับ)
 */
function sanitizeMountLinks(state: SerializedState): boolean {
  if (!Array.isArray(state.items)) return false;

  const byUid = new Map(state.items.map((i) => [i.uid, i]));
  const validFaces = new Set(["pz", "nz", "px", "nx"]);
  let changed = false;

  state.items = state.items.filter((it) => {
    if (!it.mountUid) return true;

    if (!validFaces.has(it.mountFace as string)) {
      delete it.mountUid;
      delete it.mountFace;
      changed = true;
      return true;
    }

    const host = byUid.get(it.mountUid);
    if (!host) {
      changed = true;
      return false;
    }

    // host ที่แขวนซ้อนกับ host อื่นอีกชั้น — ไม่รองรับ → ถือเป็นของติดผนัง
    if (host.mountUid) {
      delete it.mountUid;
      delete it.mountFace;
      changed = true;
    }
    return true;
  });

  return changed;
}

/**
 * ⭐ Migration: โคมไฟรุ่นก่อนยังไม่มีสวิตช์เปิด/ปิดไฟ (params.lightOn)
 *    → เติม true ให้โคมทุกตัว เพื่อให้ของเดิมยังสว่างเหมือนก่อนมีสวิตช์
 * @returns true ถ้ามีการแก้ข้อมูลจริง (ต้องเขียนกลับ)
 */
function fillLampLightFlags(state: SerializedState): boolean {
  if (!Array.isArray(state.items)) return false;

  let changed = false;
  state.items.forEach((it) => {
    if (!LAMP_PRODUCT_IDS.has(it.productId)) return;
    if (!it.params) return;
    if ((it.params as any).lightOn !== undefined) return;
    (it.params as any).lightOn = true;
    changed = true;
  });

  return changed;
}

/**
 * ⭐ Normalize/migrate SerializedState ให้เป็นรูปปัจจุบัน
 *
 *    ใช้ร่วมกัน 2 ทาง:
 *      - loadFromStorage() : อ่านจาก localStorage
 *      - ข้อมูลจาก API     : ห้องที่โหลดจากเซิร์ฟเวอร์ / ลิงก์แชร์
 *    เพื่อไม่ให้ migration แตกเป็นสองชุด
 *
 * @returns state ที่ normalize แล้ว + changed = true ถ้ามีการแก้ข้อมูลจริง (ต้องเขียนกลับ)
 */
export function normalizeSerializedState(parsed: SerializedState): {
  state: SerializedState;
  changed: boolean;
} {
  let changed = false;

  // ⭐ Migration
  if (parsed.room) {
    if (!Array.isArray(parsed.room.blocks) && parsed.room.blocks) {
      // fine
    }
    if (!parsed.room.cellLevels) {
      (parsed.room as any).cellLevels = {};
    }
    // Remove old floors field
    delete (parsed.room as any).floors;
  }

  // ⭐ Migration: โครงสร้าง/ม่าน & แอร์ ห้ามอยู่ในโซน
  if (stripExcludedZoneMembership(parsed)) changed = true;

  // ⭐ Migration: link การแขวนกับพื้นผิวไอเทมอื่น (mountUid/mountFace)
  if (sanitizeMountLinks(parsed)) changed = true;

  // ⭐ Migration: สวิตช์เปิด/ปิดไฟของโคม (params.lightOn)
  if (fillLampLightFlags(parsed)) changed = true;

  return { state: parsed, changed };
}

export function loadFromStorage(): SerializedState | null {
  if (typeof window === "undefined") return null;
  try {
    // ⭐ อ่าน key ปัจจุบันก่อน — ถ้าไม่มี (ยังไม่เคยเซฟรุ่นนี้) ลอง key รุ่นก่อน
    let raw = localStorage.getItem(STORAGE_KEY);
    let migrated = false;
    if (!raw) {
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacyRaw = localStorage.getItem(legacyKey);
        if (!legacyRaw) continue;
        raw = legacyRaw;
        migrated = true;
        break;
      }
    }
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SerializedState;
    if (!parsed || typeof parsed !== "object") return null;

    const normalized = normalizeSerializedState(parsed);
    const state = normalized.state;
    if (normalized.changed) migrated = true;

    if (migrated) {
      // เขียนกลับ key ใหม่ก่อน — สำเร็จแล้วค่อยทิ้ง key เดิม
      // ถ้าเขียนไม่ได้ (quota/blocked) ยังคืน state ที่ normalize แล้วและคง key เดิมไว้ (migrate ซ้ำได้)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        LEGACY_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
      } catch (e) {
        /* ignore — ปล่อยให้ migrate รอบหน้า */
      }
    }

    return state;
  } catch (e) {
    return null;
  }
}

export function clearStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    /* ignore */
  }
}

// ============================================================
// ⭐ View preference: โหมดแสดงผนังรอบด้าน
//    เก็บแยกจาก SerializedState — ไม่กระทบ undo/redo และไม่ต้อง bump STORAGE_KEY
// ============================================================

export function loadShowAllWallsPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SHOW_ALL_WALLS_KEY) === "1";
  } catch (e) {
    return false;
  }
}

export function saveShowAllWallsPref(v: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (v) localStorage.setItem(SHOW_ALL_WALLS_KEY, "1");
    else localStorage.removeItem(SHOW_ALL_WALLS_KEY);
  } catch (e) {
    /* ignore */
  }
}

export function trackAffiliateClick(): void {
  if (typeof window === "undefined") return;
  try {
    const key = "roomtwin_clicks";
    const n = Number(localStorage.getItem(key) || "0") + 1;
    localStorage.setItem(key, String(n));
  } catch (e) {
    /* ignore */
  }
}

// ============================================================
// ⭐ View preference: โหมดวัดขนาด (📏)
//    เก็บแยกจาก SerializedState — ไม่กระทบ undo/redo และไม่ต้อง bump STORAGE_KEY
// ============================================================

export function loadMeasurePref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MEASURE_KEY) === "1";
  } catch (e) {
    return false;
  }
}

export function saveMeasurePref(v: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (v) localStorage.setItem(MEASURE_KEY, "1");
    else localStorage.removeItem(MEASURE_KEY);
  } catch (e) {
    /* ignore */
  }
}

// ============================================================
// ⭐ View preference: โหมดแสงในฉาก (☀️/🌆/🌙) + สวิตช์ไฟโคม (💡)
//    เก็บแยกจาก SerializedState — ไม่กระทบ undo/redo
//    (ไม่ต้อง bump STORAGE_KEY เพราะไม่ใช่ข้อมูลห้อง)
// ============================================================

export interface LightingPref {
  mode: LightingMode;
  lampsOn: boolean;
}

export function loadLightingPref(): LightingPref | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LIGHTING_PREF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LightingPref>;
    const mode = isLightingMode(parsed?.mode) ? parsed.mode : "day";
    return { mode, lampsOn: parsed?.lampsOn === true };
  } catch (e) {
    return null;
  }
}

export function saveLightingPref(pref: LightingPref): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LIGHTING_PREF_KEY,
      JSON.stringify({
        mode: isLightingMode(pref.mode) ? pref.mode : "day",
        lampsOn: pref.lampsOn === true,
      }),
    );
  } catch (e) {
    /* ignore */
  }
}
