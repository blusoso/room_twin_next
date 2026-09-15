// lib/three/scaleGizmo.ts
import * as THREE from "three";
import { useRoomTwin } from "@/lib/state/store";
import { PARAM_SCHEMA } from "@/lib/data/schemas";
import {
  camera,
  renderer,
  raycaster,
  pointerNDC,
  controls,
  roomGroup,
} from "./scene";
import { reinstantiateItem } from "./instantiate";
import { resolveRestHeights } from "./placement";
import { getWallGeom } from "./roomShell";
import { isAnyDragging } from "./interactionState";

// ============================================================
// Config
// ============================================================

type Axis = "x" | "y" | "z";

const HANDLE_LEN = 0.45;      // ⭐ ใหญ่ชัดเจน
const HANDLE_THICK = 0.05;
const TIP_RADIUS = 0.085;
const HIT_RADIUS_PX = 36;     // ⭐ คลิกง่ายบนมือถือ

const COLORS: Record<Axis, { base: number; hover: number; active: number }> = {
  x: { base: 0xd94a3d, hover: 0xf5675a, active: 0xa62d22 }, // แดง = กว้าง
  y: { base: 0x4caf50, hover: 0x6dd170, active: 0x2e7031 }, // เขียว = สูง
  z: { base: 0x4285f4, hover: 0x6ba3f7, active: 0x1f5bbd }, // น้ำเงิน = ลึก
};

// ============================================================
// Handle builder (shaft + tip)
// ============================================================

interface HandleObj {
  group: THREE.Group;
  shaftMat: THREE.MeshStandardMaterial;
  tipMat: THREE.MeshStandardMaterial;
  tipMesh: THREE.Mesh;
}

function buildHandle(axis: Axis): HandleObj {
  const group = new THREE.Group();
  group.userData.axis = axis;

  const shaftMat = new THREE.MeshStandardMaterial({
    color: COLORS[axis].base,
    emissive: COLORS[axis].base,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.1,
  });

  const tipMat = new THREE.MeshStandardMaterial({
    color: COLORS[axis].base,
    emissive: COLORS[axis].base,
    emissiveIntensity: 0.7,
    roughness: 0.3,
    metalness: 0.15,
  });

  // ===== Shaft (box) =====
  const shaftLen = HANDLE_LEN - TIP_RADIUS * 0.5;
  const shaftGeo = new THREE.BoxGeometry(
    axis === "x" ? shaftLen : HANDLE_THICK,
    axis === "y" ? shaftLen : HANDLE_THICK,
    axis === "z" ? shaftLen : HANDLE_THICK,
  );
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  if (axis === "x") shaft.position.x = shaftLen / 2;
  else if (axis === "y") shaft.position.y = shaftLen / 2;
  else shaft.position.z = shaftLen / 2;
  shaft.renderOrder = 100;
  shaft.castShadow = false;
  shaft.receiveShadow = false;
  group.add(shaft);

  // ===== Tip (sphere) =====
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(TIP_RADIUS, 16, 12),
    tipMat,
  );
  const tipPos = shaftLen + TIP_RADIUS * 0.4;
  if (axis === "x") tip.position.x = tipPos;
  else if (axis === "y") tip.position.y = tipPos;
  else tip.position.z = tipPos;
  tip.renderOrder = 101;
  tip.castShadow = false;
  tip.receiveShadow = false;
  group.add(tip);

  return { group, shaftMat, tipMat, tipMesh: tip };
}

// ============================================================
// Gizmo group + handles
// ============================================================

export const scaleGizmoGroup = new THREE.Group();
scaleGizmoGroup.visible = false;
scaleGizmoGroup.renderOrder = 100;
roomGroup.add(scaleGizmoGroup);

const handles: Record<Axis, HandleObj> = {
  x: null as any,
  y: null as any,
  z: null as any,
};

function ensureHandles() {
  (["x", "y", "z"] as Axis[]).forEach((axis) => {
    if (!handles[axis]) {
      const h = buildHandle(axis);
      handles[axis] = h;
      scaleGizmoGroup.add(h.group);
      h.group.visible = false;
    }
  });
}
ensureHandles();

// ============================================================
// State
// ============================================================

interface DragState {
  uid: string;
  axis: Axis;
  startDimCm: number;
  startPixelY: number;
  localXdir: THREE.Vector3;
  localZdir: THREE.Vector3;
  wallU: number;
  baseWorldPos: THREE.Vector3;
}

let dragState: DragState | null = null;
let hoverAxis: Axis | null = null;

export function isScaleDragging(): boolean {
  return dragState !== null;
}
export function getScaleHover(): Axis | null {
  return hoverAxis;
}

// ============================================================
// Schema helpers
// ============================================================

function getDimConfig(productId: string, axis: Axis) {
  const schema = PARAM_SCHEMA[productId];
  if (!schema?.dims) return null;
  const key = axis === "x" ? "w" : axis === "y" ? "h" : "d";
  return schema.dims.find((d) => d.key === key) || null;
}
function dimKey(axis: Axis): "w" | "h" | "d" {
  return axis === "x" ? "w" : axis === "y" ? "h" : "d";
}

// ============================================================
// Update (per frame)
// ============================================================

export function updateScaleGizmo() {
  const store = useRoomTwin.getState();
  const uid = store.selectedUid;

  // Hide conditions
  if (!uid || store.selectedZoneUid || isAnyDragging()) {
    scaleGizmoGroup.visible = false;
    return;
  }

  const item = store.placedItems.find((i) => i.uid === uid);
  if (!item || item.locked) {
    scaleGizmoGroup.visible = false;
    return;
  }

  const p = item.params;
  const w = p.w / 100;
  const h = p.h / 100;
  const d = p.d / 100;
  const rotY = item.rotY || 0;

  // Available axes
  const hasX = !!getDimConfig(item.productId, "x");
  const hasY = !!getDimConfig(item.productId, "y");
  const hasZ = !!getDimConfig(item.productId, "z");

  if (!hasX && !hasY && !hasZ) {
    scaleGizmoGroup.visible = false;
    return;
  }

  // Position + orientation
  let baseY = 0;
  let wallCenterY = 0;

  if (item.wallMount) {
    const g = getWallGeom(item.wallId!);
    if (!g) {
      scaleGizmoGroup.visible = false;
      return;
    }
    const cx = g.cx + g.dx * (item.u || 0) - g.nx * 0.012;
    const cz = g.cz + g.dz * (item.u || 0) - g.nz * 0.012;
    scaleGizmoGroup.position.set(cx, item.v || 0, cz);
    scaleGizmoGroup.rotation.set(0, rotY, 0);
    baseY = 0;
    wallCenterY = 0;
  } else if (item.ceilingMount) {
    scaleGizmoGroup.position.set(item.x || 0, store.room.h, item.z || 0);
    scaleGizmoGroup.rotation.set(0, rotY, 0);
    baseY = 0;
  } else {
    scaleGizmoGroup.position.set(item.x || 0, item.restY || 0, item.z || 0);
    scaleGizmoGroup.rotation.set(0, rotY, 0);
    baseY = h / 2;
  }

  // Layout handles at edges
  if (hasX) {
    handles.x.group.visible = true;
    if (item.wallMount) {
      handles.x.group.position.set(w / 2, 0, 0);
    } else if (item.ceilingMount) {
      handles.x.group.position.set(w / 2, 0, 0);
    } else {
      handles.x.group.position.set(w / 2, baseY, 0);
    }
  } else {
    handles.x.group.visible = false;
  }

  if (hasY && !item.ceilingMount) {
    handles.y.group.visible = true;
    if (item.wallMount) {
      handles.y.group.position.set(0, h / 2, 0);
    } else {
      handles.y.group.position.set(0, h, 0);
    }
  } else {
    handles.y.group.visible = false;
  }

  if (hasZ && !item.wallMount) {
    handles.z.group.visible = true;
    if (item.ceilingMount) {
      handles.z.group.position.set(0, 0, d / 2);
    } else {
      handles.z.group.position.set(0, baseY, d / 2);
    }
  } else {
    handles.z.group.visible = false;
  }

  scaleGizmoGroup.visible = true;

  // Update colors
  (["x", "y", "z"] as Axis[]).forEach((axis) => {
    const h = handles[axis];
    if (!h.group.visible) return;
    let color = COLORS[axis].base;
    if (dragState && dragState.axis === axis) color = COLORS[axis].active;
    else if (hoverAxis === axis) color = COLORS[axis].hover;
    h.shaftMat.color.setHex(color);
    h.shaftMat.emissive.setHex(color);
    h.tipMat.color.setHex(color);
    h.tipMat.emissive.setHex(color);
  });
}

// ============================================================
// Screen-space hit test (tip of each arrow)
// ============================================================

const _tipWorld = new THREE.Vector3();
const _tipNDC = new THREE.Vector3();

function getTipScreen(axis: Axis): { x: number; y: number } | null {
  const h = handles[axis];
  if (!h.group.visible) return null;

  scaleGizmoGroup.updateMatrixWorld(true);
  h.tipMesh.getWorldPosition(_tipWorld);

  _tipNDC.copy(_tipWorld).project(camera);
  if (_tipNDC.z > 1) return null;

  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: (_tipNDC.x * 0.5 + 0.5) * rect.width,
    y: (-_tipNDC.y * 0.5 + 0.5) * rect.height,
  };
}

export function hitTestScaleGizmo(cx: number, cy: number): Axis | null {
  if (!scaleGizmoGroup.visible) return null;

  let best: Axis | null = null;
  let bestDist = HIT_RADIUS_PX;

  (["x", "y", "z"] as Axis[]).forEach((axis) => {
    const s = getTipScreen(axis);
    if (!s) return;
    const dist = Math.hypot(s.x - cx, s.y - cy);
    if (dist < bestDist) {
      bestDist = dist;
      best = axis;
    }
  });

  return best;
}

export function updateScaleHover(cx: number, cy: number) {
  hoverAxis = hitTestScaleGizmo(cx, cy);
}

// ============================================================
// Begin drag
// ============================================================

export function beginScaleDrag(axis: Axis, e: PointerEvent) {
  const store = useRoomTwin.getState();
  const uid = store.selectedUid;
  if (!uid) return;
  const item = store.placedItems.find((i) => i.uid === uid);
  if (!item) return;

  const key = dimKey(axis);
  const startDimCm = (item.params as any)[key] as number;

  const rotY = item.rotY || 0;
  const localXdir = new THREE.Vector3(Math.cos(rotY), 0, -Math.sin(rotY));
  const localZdir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));

  dragState = {
    uid,
    axis,
    startDimCm,
    startPixelY: e.clientY,
    localXdir,
    localZdir,
    wallU: item.u || 0,
    baseWorldPos: scaleGizmoGroup.position.clone(),
  };

  controls.enabled = false;
  try {
    renderer.domElement.setPointerCapture(e.pointerId);
  } catch {}
  renderer.domElement.style.cursor = "grabbing";
}

// ============================================================
// Update drag
// ============================================================

export function updateScaleDrag(cx: number, cy: number) {
  if (!dragState) return;
  const store = useRoomTwin.getState();
  const item = store.placedItems.find((i) => i.uid === dragState!.uid);
  if (!item) return;

  const axis = dragState.axis;
  const cfg = getDimConfig(item.productId, axis);
  if (!cfg) return;

  const key = dimKey(axis);
  const { min, max, step } = cfg;

  let newDimCm = dragState.startDimCm;

  if (item.wallMount) {
    const g = getWallGeom(item.wallId!);
    if (!g) return;
    const plane = new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(g.nx, 0, g.nz),
      new THREE.Vector3(g.cx, 0, g.cz),
    );
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const t = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, t)) return;
    const clickU = (t.x - g.cx) * g.dx + (t.z - g.cz) * g.dz;
    const halfDist = Math.abs(clickU - dragState.wallU);
    newDimCm = halfDist * 2 * 100;
  } else if (item.ceilingMount) {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -store.room.h);
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const t = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, t)) return;
    const dx = t.x - (item.x || 0);
    const dz = t.z - (item.z || 0);
    const lx = dx * dragState.localXdir.x + dz * dragState.localXdir.z;
    const lz = dx * dragState.localZdir.x + dz * dragState.localZdir.z;
    const halfDist = axis === "x" ? Math.abs(lx) : Math.abs(lz);
    newDimCm = halfDist * 2 * 100;
  } else {
    if (axis === "y") {
      const dyPixels = dragState.startPixelY - cy;
      const itemPos = new THREE.Vector3(
        item.x || 0,
        (item.restY || 0) + item.params.h / 200,
        item.z || 0,
      );
      const dist = camera.position.distanceTo(itemPos);
      const pixelsPerMeter =
        renderer.domElement.clientHeight /
        (2 * Math.tan((camera.fov / 2) * (Math.PI / 180)) * dist);
      const cmPerPixel = (1 / pixelsPerMeter) * 100;
      newDimCm = dragState.startDimCm + dyPixels * cmPerPixel;
    } else {
      const planeY = (item.restY || 0) + item.params.h / 200;
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const t = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, t)) return;
      const dx = t.x - (item.x || 0);
      const dz = t.z - (item.z || 0);
      const lx = dx * dragState.localXdir.x + dz * dragState.localXdir.z;
      const lz = dx * dragState.localZdir.x + dz * dragState.localZdir.z;
      const halfDist = axis === "x" ? Math.abs(lx) : Math.abs(lz);
      newDimCm = halfDist * 2 * 100;
    }
  }

  const stepCm = step || 1;
  newDimCm = Math.round(newDimCm / stepCm) * stepCm;
  newDimCm = Math.max(min, Math.min(max, newDimCm));

  if (newDimCm === (item.params as any)[key]) return;

  const newParams = { ...item.params, [key]: newDimCm };
  store.updateItem(item.uid, { params: newParams });
  reinstantiateItem(item.uid);
}

// ============================================================
// End drag
// ============================================================

export function endScaleDrag(e?: PointerEvent) {
  if (!dragState) return;
  dragState = null;
  controls.enabled = true;
  renderer.domElement.style.cursor = "";
  try {
    if (e) renderer.domElement.releasePointerCapture(e.pointerId);
  } catch {}
  resolveRestHeights();
  import("./reclamp").then(({ reclampWallItems }) => {
    reclampWallItems();
  });
  hideScaleBadge();
}

// ============================================================
// Badge (แสดงขนาดระหว่างลาก)
// ============================================================

export function updateScaleBadge(cx: number, cy: number) {
  if (typeof document === "undefined") return;
  const el = document.getElementById("scaleBadge");
  if (!el) return;

  if (!dragState) {
    el.classList.remove("show");
    return;
  }
  const store = useRoomTwin.getState();
  const item = store.placedItems.find((i) => i.uid === dragState!.uid);
  if (!item) return;

  const axis = dragState.axis;
  const key = dimKey(axis);
  const label = axis === "x" ? "กว้าง" : axis === "y" ? "สูง" : "ลึก";
  const valueCm = (item.params as any)[key] as number;

  el.textContent = `${label} ${(valueCm / 100).toFixed(2)} ม.`;
  el.style.left = cx + "px";
  el.style.top = cy - 50 + "px";
  el.classList.add("show");
}

function hideScaleBadge() {
  if (typeof document === "undefined") return;
  const el = document.getElementById("scaleBadge");
  if (el) el.classList.remove("show");
}

// ============================================================
// Dispose
// ============================================================

export function disposeScaleGizmo() {
  dragState = null;
  hoverAxis = null;
  scaleGizmoGroup.visible = false;
}