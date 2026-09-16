// lib/three/zoneActions.ts
import { useRoomTwin } from "@/lib/state/store";
import { isAutoZoneExcludedProduct } from "@/lib/data/products";
import { removeInstantiated, reinstantiateItem } from "./instantiate";
import { resolveRestHeights } from "./placement";
import { rebuildBaseboards } from "./roomShell";
import { assignItemToZone } from "./zoneHelpers";

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
 * ย้าย item เข้าโซน (หรือออกจากโซนเมื่อ zuid = null) + จัดลำดับ + อัปเดต height
 * @param insertBeforeUid ใช้ตอนลากจัดลำดับในโซนเดียวกัน (แทรกก่อน item นี้)
 */
export function moveItemIntoZoneFull(
  uid: string,
  zuid: string | null,
  insertBeforeUid?: string,
) {
  const store = useRoomTwin.getState();
  const item = store.placedItems.find((i) => i.uid === uid);
  if (!item) return;

  const currentZone = item.zoneUid ?? null;
  if (currentZone === zuid && !insertBeforeUid) return;

  assignItemToZone(uid, zuid, insertBeforeUid);
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

/**
 * ⭐ สร้าง "โซนเอง" (ไม่มี ZoneDef) จากแท็บห้องของฉัน
 *    โซน derive จาก items — จึงต้องมีสมาชิกอย่างน้อย 1 ชิ้นเสมอ
 *    identity ทั้งหมด (name/icon/color) เก็บใน zoneMeta และสมาชิกทุกตัวมี zoneDefId = null
 *    ไม่แตะ Three.js object (ของอยู่ตำแหน่งเดิม) — caller ต้องเรียก saveState() เอง
 */
export interface CustomZoneInput {
  name: string;
  icon: string;
  color: number;
  memberUids: string[];
}

export function createCustomZoneFull(
  input: CustomZoneInput,
): { zuid: string | null } {
  const store = useRoomTwin.getState();

  // ⭐ กันของกลุ่มโครงสร้าง/ม่าน & แอร์ (สอดคล้อง storage migration + auto-zone exclusion)
  const byUid = new Set(
    store.placedItems
      .filter((i) => !isAutoZoneExcludedProduct(i.productId))
      .map((i) => i.uid),
  );
  const members = new Set(input.memberUids.filter((uid) => byUid.has(uid)));
  if (members.size === 0) return { zuid: null };

  const zuid = "z" + Math.random().toString(36).slice(2, 10);

  // ⭐ identity ของโซนเองมาจาก zoneMeta เท่านั้น (ไม่มี def ให้ resolve)
  store.setZoneMeta(zuid, {
    name: input.name,
    icon: input.icon,
    color: input.color,
  });

  // ⭐ patch สมาชิกทั้งหมดใน update เดียว (atomic) — ย้ายออกจากโซนเดิมด้วย
  store.replaceItems(
    useRoomTwin.getState().placedItems.map((i) =>
      members.has(i.uid)
        ? { ...i, zoneUid: zuid, zoneDefId: null, slotId: undefined }
        : i,
    ),
  );

  store.selectZone(zuid);
  resolveRestHeights();

  return { zuid };
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