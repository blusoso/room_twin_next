// lib/three/zoneActions.ts
import { useRoomTwin } from "@/lib/state/store";
import { removeInstantiated, reinstantiateItem } from "./instantiate";
import { resolveRestHeights } from "./placement";
import { rebuildBaseboards } from "./roomShell";

/**
 * ลบทั้งโซน — ลบ items ทั้งหมดในโซน + scene objects + zoneMeta
 */
export function removeZoneFull(zuid: string) {
  const store = useRoomTwin.getState();
  const zoneItems = store.placedItems.filter((i) => i.zoneUid === zuid);

  // 1. ลบ Three.js objects ทุกตัวในโซน
  zoneItems.forEach((it) => {
    removeInstantiated(it.uid);
  });

  // 2. อัปเดต state
  store.removeZone(zuid);

  // 3. Re-resolve heights + rebuild baseboards
  resolveRestHeights();
  rebuildBaseboards();

  // 4. Save state
  saveStateSafe();
}

/**
 * ย้าย item ออกจากโซน (unzone) + อัปเดต height
 */
export function moveItemOutOfZoneFull(uid: string) {
  const store = useRoomTwin.getState();
  store.updateItem(uid, {
    zoneUid: null,
    zoneDefId: null,
    slotId: undefined,
  });
  resolveRestHeights();
  saveStateSafe();
}

/**
 * สลับสินค้าใน slot ของโซน
 */
export function swapZoneSlotFull(uid: string, newProductId: string) {
  const store = useRoomTwin.getState();
  const item = store.placedItems.find((i) => i.uid === uid);
  if (!item) return;

  const { PRODUCT_BY_ID, defaultParamsFor } = require("@/lib/data/products");
  const np = PRODUCT_BY_ID.get(newProductId);
  if (!np) return;

  // ลบ object เก่า
  removeInstantiated(uid);

  // อัปเดต params
  store.updateItem(uid, {
    productId: newProductId,
    params: defaultParamsFor(np),
    themeOverride: undefined,
    displayName: null,
  });

  // สร้างใหม่
  reinstantiateItem(uid);
  resolveRestHeights();

  if (newProductId === "door" || item.productId === "door") {
    rebuildBaseboards();
  }

  saveStateSafe();
}

// ============================================================
// Internal
// ============================================================

async function saveStateSafe() {
  try {
    const mod = await import("@/hooks/useSaveState");
    // helper only — actual save logic อยู่ใน component
    // ใช้วิธีนี้เพราะ store ไม่ควร import hook
  } catch (e) {
    // ignore
  }
}