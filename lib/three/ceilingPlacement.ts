// lib/three/ceilingPlacement.ts
import * as THREE from "three";
import { CEILING_CLEARANCE_MIN } from "@/lib/data/constants";
import { useRoomTwin } from "@/lib/state/store";
import { footprintOf, rectOverlap, clampToRoom } from "./placement";
import { raycaster, pointerNDC, renderer, camera, ceilingColliderGroup } from "./scene";

export function hangDrop(item: any) {
  return item.params.h / 100;
}

export function floorTopY(item: any) {
  return (item.restY || 0) + item.params.h / 100;
}

export function ceilingClearanceAt(
  x: number, z: number, fp: { w: number; d: number },
  dropH: number, excludeUid: string,
) {
  const { placedItems, room } = useRoomTwin.getState();
  let worst: any = null;
  placedItems.forEach((o) => {
    if (o.uid === excludeUid || o.wallMount || o.ceilingMount) return;
    if (o.productId === "roundrug" || o.productId === "rectrug") return;
    const ofp = footprintOf(o.params, o.rotY || 0);
    const r = rectOverlap(x, z, fp, o.x!, o.z!, ofp);
    if (!r.overlapping) return;
    const cl = room.h - dropH - floorTopY(o);
    if (worst === null || cl < worst.clearance)
      worst = { clearance: cl, item: o, product: { name: o.productId } };
  });
  return worst;
}

export function resolveCeilingOverlap(
  uid: string | null, x: number, z: number, fp: { w: number; d: number },
) {
  const { placedItems } = useRoomTwin.getState();
  const ex = uid ? new Set([uid]) : new Set<string>();
  let px = x, pz = z;
  for (let p = 0; p < 6; p++) {
    let moved = false;
    placedItems.forEach((other) => {
      if (ex.has(other.uid) || !other.ceilingMount) return;
      const ofp = footprintOf(other.params, other.rotY || 0);
      const r = rectOverlap(px, pz, fp, other.x!, other.z!, ofp);
      if (r.overlapping) {
        moved = true;
        if (r.overlapX < r.overlapZ) {
          const dir = px - other.x! >= 0 ? 1 : -1;
          px = other.x! + dir * (fp.w / 2 + ofp.w / 2 + 0.001);
        } else {
          const dir = pz - other.z! >= 0 ? 1 : -1;
          pz = other.z! + dir * (fp.d / 2 + ofp.d / 2 + 0.001);
        }
      }
    });
    if (!moved) break;
  }
  return { x: px, z: pz };
}

export function resolveCeilingFurnitureClearance(
  uid: string | null, x: number, z: number,
  fp: { w: number; d: number }, dropH: number,
) {
  const { placedItems, room } = useRoomTwin.getState();
  let px = x, pz = z;
  for (let p = 0; p < 8; p++) {
    let moved = false;
    placedItems.forEach((o) => {
      if (o.uid === uid || o.wallMount || o.ceilingMount) return;
      if (o.productId === "roundrug" || o.productId === "rectrug") return;
      const ofp = footprintOf(o.params, o.rotY || 0);
      const r = rectOverlap(px, pz, fp, o.x!, o.z!, ofp);
      if (!r.overlapping) return;
      if (room.h - dropH - floorTopY(o) >= CEILING_CLEARANCE_MIN) return;
      moved = true;
      if (r.overlapX < r.overlapZ) {
        const dir = px - o.x! >= 0 ? 1 : -1;
        px = o.x! + dir * (fp.w / 2 + ofp.w / 2 + 0.001);
      } else {
        const dir = pz - o.z! >= 0 ? 1 : -1;
        pz = o.z! + dir * (fp.d / 2 + ofp.d / 2 + 0.001);
      }
    });
    if (!moved) break;
  }
  return { x: px, z: pz };
}

export function resolveCeilingPlacement(
  uid: string | null, x: number, z: number,
  fp: { w: number; d: number }, dropH: number,
) {
  let c = clampToRoom(x, z, fp);
  c = resolveCeilingOverlap(uid, c.x, c.z, fp);
  c = resolveCeilingFurnitureClearance(uid, c.x, c.z, fp, dropH);
  c = resolveCeilingOverlap(uid, c.x, c.z, fp);
  c = clampToRoom(c.x, c.z, fp);
  return c;
}

export function relayoutCeilingItemsForObstacles() {
  const { placedItems, updateItem } = useRoomTwin.getState();
  placedItems.forEach((item) => {
    if (!item.ceilingMount) return;
    const fp = footprintOf(item.params, item.rotY || 0);
    const dropH = hangDrop(item);
    const c = resolveCeilingPlacement(item.uid, item.x!, item.z!, fp, dropH);
    if (Math.abs(c.x - item.x!) < 1e-4 && Math.abs(c.z - item.z!) < 1e-4) return;
    updateItem(item.uid, { x: c.x, z: c.z });
  });
}

export function raycastCeilingPlacement(cx: number, cy: number) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(ceilingColliderGroup.children, false);
  if (hits.length === 0) return null;
  return hits[0].point;
}