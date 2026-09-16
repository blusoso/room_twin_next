// lib/three/gizmo.ts
import * as THREE from "three";
import {
  GIZMO_SNAP_DEG,
  GIZMO_SNAP_THRESHOLD_DEG,
  WALL_OUTWARD,
} from "@/lib/data/constants";
import { useRoomTwin } from "@/lib/state/store";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import {
  roomGroup,
  camera,
  controls,
  raycaster,
  pointerNDC,
  renderer,
} from "./scene";
import { getWallGeom, wallPointXZ } from "./roomShell";
import {
  wallFootprint,
  resolveWallPlacement,
  wallItemWorldXZ,
  raycastWallPlaneUV,
} from "./wallPlacement";
import {
  footprintOf,
  resolvePlacement,
  applyTransformToDescendants,
  bottomOffsetFor,
} from "./placement";
import { resolveCeilingPlacement } from "./ceilingPlacement";
import { interactionState } from "./interactionState";
import { rebuildBaseboards } from "./roomShell";

// ===== Snap constants =====
export { GIZMO_SNAP_DEG, GIZMO_SNAP_THRESHOLD_DEG };

// ===== Gizmo meshes (module-level singleton) =====
export const gizmoGroup = new THREE.Group();
gizmoGroup.visible = false;
gizmoGroup.renderOrder = 10;

const gizmoRingMat = new THREE.MeshBasicMaterial({
  color: 0xb8752e,
  transparent: true,
  opacity: 0.3,
  side: THREE.DoubleSide,
  depthWrite: false,
  depthTest: false,
});
const gizmoRing = new THREE.Mesh(
  new THREE.RingGeometry(1, 1.055, 64),
  gizmoRingMat,
);
gizmoGroup.add(gizmoRing);

const gizmoLineMat = new THREE.LineBasicMaterial({
  color: 0xb8752e,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  depthTest: false,
});
const gizmoLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]),
  gizmoLineMat,
);
gizmoGroup.add(gizmoLine);

const gizmoHandleHalo = new THREE.Mesh(
  new THREE.SphereGeometry(0.135, 20, 16),
  new THREE.MeshBasicMaterial({
    color: 0xb8752e,
    transparent: true,
    opacity: 0.22,
    depthTest: false,
  }),
);
gizmoHandleHalo.renderOrder = 10;
gizmoGroup.add(gizmoHandleHalo);

const gizmoHandle = new THREE.Mesh(
  new THREE.SphereGeometry(0.095, 24, 18),
  new THREE.MeshBasicMaterial({ color: 0xb8752e, depthTest: false }),
);
gizmoHandle.renderOrder = 11;
gizmoGroup.add(gizmoHandle);

// Add to roomGroup (จะ visible เฉพาะตอน select)
roomGroup.add(gizmoGroup);

// ===== Drag state =====
export let gizmoDragState: { uid: string; wallMount: boolean } | null = null;
export let gizmoLastSnapped = false;

export function isGizmoDragging(): boolean {
  return gizmoDragState !== null;
}

// ===== DOM helper (lazy query เพราะ DOM พร้อมหลัง mount) =====
function getRotateBadge(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("rotateBadge");
}

// ===== Color =====
function gizmoSetColor(hex: number) {
  gizmoRingMat.color.setHex(hex);
  gizmoLineMat.color.setHex(hex);
  (gizmoHandle.material as THREE.MeshBasicMaterial).color.setHex(hex);
  (gizmoHandleHalo.material as THREE.MeshBasicMaterial).color.setHex(hex);
}

// ===== Radius =====
export function gizmoRadiusFor(
  dimsLike: any,
  wallMount: boolean,
  rot: number,
): number {
  if (wallMount) {
    const { halfU, halfV } = wallFootprint(dimsLike, rot);
    return Math.max(0.24, Math.hypot(halfU, halfV) + 0.13);
  }
  const fp = footprintOf(dimsLike, rot);
  return Math.max(0.32, Math.hypot(fp.w, fp.d) / 2 + 0.15);
}

// ===== Update per-frame (called in animation loop) =====
export function updateRotateGizmo() {
  const { selectedUid, selectedZoneUid, placedItems } = useRoomTwin.getState();

  // Hide if nothing selected, or dragging item/zone, or zone is selected
  if (
    !selectedUid ||
    interactionState.itemDragging ||
    interactionState.zoneDragging ||
    selectedZoneUid
  ) {
    gizmoGroup.visible = false;
    return;
  }

  const item = placedItems.find((i) => i.uid === selectedUid);
  const product = item && PRODUCT_BY_ID.get(item.productId);

  // Hide if locked, ceiling-mounted, or invalid
  if (!item || !product || item.locked || item.ceilingMount) {
    gizmoGroup.visible = false;
    return;
  }

  gizmoGroup.visible = true;
  gizmoSetColor(gizmoDragState && gizmoLastSnapped ? 0x5f7a63 : 0xb8752e);

  const params = item.params;

  if (item.wallMount) {
    // ===== Wall-mounted gizmo (vertical ring on wall plane) =====
    const rotZ = item.rotZ || 0;
    const r = gizmoRadiusFor(params, true, rotZ);
    gizmoRing.rotation.set(0, 0, 0);
    gizmoRing.scale.set(r, r, 1);

    const p = wallPointXZ(item.wallId!, item.u!, WALL_OUTWARD + 0.006);
    gizmoGroup.position.set(p.x, item.v!, p.z);
    gizmoGroup.rotation.set(0, item.rotY || 0, 0);

    const hx = -r * Math.sin(rotZ);
    const hy = r * Math.cos(rotZ);
    gizmoHandle.position.set(hx, hy, 0.012);
    gizmoHandleHalo.position.set(hx, hy, 0.012);

    // Update line geometry in-place
    const positions = gizmoLine.geometry.attributes.position;
    const arr = positions.array as Float32Array;
    arr[0] = 0;
    arr[1] = 0;
    arr[2] = 0.006;
    arr[3] = hx;
    arr[4] = hy;
    arr[5] = 0.012;
    positions.needsUpdate = true;
  } else {
    // ===== Floor-item gizmo (horizontal ring on floor plane) =====
    const rotY = item.rotY || 0;
    const r = gizmoRadiusFor(params, false, rotY);
    gizmoRing.rotation.set(-Math.PI / 2, 0, 0);
    gizmoRing.scale.set(r, r, 1);

    gizmoGroup.position.set(
      item.x!,
      (item.restY || 0) - bottomOffsetFor(item.uid) + 0.006,
      item.z!,
    );
    gizmoGroup.rotation.set(0, 0, 0);

    const hx = r * Math.sin(rotY);
    const hz = r * Math.cos(rotY);
    gizmoHandle.position.set(hx, 0.012, hz);
    gizmoHandleHalo.position.set(hx, 0.012, hz);

    const positions = gizmoLine.geometry.attributes.position;
    const arr = positions.array as Float32Array;
    arr[0] = 0;
    arr[1] = 0.006;
    arr[2] = 0;
    arr[3] = hx;
    arr[4] = 0.012;
    arr[5] = hz;
    positions.needsUpdate = true;
  }
}

// ===== Hit test =====
export function hitTestGizmoHandle(cx: number, cy: number): boolean {
  if (!gizmoGroup.visible || !renderer) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  return raycaster.intersectObject(gizmoHandle, false).length > 0;
}

// ===== Snap =====
export function snapDeg(deg: number): { deg: number; snapped: boolean } {
  const nearest = Math.round(deg / GIZMO_SNAP_DEG) * GIZMO_SNAP_DEG;
  return Math.abs(deg - nearest) <= GIZMO_SNAP_THRESHOLD_DEG
    ? { deg: nearest, snapped: true }
    : { deg, snapped: false };
}

// ===== Badge =====
export function showRotateBadge(
  cx: number,
  cy: number,
  deg: number,
  snapped: boolean,
) {
  const el = getRotateBadge();
  if (!el) return;
  let d = Math.round(deg) % 360;
  if (d < 0) d += 360;
  el.textContent = d + "°" + (snapped ? " • ตรงมุม" : "");
  el.classList.toggle("snapped", snapped);
  el.style.left = cx + "px";
  el.style.top = cy + "px";
  gizmoLastSnapped = snapped;
}

// ===== Floor plane raycast (helper) =====
const _gizmoFloorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function raycastFloorY(
  cx: number,
  cy: number,
  y: number,
): THREE.Vector3 | null {
  if (!renderer) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  _gizmoFloorPlane.constant = -y;
  const t = new THREE.Vector3();
  return raycaster.ray.intersectPlane(_gizmoFloorPlane, t) ? t : null;
}

// ===== Begin drag =====
export function beginGizmoRotate(e: PointerEvent) {
  e.preventDefault();
  e.stopPropagation();
  const { selectedUid, placedItems } = useRoomTwin.getState();
  if (!selectedUid) return;
  const item = placedItems.find((i) => i.uid === selectedUid);
  if (!item) return;

  gizmoDragState = { uid: selectedUid, wallMount: !!item.wallMount };
  if (controls) controls.enabled = false;

  try {
    renderer?.domElement.setPointerCapture(e.pointerId);
  } catch (err) {
    /* ignore */
  }
  if (renderer) renderer.domElement.style.cursor = "grabbing";
  getRotateBadge()?.classList.add("show");
}

// ===== Update drag =====
export function updateGizmoRotateDrag(cx: number, cy: number) {
  if (!gizmoDragState) return;
  const { placedItems, updateItem, room } = useRoomTwin.getState();
  const item = placedItems.find((i) => i.uid === gizmoDragState!.uid);
  if (!item) return;
  const product = PRODUCT_BY_ID.get(item.productId);
  if (!product) return;

  if (gizmoDragState.wallMount) {
    // Wall-mounted rotation
    const hit = raycastWallPlaneUV(item.wallId!, cx, cy);
    if (!hit) return;
    const du = hit.u - item.u!;
    const dv = hit.v - item.v!;
    if (Math.hypot(du, dv) < 0.02) return;

    const raw = THREE.MathUtils.radToDeg(Math.atan2(-du, dv));
    const s = snapDeg(raw);
    const rawRot = THREE.MathUtils.degToRad(s.deg);

    const { halfU, halfV } = wallFootprint(item.params, rawRot);
    const c = resolveWallPlacement(
      item.uid,
      item.wallId!,
      item.u!,
      item.v!,
      halfU,
      halfV,
      product.groundAnchor || false,
    );

    import("./instantiate").then(({ reinstantiateItem }) => {
      updateItem(item.uid, {
        u: c.u,
        v: c.v,
        rotZ: rawRot,
      });

      // ⭐ Rebuild baseboards ทันที ถ้าเป็นประตู
      if (product.id === "door") {
        rebuildBaseboards();
      }
      reinstantiateItem(item.uid);
    });

    showRotateBadge(cx, cy, s.deg, s.snapped);
  } else {
    // Floor item rotation
    const hit = raycastFloorY(cx, cy, (item.restY || 0) - bottomOffsetFor(item.uid));
    if (!hit) return;
    const dx = hit.x - item.x!;
    const dz = hit.z - item.z!;
    if (Math.hypot(dx, dz) < 0.05) return;

    const raw = THREE.MathUtils.radToDeg(Math.atan2(dx, dz));
    const s = snapDeg(raw);
    const rawRot = THREE.MathUtils.degToRad(s.deg);

    const fp = footprintOf(item.params, rawRot);
    const ox = item.x!;
    const oz = item.z!;
    const oRotY = item.rotY || 0;

    const c = resolvePlacement(
      item.uid,
      ox,
      oz,
      fp,
      item.parentUid,
      product.rug,
    );

    const dRot = rawRot - oRotY;

    applyTransformToDescendants(item.uid, ox, oz, c.x, c.z, dRot);

    updateItem(item.uid, {
      x: c.x,
      z: c.z,
      rotY: rawRot,
    });

    import("./scene").then(({ objectsByUid }) => {
      const obj = objectsByUid.get(item.uid);
      if (obj) {
        obj.position.set(c.x, (item.restY || 0) - bottomOffsetFor(item.uid), c.z);
        obj.rotation.y = rawRot;
      }
    });

    showRotateBadge(cx, cy, s.deg, s.snapped);
  }
}

// ===== End drag =====
export function endGizmoRotate(e?: PointerEvent) {
  if (!gizmoDragState) return;

  // ⭐ เก็บ uid ของ item ที่หมุน
  const rotatedUid = gizmoDragState.uid;

  if (controls) controls.enabled = true;
  if (renderer) renderer.domElement.style.cursor = "";
  getRotateBadge()?.classList.remove("show");

  try {
    if (e && renderer)
      renderer.domElement.releasePointerCapture(e.pointerId);
  } catch (err) {
    /* ignore */
  }

  // ⭐ Rebuild baseboards ถ้าหมุนประตู
  const { placedItems } = useRoomTwin.getState();
  const item = placedItems.find((i) => i.uid === rotatedUid);
  if (item?.productId === "door") {
    rebuildBaseboards();
  }

  // Save state
  Promise.all([
    import("@/lib/state/store"),
    import("./placement"),
  ]).then(([{ useRoomTwin }, { resolveRestHeights }]) => {
    resolveRestHeights();
  });

  gizmoDragState = null;
}
// ===== Rotate by 90° (for toolbar buttons) =====
export function rotateItemBy90(uid: string, dir: 1 | -1) {
  const { placedItems, updateItem, room } = useRoomTwin.getState();
  const item = placedItems.find((i) => i.uid === uid);
  if (!item || item.locked) return;
  const product = PRODUCT_BY_ID.get(item.productId);
  if (!product) return;

  // ===== Wall-mount =====
  if (item.wallMount) {
    const newRotZ =
      ((item.rotZ || 0) + (dir * Math.PI) / 2 + Math.PI * 8) % (Math.PI * 2);
    const { halfU, halfV } = wallFootprint(item.params, newRotZ);
    const c = resolveWallPlacement(
      uid,
      item.wallId!,
      item.u!,
      item.v!,
      halfU,
      halfV,
      product.groundAnchor || false,
    );
    updateItem(uid, { u: c.u, v: c.v, rotZ: newRotZ });
    Promise.all([
      import("./instantiate"),
      import("./roomShell"),
    ]).then(([{ reinstantiateItem }, { rebuildBaseboards }]) => {
      reinstantiateItem(uid);
      if (product.id === "door") rebuildBaseboards();
    });
    return;
  }

  // ===== Ceiling-mount =====
  if (item.ceilingMount) {
    const newRotY = (item.rotY || 0) + (dir * Math.PI) / 2;
    const fp = footprintOf(item.params, newRotY);
    const c = resolveCeilingPlacement(
      uid,
      item.x!,
      item.z!,
      fp,
      item.params.h / 100,
    );
    updateItem(uid, { x: c.x, z: c.z, rotY: newRotY });
    Promise.all([import("./scene")]).then(([{ objectsByUid }]) => {
      const obj = objectsByUid.get(uid);
      if (obj) {
        obj.position.set(c.x, room.h, c.z);
        obj.rotation.y = newRotY;
      }
    });
    return;
  }

  // ===== Floor =====
  const ox = item.x!;
  const oz = item.z!;
  const newRotY = (item.rotY || 0) + (dir * Math.PI) / 2;
  const fp = footprintOf(item.params, newRotY);
  const c = resolvePlacement(
    uid,
    ox,
    oz,
    fp,
    item.parentUid,
    product.rug,
  );

  applyTransformToDescendants(uid, ox, oz, c.x, c.z, (dir * Math.PI) / 2);
  updateItem(uid, { x: c.x, z: c.z, rotY: newRotY });

  Promise.all([
    import("./scene"),
    import("./placement"),
  ]).then(([{ objectsByUid }, { resolveRestHeights }]) => {
    const obj = objectsByUid.get(uid);
    if (obj) {
      obj.position.set(c.x, (item.restY || 0) - bottomOffsetFor(item.uid), c.z);
      obj.rotation.y = newRotY;
    }
    resolveRestHeights();
  });
}

// ===== Dispose =====
export function disposeGizmo() {
  gizmoDragState = null;
  gizmoLastSnapped = false;
  gizmoGroup.visible = false;
  gizmoRing.geometry.dispose();
  gizmoRingMat.dispose();
  gizmoLine.geometry.dispose();
  gizmoLineMat.dispose();
  gizmoHandle.geometry.dispose();
  (gizmoHandle.material as THREE.Material).dispose();
  gizmoHandleHalo.geometry.dispose();
  (gizmoHandleHalo.material as THREE.Material).dispose();
}