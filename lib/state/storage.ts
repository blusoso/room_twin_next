// lib/state/storage.ts
import { LEGACY_STORAGE_KEYS, STORAGE_KEY } from "@/lib/data/constants";
import { isAutoZoneExcludedProduct } from "@/lib/data/products";
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
    if (stripExcludedZoneMembership(parsed)) migrated = true;

    if (migrated) {
      // เขียนกลับ key ใหม่ก่อน — สำเร็จแล้วค่อยทิ้ง key เดิม
      // ถ้าเขียนไม่ได้ (quota/blocked) ยังคืน state ที่ normalize แล้วและคง key เดิมไว้ (migrate ซ้ำได้)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        LEGACY_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
      } catch (e) {
        /* ignore — ปล่อยให้ migrate รอบหน้า */
      }
    }

    return parsed;
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
