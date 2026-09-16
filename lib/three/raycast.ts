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
import { isHostSurfaceProduct } from "@/lib/data/products";
import {
  mountPlane,
  targetOfItem,
  faceFromWorldNormal,
  facingFace,
  MOUNT_FACES,
  type MountTarget,
} from "./wallPlacement";
import type { MountFace } from "@/lib/state/types";

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
// raycastWallPlacement — วาง item บนผนัง หรือผิวของไอเทม (เสา/ฉากกั้น/ประตู/หน้าต่าง)
// ============================================================

export interface WallPlacementHit {
  target: MountTarget;
  /** ตำแหน่งตามแนวนอนของพื้ นผิว (เมตร) */
  u: number;
  /** ความสูงจากฐานของพื้ นผิว (เมตร) */
  v: number;
}

/** ⭐ mesh ของไอเทมที่เป็นพื้ นผิวแขวนได้ (ใช้เป็นเป้า raycast) */
function hostSurfaceMeshes(excludeUid?: string | null): THREE.Mesh[] {
  const { placedItems } = useRoomTwin.getState();
  const hostable = new Set(
    placedItems
      .filter((i) => isHostSurfaceProduct(i.productId))
      .map((i) => i.uid),
  );
  const out: THREE.Mesh[] = [];
  objectsByUid.forEach((holder, uid) => {
    if (!holder || holder.visible === false) return;
    if (!hostable.has(uid)) return;
    if (excludeUid && uid === excludeUid) return;
    holder.traverse((o: any) => {
      if (o.isMesh && o.visible !== false) out.push(o);
    });
  });
  return out;
}

export function raycastWallPlacement(
  cx: number,
  cy: number,
  opts?: { allowHost?: boolean; excludeUid?: string | null },
): WallPlacementHit | null {
  if (!renderer) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const { room } = useRoomTwin.getState();
  const allowHost = opts?.allowHost !== false;
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

  const wallHits = raycaster.intersectObjects(targets, false);
  const hostHits = allowHost
    ? raycaster.intersectObjects(hostSurfaceMeshes(opts?.excludeUid), false)
    : [];

  const wallHit = wallHits[0] ?? null;
  const hostHit = hostHits[0] ?? null;

  // ⭐ ตัวที่ใกล้กล้องที่สุดชนะ — ของที่แขวนอยู่หน้าเสา/ประตู จึงติดพื้ นผิวนั้น
  if (hostHit && (!wallHit || hostHit.distance <= wallHit.distance)) {
    const hit = resolveHostHit(hostHit);
    if (hit) return hit;
  }

  if (!wallHit) return null;
  const mesh = wallHit.object as THREE.Mesh;
  const cellId = meshWallId.get(mesh);
  if (!cellId) return null;

  // ⭐ ใช้ cellId ตรงๆ (เก็บใน item.wallId)
  //    getWallGeom() จะคืน merged geom ถ้า cellId อยู่ใน merged
  const g = getWallGeom(cellId);
  if (!g) return null;

  const target: MountTarget = { kind: "wall", wallId: cellId };
  const plane = mountPlane(target);
  if (!plane) return null;

  const u =
    (wallHit.point.x - plane.cx) * plane.dx +
    (wallHit.point.z - plane.cz) * plane.dz;
  return { target, u, v: wallHit.point.y - plane.baseY };
}

/** ⭐ แปลง hit บน mesh ของไอเทม → target (hostUid + face) + u/v */
function resolveHostHit(hit: THREE.Intersection): WallPlacementHit | null {
  let obj: THREE.Object3D | null = hit.object;
  while (obj && !obj.userData.uid) obj = obj.parent;
  const hostUid = obj?.userData.uid as string | undefined;
  if (!hostUid) return null;

  const { placedItems } = useRoomTwin.getState();
  const host = placedItems.find((i) => i.uid === hostUid);
  if (!host || !isHostSurfaceProduct(host.productId)) return null;

  // rotY ของ host ในโลก (ของติดผนัง derive จากพื้ นผิวที่มันแขวนอยู่)
  const hostTarget = targetOfItem(host);
  const hostPlane = hostTarget ? mountPlane(hostTarget) : null;
  const hostRotY = host.wallMount
    ? hostPlane?.rotY ?? 0
    : host.rotY ?? 0;

  // normal จริงที่ ray ชน → face ใน local frame ของ host
  let face: MountFace | null = null;
  if (hit.face) {
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(
      hit.object.matrixWorld,
    );
    const worldNormal = hit.face.normal
      .clone()
      .applyMatrix3(normalMatrix)
      .normalize();
    face = faceFromWorldNormal(hostRotY, worldNormal);
  }

  if (!face) {
    // ผิวบน/ล่าง (หรือไม่มี normal) → เลือกผิวที่หันหากล้องมากที่สุด
    const hostX = host.wallMount ? hostPlane?.cx ?? 0 : host.x ?? 0;
    const hostZ = host.wallMount ? hostPlane?.cz ?? 0 : host.z ?? 0;
    face = facingFace(
      hostRotY,
      hostX,
      hostZ,
      camera.position.x,
      camera.position.y,
      camera.position.z,
    );
  }

  const target: MountTarget = { kind: "item", hostUid, face };
  const plane = mountPlane(target);
  if (!plane) return null;

  // ⭐ กันเหนียว: ถ้าจุดที่ชนอยู่นอกช่วงผิวที่เลือก (เช่น ชนมุม/ผิวบน)
  //    ให้เลือกผิวใหม่ที่ "จุดชนอยู่ด้านนอกของผิวนั้น" และอยู่ในช่วงความกว้าง
  const uRaw =
    (hit.point.x - plane.cx) * plane.dx + (hit.point.z - plane.cz) * plane.dz;
  if (Math.abs(uRaw) > plane.len / 2) {
    const alt = MOUNT_FACES.find((f) => {
      if (f === face) return false;
      const p = mountPlane({ kind: "item", hostUid, face: f });
      if (!p) return false;
      // ต้องอยู่ด้านนอกของผิว (ไม่ใช่ด้านตรงข้าม)
      const outside =
        (hit.point.x - p.cx) * p.nx + (hit.point.z - p.cz) * p.nz;
      if (outside < -0.02) return false;
      const uu =
        (hit.point.x - p.cx) * p.dx + (hit.point.z - p.cz) * p.dz;
      return Math.abs(uu) <= p.len / 2;
    });
    if (alt) {
      const p = mountPlane({ kind: "item", hostUid, face: alt });
      if (p) {
        return {
          target: { kind: "item", hostUid, face: alt },
          u: (hit.point.x - p.cx) * p.dx + (hit.point.z - p.cz) * p.dz,
          v: hit.point.y - p.baseY,
        };
      }
    }
  }

  return { target, u: uRaw, v: hit.point.y - plane.baseY };
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