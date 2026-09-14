// lib/three/reclamp.ts
import { useRoomTwin } from "@/lib/state/store";
import { objectsByUid } from "./scene";
import {
  footprintOf,
  resolvePlacement,
  resolveRestHeights,
} from "./placement";
import {
  resolveWallPlacement,
  wallFootprint,
  wallItemWorldXZ,
} from "./wallPlacement";
import { resolveCeilingPlacement } from "./ceilingPlacement";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { WALL_OUTWARD } from "@/lib/data/constants";

/**
 * ย้ายไอเทมทั้งหมดให้อยู่ในห้องอีกครั้ง (ใช้หลัง resize room)
 * - วนซ้ำจนกว่า position จะ stable (สำหรับ item ที่ parent กัน)
 * - reclamp wall items แยก
 */
export function reclampAllToRoom() {
  const store = useRoomTwin.getState();
  const processed = new Set<string>();
  let remaining = store.placedItems.slice();
  let maxIter = 12;

  while (remaining.length > 0 && maxIter-- > 0) {
    const next: typeof remaining = [];

    remaining.forEach((item) => {
      // wall items → handle ทีหลัง
      if (item.wallMount) {
        processed.add(item.uid);
        return;
      }

      // ถ้า parent ยังไม่ processed → defer
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

  reclampWallItems();
  resolveRestHeights();

  // Update object transforms ใน scene
  const state = useRoomTwin.getState();
  state.placedItems.forEach((item) => {
    const obj = objectsByUid.get(item.uid);
    if (!obj) return;

    if (item.wallMount) {
      const w = wallItemWorldXZ(item);
      obj.position.set(w.x, item.v!, w.z);
      obj.rotation.y = item.rotY || 0;
    } else if (item.ceilingMount) {
      obj.position.set(item.x!, state.room.h, item.z!);
    } else {
      obj.position.x = item.x!;
      obj.position.z = item.z!;
      obj.position.y = item.restY || 0;
    }
  });
}

/**
 * Clamp wall items ให้อยู่ในผนังที่ถูกต้อง (ใช้หลัง resize room)
 */
export function reclampWallItems() {
  const store = useRoomTwin.getState();

  store.placedItems.forEach((item) => {
    if (!item.wallMount) return;
    const product = PRODUCT_BY_ID.get(item.productId);
    if (!product) return;

    const { halfU, halfV } = wallFootprint(
      item.params,
      item.rotZ || 0,
    );
    const c = resolveWallPlacement(
      item.uid,
      item.wallId!,
      item.u!,
      item.v!,
      halfU,
      halfV,
      product.groundAnchor || false,
    );

    if (c.u !== item.u || c.v !== item.v) {
      store.updateItem(item.uid, { u: c.u, v: c.v });
    }

    const obj = objectsByUid.get(item.uid);
    if (obj) {
      const w = wallItemWorldXZ(item);
      obj.position.set(w.x, c.v, w.z);
    }
  });
}