// lib/three/raycast.ts
import * as THREE from "three";
import {
  raycaster,
  pointerNDC,
  renderer,
  camera,
  floorGroup,
  ceilingColliderGroup,
  surfaceColliders,
  meshWallId,
  objectsByUid,
} from "./scene";
import { getWallGeom, getWall, WALLS, getPolyWalls } from "./roomShell";
import { useRoomTwin } from "@/lib/state/store";
import { collectDescendantUids } from "./placement";

// ============================================================
// raycastPlacement — วาง item บนพื้น/เฟอร์นิเจอร์
// ============================================================

export function raycastPlacement(
  cx: number,
  cy: number,
  excludeUid: string | null,
) {
  if (!renderer) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const ex = excludeUid ? collectDescendantUids(excludeUid) : null;
  const targets: THREE.Object3D[] = [...floorGroup.children];
  surfaceColliders.forEach((m) => {
    if (!ex || !ex.has(m.userData.hostUid)) targets.push(m);
  });

  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length === 0) return null;
  const hit = hits[0];
  const obj = hit.object as THREE.Mesh;
  const isFloor = obj.userData.isFloor === true;
  const hostUid = isFloor ? null : obj.userData.hostUid;
  return { point: hit.point, hostUid };
}

// ============================================================
// raycastWallPlacement — วาง item บนผนัง
// ============================================================

// lib/three/raycast.ts

export function raycastWallPlacement(cx: number, cy: number) {
  if (!renderer) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const { room } = useRoomTwin.getState();
  const targets: THREE.Mesh[] = [];

  if (room.shape === "rect") {
    Object.values(WALLS).forEach((w) => {
      if (w.mesh.visible && w.mat.opacity > 0.3) targets.push(w.mesh);
    });
  } else {
    getPolyWalls().forEach((w) => {
      if (w.mat.opacity > 0.3) targets.push(w.mesh);
    });
  }

  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length === 0) return null;

  const hit = hits[0];
  const mesh = hit.object as THREE.Mesh;
  const cellId = meshWallId.get(mesh);
  if (!cellId) return null;

  // ⭐ ใช้ cellId ตรงๆ (เก็บใน item.wallId)
  //    getWallGeom() จะคืน merged geom ถ้า cellId อยู่ใน merged
  const g = getWallGeom(cellId);
  if (!g) return null;

  const u = (hit.point.x - g.cx) * g.dx + (hit.point.z - g.cz) * g.dz;
  return { wallId: cellId, u, v: hit.point.y };
}

// ============================================================
// raycastCeilingPlacement
// ============================================================

export function raycastCeilingPlacement(cx: number, cy: number) {
  if (!renderer) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(
    ceilingColliderGroup.children,
    false,
  );
  if (hits.length === 0) return null;
  return hits[0].point;
}

// ============================================================
// raycastFloorPoint — จุดบนพื้น (y=0)
// ============================================================

export function raycastFloorPoint(cx: number, cy: number) {
  if (!renderer) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const t = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, t) ? t : null;
}

// ============================================================
// ⭐ hitTestPlacedItems — ใช้ getWall() เพื่อรองรับ merged wall
// ============================================================

export function hitTestPlacedItems(cx: number, cy: number): string | null {
  if (!renderer) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const allMeshes: THREE.Mesh[] = [];
  const { placedItems } = useRoomTwin.getState();

  objectsByUid.forEach((holder, uid) => {
    if (!holder || holder.visible === false) return;

    const item = placedItems.find((i) => i.uid === uid);

    // ⭐ Wall items — เช็ค opacity ผ่าน getWall() (รองรับ merged)
    if (item && item.wallMount && item.wallId) {
      const wd = getWall(item.wallId);
      if (!wd) {
        // wall ถูกลบไปแล้ว → ข้าม item นี้
        if (process.env.NODE_ENV === "development") {
          console.log(
            "[hitTest] skip — wall not found:",
            item.wallId,
            item.productId,
          );
        }
        return;
      }
      const opacity = wd.mat.opacity;
      if (opacity <= 0.3) {
        return;
      }
    }

    holder.traverse((o: any) => {
      if (o.isMesh) allMeshes.push(o);
    });
  });

  const hits = raycaster.intersectObjects(allMeshes, false);
  if (hits.length === 0) return null;

  let obj: THREE.Object3D | null = hits[0].object;
  while (obj && !obj.userData.uid) obj = obj.parent;
  if (!obj) return null;
  return obj.userData.uid as string;
}

// ============================================================
// isOverCanvas
// ============================================================

export function isOverCanvas(x: number, y: number): boolean {
  if (!renderer) return false;
  const r = renderer.domElement.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}