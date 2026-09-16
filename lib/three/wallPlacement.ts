// lib/three/wallPlacement.ts
import * as THREE from "three";
import { WALL_MARGIN, WALL_V_MIN, WALL_OUTWARD } from "@/lib/data/constants";
import { useRoomTwin } from "@/lib/state/store";
import { isHostSurfaceProduct } from "@/lib/data/products";
import { getWallGeom, findFloorYAt } from "./roomShell";
import { raycaster, pointerNDC, renderer, camera } from "./scene";
import type { MountFace, PlacedItem } from "@/lib/state/types";

// ============================================================
// ⭐ Mount surface — ผนังห้อง หรือผิวด้านตั้งของไอเทม (เสา/ฉากกั้น/ประตู/หน้าต่าง)
// ============================================================

/** จุดหมายที่แขวนของติดผนัง */
export type MountTarget =
  | { kind: "wall"; wallId: string }
  | { kind: "item"; hostUid: string; face: MountFace };

/**
 * ⭐ ระนาบของพื้นผิวที่แขวน (หน่วยเมตร, world space)
 *    - (dx,dz) = แกน u (แนวนอนตามผิว)
 *    - (nx,nz) = outward normal หันออกจากผิวเข้าหาห้อง (ทิศที่ item หันหน้าไป)
 *    - baseY/topY = ขอบล่าง/บนของผิว (world)
 *    - v ของ item นับจาก baseY → ผนังห้อง baseY = 0 จึงเหมือนเดิมทุกประการ
 */
export interface MountPlane {
  cx: number;
  cz: number;
  dx: number;
  dz: number;
  nx: number;
  nz: number;
  len: number;
  baseY: number;
  topY: number;
  rotY: number;
}

/** ⭐ target ของ item ที่แขวนอยู่ (host ก่อน — ถ้าไม่มีจึงเป็นผนัง) */
export function targetOfItem(item: PlacedItem): MountTarget | null {
  if (item.mountUid && item.mountFace) {
    return { kind: "item", hostUid: item.mountUid, face: item.mountFace };
  }
  if (item.wallId) return { kind: "wall", wallId: item.wallId };
  return null;
}

/** ⭐ key สำหรับเทียบว่า "พื้ นผิวเดียวกัน" (ใช้ใน overlap resolution) */
export function targetKey(target: MountTarget): string {
  return target.kind === "wall"
    ? `wall:${target.wallId}`
    : `item:${target.hostUid}:${target.face}`;
}

export const MOUNT_FACES: MountFace[] = ["pz", "nz", "px", "nx"];

/**
 * ⭐ คำนวณระนาบพื้ นผิวของ target
 *    - ผนังห้อง: ใช้ getWallGeom() ตรง ๆ (rotY/dx/dz เดิมเป๊ะ ไม่แตะพฤติกรรมเดิม)
 *    - ไอเทม: ผิวด้านตั้งของ bbox (params.w × params.d) ที่หมุนด้วย rotY ของ host
 */
export function mountPlane(
  target: MountTarget,
  depth = 0,
): MountPlane | null {
  if (depth > 4) return null;

  if (target.kind === "wall") {
    const g = getWallGeom(target.wallId);
    if (!g) return null;
    const { room } = useRoomTwin.getState();
    return {
      cx: g.cx,
      cz: g.cz,
      dx: g.dx,
      dz: g.dz,
      // ⭐ getWallGeom().n* ชี้ "ออกนอกห้อง" — พลิกให้เป็นทิศที่ item หันหน้าไป
      nx: -g.nx,
      nz: -g.nz,
      len: g.len,
      baseY: 0,
      topY: room.h,
      rotY: g.rotY,
    };
  }

  const { placedItems } = useRoomTwin.getState();
  const host = placedItems.find((i) => i.uid === target.hostUid);
  if (!host || !isHostSurfaceProduct(host.productId)) return null;

  const w = (host.params.w ?? 0) / 100;
  const d = (host.params.d ?? 0) / 100;
  const h = (host.params.h ?? 0) / 100;

  let hx: number;
  let hz: number;
  let hostRotY: number;
  let baseY: number;
  let topY: number;

  if (host.wallMount) {
    // ประตู/หน้าต่าง/ประตูเลื่อน — ยืนอยู่บนผนังของตัวเอง
    const hp = targetOfItem(host);
    if (!hp) return null;
    const wp = mountPlane(hp, depth + 1);
    if (!wp) return null;
    const p = mountPointXZ(wp, host.u ?? 0, WALL_OUTWARD);
    hx = p.x;
    hz = p.z;
    hostRotY = wp.rotY;
    const centerY = wp.baseY + (host.v ?? 0);
    baseY = centerY - h / 2;
    topY = centerY + h / 2;
  } else {
    hx = host.x ?? 0;
    hz = host.z ?? 0;
    hostRotY = host.rotY ?? 0;
    baseY = host.restY ?? 0;
    topY = baseY + h;
  }

  const cos = Math.cos(hostRotY);
  const sin = Math.sin(hostRotY);

  // local frame → world: local +z = (sin, cos), local +x = (cos, -sin)
  const rotX = (ox: number, oz: number) => ox * cos + oz * sin;
  const rotZ = (ox: number, oz: number) => -ox * sin + oz * cos;

  let nx: number;
  let nz: number;
  let dx: number;
  let dz: number;
  let len: number;
  let ox: number;
  let oz: number;

  switch (target.face) {
    case "pz":
      nx = sin; nz = cos;
      dx = cos; dz = -sin;
      len = w;
      ox = 0; oz = d / 2;
      break;
    case "nz":
      nx = -sin; nz = -cos;
      dx = -cos; dz = sin;
      len = w;
      ox = 0; oz = -d / 2;
      break;
    case "px":
      nx = cos; nz = -sin;
      dx = sin; dz = cos;
      len = d;
      ox = w / 2; oz = 0;
      break;
    default: // nx
      nx = -cos; nz = sin;
      dx = -sin; dz = -cos;
      len = d;
      ox = -w / 2; oz = 0;
      break;
  }

  return {
    cx: hx + rotX(ox, oz),
    cz: hz + rotZ(ox, oz),
    dx,
    dz,
    nx,
    nz,
    len,
    baseY,
    topY,
    // ⭐ rotY ของ item ที่แขวน = ทิศที่ local +z หันไป = normal ของผิว
    rotY: Math.atan2(nx, nz),
  };
}

/** จุดบนพื้ นผิวตามแกน u + ระยะ offset ตาม normal (เข้าห้องเป็นบวก) */
export function mountPointXZ(
  plane: MountPlane,
  u: number,
  offset: number,
) {
  return {
    x: plane.cx + plane.dx * u + plane.nx * offset,
    z: plane.cz + plane.dz * u + plane.nz * offset,
  };
}

/** ⭐ ระยะที่ item ต้องออกจากพื้ นผิว — ผนังใช้ค่าเดิม, host ใช้ครึ่งความลึกของ item */
export function mountOutwardFor(target: MountTarget, depthCm: number) {
  // depthCm (ซม.) → ครึ่งความลึก (ม.) = depthCm / 200
  return target.kind === "wall" ? WALL_OUTWARD : depthCm / 200 + 0.002;
}

// ============================================================
// Footprint / clamp / overlap
// ============================================================

export function wallFootprint(dimsLike: any, rotZ: number | undefined) {
  const d = dimsLike.dims || dimsLike;
  const hw = d.w / 100 / 2;
  const hh = d.h / 100 / 2;
  const c = Math.abs(Math.cos(rotZ || 0));
  const s = Math.abs(Math.sin(rotZ || 0));
  return { halfU: hw * c + hh * s, halfV: hw * s + hh * c };
}

export function clampWallPosition(
  target: MountTarget,
  u: number,
  v: number,
  hu: number,
  hv: number,
  ground: boolean,
) {
  const plane = mountPlane(target);
  if (!plane) return { u, v };

  const span = plane.len;
  const mnU = -span / 2 + WALL_MARGIN + hu;
  const mxU = span / 2 - WALL_MARGIN - hu;
  const cu = mnU <= mxU ? Math.max(mnU, Math.min(mxU, u)) : 0;

  // ⭐ ระดับขั้นต่ำ/สูงสุดของพื้ นผิว (ผนังห้อง = 0.55 .. room.h - 0.15 เหมือนเดิม)
  const extent = plane.topY - plane.baseY;
  const mnV = (target.kind === "wall" ? WALL_V_MIN : 0) + hv;
  const mxV = (target.kind === "wall" ? extent - 0.15 : extent) - hv;
  const centerV =
    target.kind === "wall" ? (WALL_V_MIN + extent - 0.15) / 2 : extent / 2;

  let v2: number;
  if (ground) {
    // ⭐ ground-anchor (ม่าน/ประตู) — resting บนสแลบ (รังสียิงสะท้อน -> top ของพื้น/บล็อกยก)
    const wp = mountPointXZ(plane, cu, WALL_OUTWARD);
    v2 = findFloorYAt(wp.x, wp.z) + hv - plane.baseY;
    if (target.kind !== "wall") {
      v2 = mnV <= mxV ? Math.max(mnV, Math.min(mxV, v2)) : centerV;
    }
  } else {
    v2 = mnV <= mxV ? Math.max(mnV, Math.min(mxV, v)) : centerV;
  }

  return { u: cu, v: v2 };
}

export function resolveWallOverlap(
  uid: string | null,
  target: MountTarget,
  u: number,
  v: number,
  hu: number,
  hv: number,
) {
  const { placedItems } = useRoomTwin.getState();
  const key = targetKey(target);
  const obs: any[] = [];
  placedItems.forEach((o) => {
    if (o.uid === uid || !o.wallMount) return;
    const t = targetOfItem(o);
    if (!t || targetKey(t) !== key) return;
    const ofp = wallFootprint(o.params, o.rotZ);
    obs.push({ u: o.u!, v: o.v!, halfU: ofp.halfU, halfV: ofp.halfV });
  });
  let pu = u, pv = v;
  for (let p = 0; p < 6; p++) {
    let moved = false;
    obs.forEach((o) => {
      const oU = hu + o.halfU - Math.abs(pu - o.u);
      const oV = hv + o.halfV - Math.abs(pv - o.v);
      if (oU > 0 && oV > 0) {
        moved = true;
        if (oU < oV) {
          const d = pu - o.u >= 0 ? 1 : -1;
          pu = o.u + d * (hu + o.halfU + 0.01);
        } else {
          const d = pv - o.v >= 0 ? 1 : -1;
          pv = o.v + d * (hv + o.halfV + 0.01);
        }
      }
    });
    if (!moved) break;
  }
  return { u: pu, v: pv };
}

export function resolveWallPlacement(
  uid: string | null,
  target: MountTarget,
  u: number,
  v: number,
  hu: number,
  hv: number,
  ground: boolean,
) {
  let c = clampWallPosition(target, u, v, hu, hv, ground);
  c = resolveWallOverlap(uid, target, c.u, c.v, hu, hv);
  c = clampWallPosition(target, c.u, c.v, hu, hv, ground);
  return c;
}

// ============================================================
// World transform ของ item ที่แขวนอยู่
// ============================================================

/** ⭐ ตำแหน่ง/การหมุนจริงของ item ที่แขวน (world) — y = baseY + v */
export function wallItemWorld(item: PlacedItem) {
  const target = targetOfItem(item);
  if (!target) return null;
  const plane = mountPlane(target);
  if (!plane) return null;
  const outward = mountOutwardFor(target, item.params?.d ?? 0);
  const p = mountPointXZ(plane, item.u ?? 0, outward);
  return {
    x: p.x,
    y: plane.baseY + (item.v ?? 0),
    z: p.z,
    rotY: plane.rotY,
  };
}

// ============================================================
// Raycast บนระนาบพื้ นผิว (ใช้ตอนหมุน item ที่แขวน)
// ============================================================

export function raycastWallPlaneUV(
  target: MountTarget,
  cx: number,
  cy: number,
) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const p = mountPlane(target);
  if (!p) return null;
  const plane = new THREE.Plane();
  plane.setFromNormalAndCoplanarPoint(
    new THREE.Vector3(p.nx, 0, p.nz),
    new THREE.Vector3(p.cx, 0, p.cz),
  );
  const t = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, t)) return null;
  const u = (t.x - p.cx) * p.dx + (t.z - p.cz) * p.dz;
  return { u, v: t.y - p.baseY };
}

// ============================================================
// ⭐ หา face ของ host จาก normal จริงที่ ray ชน
// ============================================================

/** normal (world) → face ใน local frame ของ host; คืน null ถ้ามองไม่ออก */
export function faceFromWorldNormal(
  hostRotY: number,
  worldNormal: THREE.Vector3,
): MountFace | null {
  // world → local (inverse rotation รอบแกน Y)
  const cos = Math.cos(-hostRotY);
  const sin = Math.sin(-hostRotY);
  const lx = worldNormal.x * cos + worldNormal.z * sin;
  const lz = -worldNormal.x * sin + worldNormal.z * cos;

  if (Math.abs(worldNormal.y) > Math.max(Math.abs(lx), Math.abs(lz))) {
    return null; // ผิวบน/ล่าง — ให้ผู้เรียก fallback เป็นผิวที่หันหากล้อง
  }

  if (Math.abs(lz) >= Math.abs(lx)) return lz >= 0 ? "pz" : "nz";
  return lx >= 0 ? "px" : "nx";
}

/** ⭐ ผิวที่หันเข้าหากล้องมากที่สุด (fallback ตอน ray ชนผิวบน/ล่าง) */
export function facingFace(
  hostRotY: number,
  fromX: number,
  fromZ: number,
  camX: number,
  camY: number,
  camZ: number,
): MountFace {
  const vx = camX - fromX;
  const vz = camZ - fromZ;
  const vlen = Math.hypot(vx, vz) || 1;
  const ux = vx / vlen;
  const uz = vz / vlen;

  let best: MountFace = "pz";
  let bestDot = -Infinity;
  MOUNT_FACES.forEach((face) => {
    const p = faceNormalOf(hostRotY, face);
    const dot = p.x * ux + p.z * uz;
    if (dot > bestDot) {
      bestDot = dot;
      best = face;
    }
  });
  return best;
}

/** normal ของ face (world) จาก rotY ของ host */
export function faceNormalOf(hostRotY: number, face: MountFace) {
  const cos = Math.cos(hostRotY);
  const sin = Math.sin(hostRotY);
  switch (face) {
    case "pz":
      return { x: sin, z: cos };
    case "nz":
      return { x: -sin, z: -cos };
    case "px":
      return { x: cos, z: -sin };
    default:
      return { x: -cos, z: sin };
  }
}
