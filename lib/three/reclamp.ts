// lib/three/reclamp.ts
import { useRoomTwin } from "@/lib/state/store";
import { objectsByUid } from "./scene";
import {
  footprintOf,
  resolvePlacement,
  resolveRestHeights,
  bottomOffsetFor,
} from "./placement";
import {
  resolveWallPlacement,
  wallFootprint,
  targetOfItem,
  mountPlane,
  mountPointXZ,
  mountOutwardFor,
} from "./wallPlacement";
import { resolveCeilingPlacement } from "./ceilingPlacement";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import type { PlacedItem } from "@/lib/state/types";

/**
 * ⭐ Reclamp ของติดผนัง 1 ชิ้น — fix บั๊กใช้ item.u เก่า
 *    รองรับของที่แขวนกับพื้ นผิวไอเทมอื่น (host) ด้วย: คำนวณใหม่จาก host ปัจจุบัน
 *    → host ขยับ/หมุน/ย้ายพื้ นที่ ของที่แขวนขยับตาม
 */
function reclampWallItem(item: PlacedItem) {
  if (!item.wallMount) return;
  const product = PRODUCT_BY_ID.get(item.productId);
  if (!product) return;

  const target = targetOfItem(item);
  if (!target) return;
  const plane = mountPlane(target);
  if (!plane) return;

  const { halfU, halfV } = wallFootprint(item.params, item.rotZ || 0);

  // ⭐ คำนวณตำแหน่งใหม่จากพื้ นผิวปัจจุบัน
  const c = resolveWallPlacement(
    item.uid,
    target,
    item.u ?? 0,
    item.v ?? 0,
    halfU,
    halfV,
    product.groundAnchor || false,
  );

  // ⭐ host หมุน → ผิวหมุนตาม rotY ของ item ต้องอัปเดตด้วย
  const nextRotY = plane.rotY;
  const rotYChanged = Math.abs(nextRotY - (item.rotY ?? 0)) > 1e-6;

  // ⭐ อัปเดต state ถ้าตำแหน่งเปลี่ยน
  if (
    Math.abs(c.u - (item.u || 0)) > 1e-6 ||
    Math.abs(c.v - (item.v || 0)) > 1e-6 ||
    rotYChanged
  ) {
    useRoomTwin.getState().updateItem(item.uid, {
      u: c.u,
      v: c.v,
      rotY: nextRotY,
    });
  }

  // ⭐⭐⭐ อัปเดต object position ด้วยค่า c.u/c.v (ไม่ใช่ item.u/v เก่า)
  const obj = objectsByUid.get(item.uid);
  if (obj) {
    const w = mountPointXZ(plane, c.u, mountOutwardFor(target, item.params.d));
    obj.position.set(w.x, plane.baseY + c.v, w.z);
    obj.rotation.y = nextRotY;
  }
}

/** ⭐ Reclamp ของติดผนังทุกชิ้น */
export function reclampWallItems() {
  useRoomTwin.getState().placedItems.forEach(reclampWallItem);
}

/**
 * ⭐ จัดของที่แขวนอยู่กับพื้ นผิวของ host (uid) ให้ตาม host ปัจจุบัน
 *    เรียกหลัง host ถูกย้าย/หมุน/เปลี่ยนขนาด (รวม host ที่เป็นประตู/หน้าต่าง)
 */
export function reclampAttachmentsOf(hostUid: string) {
  useRoomTwin
    .getState()
    .placedItems.filter((i) => i.mountUid === hostUid)
    .forEach(reclampWallItem);
}

/**
 * Reclamp ทุก items ให้อยู่ในห้อง (เรียกหลัง resize room)
 */
export function reclampAllToRoom() {
  const store = useRoomTwin.getState();
  const processed = new Set<string>();
  let remaining = store.placedItems.slice();
  let maxIter = 12;

  // ===== 1. Floor + ceiling items (พร้อม dependency) =====
  while (remaining.length > 0 && maxIter-- > 0) {
    const next: typeof remaining = [];

    remaining.forEach((item) => {
      // wall items → handle ทีหลัง
      if (item.wallMount) {
        processed.add(item.uid);
        return;
      }

      // parent ยังไม่ processed → defer
      if (item.parentUid && !processed.has(item.parentUid)) {
        next.push(item);
        return;
      }

      const product = PRODUCT_BY_ID.get(item.productId);
      if (!product) {
        processed.add(item.uid);
        return;
      }

      const fp = footprintOf(item.params, item.rotY || 0);

      if (item.ceilingMount) {
        const c = resolveCeilingPlacement(
          item.uid,
          item.x!,
          item.z!,
          fp,
          item.params.h / 100,
        );
        if (c.x !== item.x || c.z !== item.z) {
          store.updateItem(item.uid, { x: c.x, z: c.z });
        }
      } else {
        const c = resolvePlacement(
          item.uid,
          item.x!,
          item.z!,
          fp,
          item.parentUid,
          product.rug,
        );
        if (c.x !== item.x || c.z !== item.z) {
          store.updateItem(item.uid, { x: c.x, z: c.z });
        }
      }
      processed.add(item.uid);
    });

    if (next.length === 0) break;
    remaining = next;
  }

  // ===== 2. Wall items =====
  reclampWallItems();

  // ===== 3. Rest heights =====
  resolveRestHeights();

  // ===== 4. Update object transforms =====
  const state = useRoomTwin.getState();
  state.placedItems.forEach((item) => {
    const obj = objectsByUid.get(item.uid);
    if (!obj) return;

    if (item.wallMount) {
      // จัดการใน reclampWallItems แล้ว — ข้าม
      return;
    } else if (item.ceilingMount) {
      obj.position.set(item.x!, state.room.h, item.z!);
      obj.rotation.y = item.rotY || 0;
    } else {
      obj.position.x = item.x!;
      obj.position.z = item.z!;
      obj.position.y = (item.restY || 0) - bottomOffsetFor(item.uid);
      obj.rotation.y = item.rotY || 0;
    }
  });
}