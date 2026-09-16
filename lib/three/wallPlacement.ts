// lib/three/wallPlacement.ts
import * as THREE from "three";
import { WALL_MARGIN, WALL_V_MIN, WALL_OUTWARD } from "@/lib/data/constants";
import { useRoomTwin } from "@/lib/state/store";
import { getWallGeom, wallSpan, findFloorYAt } from "./roomShell";
import { raycaster, pointerNDC, renderer, camera, meshWallId } from "./scene";

export function wallFootprint(dimsLike: any, rotZ: number | undefined) {
  const d = dimsLike.dims || dimsLike;
  const hw = d.w / 100 / 2;
  const hh = d.h / 100 / 2;
  const c = Math.abs(Math.cos(rotZ || 0));
  const s = Math.abs(Math.sin(rotZ || 0));
  return { halfU: hw * c + hh * s, halfV: hw * s + hh * c };
}

export function clampWallPosition(
  id: string, u: number, v: number, hu: number, hv: number, ground: boolean,
) {
  const { room } = useRoomTwin.getState();
  const span = wallSpan(id);
  const mnU = -span / 2 + WALL_MARGIN + hu;
  const mxU = span / 2 - WALL_MARGIN - hu;
  let v2: number;
  if (ground) {
    // ⭐ ground-anchor (ประตู/หน้าต่าง) — resting บนสแลบ (รังสียิงสะท้อน -> top ของพื้น/บล็อกยก)
    const wp = wallPointXZ(id, u, WALL_OUTWARD);
    v2 = findFloorYAt(wp.x, wp.z) + hv;
  } else {
    const vMax = room.h - 0.15;
    const mnV = WALL_V_MIN + hv;
    const mxV = vMax - hv;
    v2 = mnV <= mxV ? Math.max(mnV, Math.min(mxV, v)) : (WALL_V_MIN + vMax) / 2;
  }
  return { u: mnU <= mxU ? Math.max(mnU, Math.min(mxU, u)) : 0, v: v2 };
}

export function resolveWallOverlap(
  uid: string | null, id: string, u: number, v: number, hu: number, hv: number,
) {
  const { placedItems } = useRoomTwin.getState();
  const obs: any[] = [];
  placedItems.forEach((o) => {
    if (o.uid === uid || !o.wallMount || o.wallId !== id) return;
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
  uid: string | null, id: string, u: number, v: number,
  hu: number, hv: number, ground: boolean,
) {
  let c = clampWallPosition(id, u, v, hu, hv, ground);
  c = resolveWallOverlap(uid, id, c.u, c.v, hu, hv);
  c = clampWallPosition(id, c.u, c.v, hu, hv, ground);
  return c;
}

export function wallItemWorldXZ(item: any) {
  return wallPointXZ(item.wallId, item.u, WALL_OUTWARD);
}

function wallPointXZ(id: string, u: number, outward: number) {
  const g = getWallGeom(id);
  if (!g) return { x: 0, z: 0 };
  return {
    x: g.cx + g.dx * u - g.nx * outward,
    z: g.cz + g.dz * u - g.nz * outward,
  };
}

export function raycastWallPlacement(cx: number, cy: number) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const { room } = useRoomTwin.getState();
  const { WALLS, polyWalls } = require("./roomShell");
  const targets: THREE.Mesh[] = [];
  if (room.shape === "rect") {
    Object.values(WALLS).forEach((w: any) => {
      if (w.mesh.visible && w.mat.opacity > 0.3) targets.push(w.mesh);
    });
  } else {
    polyWalls.forEach((w: any) => {
      if (w.mat.opacity > 0.3) targets.push(w.mesh);
    });
  }

  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length === 0) return null;
  const hit = hits[0];
  const { meshWallId } = require("./scene");
  const id = meshWallId.get(hit.object);
  const g = getWallGeom(id);
  if (!g) return null;
  const u = (hit.point.x - g.cx) * g.dx + (hit.point.z - g.cz) * g.dz;
  return { wallId: id, u, v: hit.point.y };
}

export function raycastWallPlaneUV(id: string, cx: number, cy: number) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const g = getWallGeom(id);
  if (!g) return null;
  const plane = new THREE.Plane();
  plane.setFromNormalAndCoplanarPoint(
    new THREE.Vector3(g.nx, 0, g.nz),
    new THREE.Vector3(g.cx, 0, g.cz),
  );
  const t = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, t)) return null;
  const u = (t.x - g.cx) * g.dx + (t.z - g.cz) * g.dz;
  return { u, v: t.y };
}