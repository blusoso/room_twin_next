// lib/three/itemTree.ts
import { useRoomTwin } from "@/lib/state/store";
import { removeInstantiated } from "./instantiate";

/**
 * ⭐ uid ของ item + ของที่แขวนอยู่กับพื้ นผิวของ item นี้ (ไล่ลงไปทุกระดับ)
 *    "แขวนอยู่กับพื้ นผิว" = item.mountUid ชี้มาที่ uid นี้
 */
export function collectAttachmentUids(uid: string): string[] {
  const { placedItems } = useRoomTwin.getState();
  const out: string[] = [];
  const seen = new Set<string>();

  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
    placedItems.forEach((i) => {
      if (i.mountUid === id) walk(i.uid);
    });
  };

  walk(uid);
  return out;
}

/**
 * ⭐ ลบ item และของที่แขวนอยู่กับพื้ นผิวของมัน ออกจาก Three.js scene + state
 *    - ลบ host → ของที่แขวนหายไปด้วยทั้งชุด (นโยบายที่ตกลงไว้)
 *    - ไม่แตะของที่วางซ้อน (parentUid) — ยังคงพฤติกรรมเดิม (ลอยลงพื้ น)
 * @returns uid ทั้งหมดที่ถูกลบ (ตัวแรกคือ uid ที่ส่งเข้ามา)
 */
export function deleteItemTree(uid: string): string[] {
  const uids = collectAttachmentUids(uid);
  const { removeItem } = useRoomTwin.getState();

  // ⭐ ลบ object ใน 3D ก่อน แล้วค่อยลบ state (ไม่มี sync อัตโนมัติ)
  uids.forEach((u) => removeInstantiated(u));
  uids.forEach((u) => removeItem(u));
  return uids;
}
