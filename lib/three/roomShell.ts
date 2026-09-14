// lib/three/roomShell.ts
import * as THREE from "three";
import {
  roomGroup,
  floorGroup,
  ceilingGroup,
  ceilingColliderGroup,
  baseboardGroup,
  camera,
  controls,
  sun,
  meshWallId,
} from "./scene";
import { makeFloorTexture } from "./surfaceTextures";
import { WALL_COLORS, WALL_LABEL_FULL, CELL_SIZE } from "@/lib/data/constants";
import { useRoomTwin } from "@/lib/state/store";

// ===== Materials =====
export let floorMat: THREE.MeshStandardMaterial;
export const wallMat = new THREE.MeshStandardMaterial({
  color: WALL_COLORS[0],
  roughness: 0.95,
  side: THREE.FrontSide,
  transparent: true,
});
export const sideWallMat = wallMat.clone();
export const rightWallMat = wallMat.clone();
export const frontWallMat = wallMat.clone();
export const ceilingMat = new THREE.MeshStandardMaterial({
  color: 0xf7f3ea,
  roughness: 0.95,
  side: THREE.FrontSide,
  transparent: true,
});
export const ceilingColliderMat = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide,
});

// ===== Meshes (rect mode) =====
export let floorMesh: THREE.Mesh;
export let ceilingMesh: THREE.Mesh;
export let ceilingCollider: THREE.Mesh;
export let backWall: THREE.Mesh;
export let sideWall: THREE.Mesh;
export let rightWall: THREE.Mesh;
export let frontWall: THREE.Mesh;

export interface WallEntry {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  outward: THREE.Vector3;
}
export const WALLS: Record<string, WallEntry> = {};

export interface PolyWall {
  id: string;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  outward: THREE.Vector3;
  cx: number;
  cz: number;
  dx: number;
  dz: number;
  nx: number;
  nz: number;
  len: number;
  rotY: number;
}
export let polyWalls: PolyWall[] = [];

// ============================================================
// ⭐ Merged Wall — รวมผนังบล็อกที่ต่อเนื่องกัน
// ============================================================

export interface MergedWall {
  id: string;
  cx: number;
  cz: number;
  dx: number;
  dz: number;
  nx: number;
  nz: number;
  len: number;
  rotY: number;
  memberIds: string[];
}

export const mergedWallRegistry = new Map<string, MergedWall>();

function parseBlockWallId(id: string): { i: number; j: number; side: string } | null {
  const m = id.match(/^bw_(-?\d+)_(-?\d+)_([NSEW])$/);
  if (!m) return null;
  return { i: parseInt(m[1]), j: parseInt(m[2]), side: m[3] };
}

export function computeMergedWalls() {
  mergedWallRegistry.clear();

  if (polyWalls.length === 0) return;

  const groups = new Map<
    string,
    Array<{ i: number; j: number; side: string; wall: PolyWall }>
  >();

  polyWalls.forEach((w) => {
    const parsed = parseBlockWallId(w.id);
    if (!parsed) return;
    const { i, j, side } = parsed;
    const key = side === "N" || side === "S" ? `${side}|${j}` : `${side}|${i}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ i, j, side, wall: w });
  });

  groups.forEach((cells) => {
    cells.sort((a, b) => {
      const aAxis = a.side === "N" || a.side === "S" ? a.i : a.j;
      const bAxis = b.side === "N" || b.side === "S" ? b.i : b.j;
      return aAxis - bAxis;
    });

    let run: typeof cells = [cells[0]];
    for (let k = 1; k < cells.length; k++) {
      const prev = run[run.length - 1];
      const cur = cells[k];
      const prevAxis =
        prev.side === "N" || prev.side === "S" ? prev.i : prev.j;
      const curAxis =
        cur.side === "N" || cur.side === "S" ? cur.i : cur.j;
      if (curAxis - prevAxis === 1) {
        run.push(cur);
      } else {
        registerMergedWall(run);
        run = [cur];
      }
    }
    if (run.length > 0) registerMergedWall(run);
  });

  console.log(
    "[mergedWalls] registered",
    mergedWallRegistry.size,
    "merged walls from",
    polyWalls.length,
    "cells",
  );
}

function registerMergedWall(
  cells: Array<{ i: number; j: number; side: string; wall: PolyWall }>,
) {
  const first = cells[0];
  const last = cells[cells.length - 1];
  const cs = CELL_SIZE;
  const side = first.side;

  let cx: number, cz: number;
  let dx: number, dz: number;
  let nx: number, nz: number;
  let rotY: number;

  if (side === "N") {
    cx = ((first.i + last.i) / 2) * cs;
    cz = (first.j - 0.5) * cs;
    dx = 1; dz = 0; nx = 0; nz = -1; rotY = 0;
  } else if (side === "S") {
    cx = ((first.i + last.i) / 2) * cs;
    cz = (first.j + 0.5) * cs;
    dx = 1; dz = 0; nx = 0; nz = 1; rotY = Math.PI;
  } else if (side === "E") {
    cx = (first.i + 0.5) * cs;
    cz = ((first.j + last.j) / 2) * cs;
    dx = 0; dz = 1; nx = 1; nz = 0; rotY = -Math.PI / 2;
  } else {
    cx = (first.i - 0.5) * cs;
    cz = ((first.j + last.j) / 2) * cs;
    dx = 0; dz = 1; nx = -1; nz = 0; rotY = Math.PI / 2;
  }

  const memberIds = cells.map((c) => c.wall.id);
  const id = `merged__${memberIds.join("__")}`;

  mergedWallRegistry.set(id, {
    id,
    cx,
    cz,
    dx,
    dz,
    nx,
    nz,
    len: cells.length * cs,
    rotY,
    memberIds,
  });
}

export function getMergedWalls(): MergedWall[] {
  return Array.from(mergedWallRegistry.values());
}

// ============================================================
// Init / Get wall
// ============================================================

export function initRoomShell() {
  const { room, surface } = useRoomTwin.getState();

  floorMat = new THREE.MeshStandardMaterial({
    map: makeFloorTexture(surface.floor, room.w, room.d, 1),
    roughness: 0.85,
  });

  floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.name = "FLOOR";
  floorMesh.userData.isFloor = true;
  floorGroup.add(floorMesh);

  ceilingMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(room.w, room.d),
    ceilingMat,
  );
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.set(0, room.h, 0);
  ceilingMesh.userData.isCeiling = true;
  ceilingGroup.add(ceilingMesh);

  ceilingCollider = new THREE.Mesh(
    new THREE.PlaneGeometry(room.w, room.d),
    ceilingColliderMat,
  );
  ceilingCollider.rotation.x = Math.PI / 2;
  ceilingCollider.position.set(0, room.h - 0.002, 0);
  ceilingColliderGroup.add(ceilingCollider);

  backWall = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.h), wallMat);
  backWall.position.set(0, room.h / 2, -room.d / 2);
  backWall.receiveShadow = true;
  roomGroup.add(backWall);

  sideWall = new THREE.Mesh(new THREE.PlaneGeometry(room.d, room.h), sideWallMat);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(-room.w / 2, room.h / 2, 0);
  sideWall.receiveShadow = true;
  roomGroup.add(sideWall);

  rightWall = new THREE.Mesh(new THREE.PlaneGeometry(room.d, room.h), rightWallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(room.w / 2, room.h / 2, 0);
  rightWall.receiveShadow = true;
  roomGroup.add(rightWall);

  frontWall = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.h), frontWallMat);
  frontWall.rotation.y = Math.PI;
  frontWall.position.set(0, room.h / 2, room.d / 2);
  frontWall.receiveShadow = true;
  roomGroup.add(frontWall);

  WALLS.back = { mesh: backWall, mat: wallMat, outward: new THREE.Vector3(0, 0, -1) };
  WALLS.side = { mesh: sideWall, mat: sideWallMat, outward: new THREE.Vector3(-1, 0, 0) };
  WALLS.right = { mesh: rightWall, mat: rightWallMat, outward: new THREE.Vector3(1, 0, 0) };
  WALLS.front = { mesh: frontWall, mat: frontWallMat, outward: new THREE.Vector3(0, 0, 1) };

  Object.entries(WALLS).forEach(([id, w]) => meshWallId.set(w.mesh, id));

  applySurface();
}

// ============================================================
// ⭐ getWall — handle merged wall ids
// ============================================================

export function getWall(id: string): WallEntry | null {
  if (WALLS[id]) return WALLS[id];

  const polyW = polyWalls.find((w) => w.id === id);
  if (polyW) return polyW as any;

  // ⭐ fallback ไป member แรกของ merged wall
  const merged = mergedWallRegistry.get(id);
  if (merged && merged.memberIds.length > 0) {
    return (
      (polyWalls.find((w) => w.id === merged.memberIds[0]) as any) || null
    );
  }
  return null;
}

// ============================================================
// ⭐ getWallGeom — handle merged wall ids
// ============================================================

export function getWallGeom(id: string) {
  const { room } = useRoomTwin.getState();

  // 1. Merged wall ตรงๆ
  const merged = mergedWallRegistry.get(id);
  if (merged) {
    return {
      cx: merged.cx,
      cz: merged.cz,
      dx: merged.dx,
      dz: merged.dz,
      nx: merged.nx,
      nz: merged.nz,
      len: merged.len,
      rotY: merged.rotY,
    };
  }

  // 2. Rect walls
  if (id === "back")
    return { cx: 0, cz: -room.d / 2, dx: 1, dz: 0, nx: 0, nz: -1, len: room.w, rotY: 0 };
  if (id === "front")
    return { cx: 0, cz: room.d / 2, dx: 1, dz: 0, nx: 0, nz: 1, len: room.w, rotY: Math.PI };
  if (id === "side")
    return { cx: -room.w / 2, cz: 0, dx: 0, dz: 1, nx: -1, nz: 0, len: room.d, rotY: Math.PI / 2 };
  if (id === "right")
    return { cx: room.w / 2, cz: 0, dx: 0, dz: 1, nx: 1, nz: 0, len: room.d, rotY: -Math.PI / 2 };

  // 3. ⭐ Cell wall → หา merged ที่บรรจุ → คืน merged geom (ให้ u ต่อเนื่อง)
  const polyW = polyWalls.find((w) => w.id === id);
  if (polyW) {
    // ถ้าเป็น blocks mode → try merged
    if (room.shape === "blocks") {
      for (const mw of mergedWallRegistry.values()) {
        if (mw.memberIds.includes(id)) {
          return {
            cx: mw.cx,
            cz: mw.cz,
            dx: mw.dx,
            dz: mw.dz,
            nx: mw.nx,
            nz: mw.nz,
            len: mw.len,
            rotY: mw.rotY,
          };
        }
      }
    }
    // fallback: cell wall เอง
    return {
      cx: polyW.cx,
      cz: polyW.cz,
      dx: polyW.dx,
      dz: polyW.dz,
      nx: polyW.nx,
      nz: polyW.nz,
      len: polyW.len,
      rotY: polyW.rotY,
    };
  }

  return null;
}

export function getWallRotY(id: string): number {
  const g = getWallGeom(id);
  return g ? g.rotY : 0;
}

export function wallSpan(id: string): number {
  const g = getWallGeom(id);
  const { room } = useRoomTwin.getState();
  return g ? g.len : room.w;
}

export function wallPointXZ(id: string, u: number, outward: number) {
  const g = getWallGeom(id);
  if (!g) return { x: 0, z: 0 };
  return {
    x: g.cx + g.dx * u - g.nx * outward,
    z: g.cz + g.dz * u - g.nz * outward,
  };
}

export function getPolyWalls(): PolyWall[] {
  return polyWalls;
}

// ============================================================
// Surface
// ============================================================

export function applySurface() {
  const { room, surface } = useRoomTwin.getState();
  if (!floorMat) return;

  if (floorMat.map && floorMat.map.dispose) floorMat.map.dispose();
  floorMat.map = makeFloorTexture(surface.floor, room.w, room.d, 1);
  floorMat.map.repeat.set(room.w / 1.4, room.d / 1.4);
  floorMat.needsUpdate = true;

  const cw = (id: string) =>
    surface.walls[id] !== undefined ? surface.walls[id] : surface.wallAll;
  if (surface.wallUniform || room.shape !== "rect") {
    wallMat.color.setHex(surface.wallAll);
    sideWallMat.color.setHex(surface.wallAll);
    rightWallMat.color.setHex(surface.wallAll);
    frontWallMat.color.setHex(surface.wallAll);
    polyWalls.forEach((w) => w.mat.color.setHex(surface.wallAll));
  } else {
    wallMat.color.setHex(cw("back"));
    sideWallMat.color.setHex(cw("side"));
    rightWallMat.color.setHex(cw("right"));
    frontWallMat.color.setHex(cw("front"));
  }
  ceilingMat.color.setHex(surface.ceiling);
}

// ============================================================
// Wall visibility
// ============================================================

const _camDir = new THREE.Vector3();
function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export let lastWallStatusText = "";

export function updateWallVisibility() {
  const { room, placedItems } = useRoomTwin.getState();
  if (!controls || !camera) return;

  _camDir.subVectors(camera.position, controls.target).normalize();
  const topFactor = smoothstep(0.6, 0.88, Math.abs(_camDir.y));
  const labels: string[] = [];

  Object.entries(WALLS).forEach(([id, w]) => {
    if (!w.mesh.visible) return;
    const facing = _camDir.dot(w.outward);
    let op = 1 - smoothstep(-0.15, 0.15, facing);
    op *= 1 - topFactor;
    w.mat.opacity = op;
    w.mat.depthWrite = op > 0.5;
    if (op > 0.55) labels.push(WALL_LABEL_FULL[id].replace("ผนัง", ""));
  });

  polyWalls.forEach((w) => {
    const facing = _camDir.dot(w.outward);
    let op = 1 - smoothstep(-0.15, 0.15, facing);
    op *= 1 - topFactor;
    w.mat.opacity = op;
    w.mat.depthWrite = op > 0.5;
    if (op > 0.55) labels.push("ผนัง");
  });

  const camAbove = smoothstep(room.h, room.h + 0.6, camera.position.y);
  const co = (1 - topFactor) * (1 - camAbove);
  ceilingMat.opacity = co;
  ceilingMat.depthWrite = co > 0.5;

  placedItems.forEach((item) => {
    if (!item.wallMount) return;
    const wd = getWall(item.wallId!);
    const wo = wd ? (wd as any).mat.opacity : 1;
    import("./scene").then(({ objectsByUid, wallItemMaterials }) => {
      const h = objectsByUid.get(item.uid);
      if (h) h.visible = wo > 0.04;
      const mats = wallItemMaterials.get(item.uid);
      if (mats)
        mats.forEach((m) => {
          m.opacity = wo;
          m.depthWrite = wo > 0.5;
        });
    });
  });

  const text =
    topFactor > 0.6
      ? "มุมมองด้านบน (ผังพื้น)"
      : "มองเห็นผนัง: " +
        (labels.length ? [...new Set(labels)].join(" + ") : "มุมสูง");
  lastWallStatusText = text;
}

export function getWallStatusText() {
  return lastWallStatusText;
}

// ============================================================
// Baseboards
// ============================================================

// lib/three/roomShell.ts
// ⭐ ต้องมี getMergedWalls ในไฟล์เดียวกัน (มีอยู่แล้ว)
export function rebuildBaseboards() {
  // Clear
  while (baseboardGroup.children.length) {
    const child = baseboardGroup.children[0];
    baseboardGroup.remove(child);
    if ((child as any).geometry) (child as any).geometry.dispose();
    if ((child as any).material) (child as any).material.dispose();
  }

  const { room, placedItems } = useRoomTwin.getState();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf7f3ea,
    roughness: 0.6,
  });

  // Wall set
  const wallGeoms: Array<{
    id: string;
    cx: number;
    cz: number;
    dx: number;
    dz: number;
    nx: number;
    nz: number;
    len: number;
    rotY: number;
    memberIds?: string[];
  }> = [];

  if (room.shape === "rect") {
    (["back", "front", "side", "right"] as const).forEach((id) => {
      const g = getWallGeom(id);
      if (g) wallGeoms.push({ id, ...g });
    });
  } else {
    getMergedWalls().forEach((mw) => {
      wallGeoms.push({
        id: mw.id,
        cx: mw.cx,
        cz: mw.cz,
        dx: mw.dx,
        dz: mw.dz,
        nx: mw.nx,
        nz: mw.nz,
        len: mw.len,
        rotY: mw.rotY,
        memberIds: mw.memberIds,
      });
    });
  }

  wallGeoms.forEach((g) => {
    // ⭐⭐⭐ หาประตู: 2-way matching + แปลง u ให้อยู่ใน merged frame
    const doors: Array<{ door: any; u: number }> = [];

    placedItems.forEach((it) => {
      if (!it.wallMount || it.productId !== "door" || !it.wallId) return;

      // Case 1: merged id ตรง
      if (it.wallId === g.id) {
        doors.push({ door: it, u: it.u || 0 });
        return;
      }

      // Case 2: cell id อยู่ใน merged memberIds
      if (g.memberIds && g.memberIds.includes(it.wallId)) {
        const cg = getWallGeom(it.wallId); // ← จะคืน merged geom (เพราะแก้แล้ว)
        // ⚠️ cg ที่ได้เป็น merged geom เดียวกัน → delta = 0 → ใช้ u ตรงๆ
        doors.push({ door: it, u: it.u || 0 });
        return;
      }
    });

    doors.sort((a, b) => a.u - b.u);

    // Segments
    const segs: [number, number][] = [];
    let cur = -g.len / 2;

    doors.forEach(({ door, u }) => {
      const doorW = (door.params.w || 95) / 100;
      const halfW = doorW / 2;
      const l = u - halfW;
      const r = u + halfW;
      if (l - cur > 0.005) segs.push([cur, l]);
      cur = r;
    });

    if (g.len / 2 - cur > 0.005) segs.push([cur, g.len / 2]);

    segs.forEach(([u0, u1]) => {
      const len = u1 - u0;
      if (len < 0.005) return;

      const midU = (u0 + u1) / 2;
      const x = g.cx + g.dx * midU - g.nx * 0.01;
      const z = g.cz + g.dz * midU - g.nz * 0.01;

      const m = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.08, 0.02),
        mat,
      );
      m.position.set(x, 0.04, z);
      m.rotation.y = g.rotY;
      baseboardGroup.add(m);
    });
  });
}


// ============================================================
// ⭐ rebuildRoomShell
// ============================================================

export function rebuildRoomShell() {
  const { room } = useRoomTwin.getState();

  if (room.shape === "blocks" && room.blocks && room.blocks.size > 0) {
    buildBlocksShell();
    const half = 6;
    if (sun) {
      sun.shadow.camera.left = -half;
      sun.shadow.camera.right = half;
      sun.shadow.camera.top = half;
      sun.shadow.camera.bottom = -half;
      sun.shadow.camera.updateProjectionMatrix();
    }
    rebuildBaseboards();
    return;
  }

  // Clear poly walls
  polyWalls.forEach((w) => {
    roomGroup.remove(w.mesh);
    if (w.mesh.geometry) w.mesh.geometry.dispose();
    if (w.mat) w.mat.dispose();
    meshWallId.delete(w.mesh);
  });
  polyWalls = [];
  mergedWallRegistry.clear();

  backWall.visible = true;
  sideWall.visible = true;
  rightWall.visible = true;
  frontWall.visible = true;
  ceilingMesh.visible = true;
  ceilingCollider.visible = true;

  clearGroup(floorGroup);
  clearGroup(ceilingGroup);
  clearGroup(ceilingColliderGroup);

  floorMesh.geometry.dispose();
  floorMesh.geometry = new THREE.PlaneGeometry(room.w, room.d);
  floorMesh.rotation.set(-Math.PI / 2, 0, 0);
  floorMesh.position.set(0, 0, 0);
  floorGroup.add(floorMesh);
  if (floorMat.map) floorMat.map.repeat.set(room.w / 1.4, room.d / 1.4);

  ceilingMesh.geometry.dispose();
  ceilingMesh.geometry = new THREE.PlaneGeometry(room.w, room.d);
  ceilingMesh.rotation.set(Math.PI / 2, 0, 0);
  ceilingMesh.position.set(0, room.h, 0);
  ceilingGroup.add(ceilingMesh);

  ceilingCollider.geometry.dispose();
  ceilingCollider.geometry = new THREE.PlaneGeometry(room.w, room.d);
  ceilingCollider.rotation.set(Math.PI / 2, 0, 0);
  ceilingCollider.position.set(0, room.h - 0.002, 0);
  ceilingColliderGroup.add(ceilingCollider);

  backWall.geometry.dispose();
  backWall.geometry = new THREE.PlaneGeometry(room.w, room.h);
  backWall.position.set(0, room.h / 2, -room.d / 2);

  sideWall.geometry.dispose();
  sideWall.geometry = new THREE.PlaneGeometry(room.d, room.h);
  sideWall.position.set(-room.w / 2, room.h / 2, 0);

  rightWall.geometry.dispose();
  rightWall.geometry = new THREE.PlaneGeometry(room.d, room.h);
  rightWall.position.set(room.w / 2, room.h / 2, 0);

  frontWall.geometry.dispose();
  frontWall.geometry = new THREE.PlaneGeometry(room.w, room.h);
  frontWall.position.set(0, room.h / 2, room.d / 2);

  const half = Math.max(room.w, room.d) / 2 + 1.4;
  if (sun) {
    sun.shadow.camera.left = -half;
    sun.shadow.camera.right = half;
    sun.shadow.camera.top = half;
    sun.shadow.camera.bottom = -half;
    sun.shadow.camera.updateProjectionMatrix();
  }
  applySurface();
  rebuildBaseboards();
}

export function clearGroup(g: THREE.Group) {
  while (g.children.length) {
    const c = g.children[0];
    g.remove(c);
    if ((c as any).geometry) (c as any).geometry.dispose();
  }
}

// ============================================================
// ⭐ buildBlocksShell — เพิ่ม computeMergedWalls()
// ============================================================

export function buildBlocksShell() {
  const { room } = useRoomTwin.getState();
  if (!room.blocks) return;

  polyWalls.forEach((w) => {
    roomGroup.remove(w.mesh);
    if (w.mesh.geometry) w.mesh.geometry.dispose();
    if (w.mat) w.mat.dispose();
    meshWallId.delete(w.mesh);
  });
  polyWalls = [];
  mergedWallRegistry.clear();

  backWall.visible = false;
  sideWall.visible = false;
  rightWall.visible = false;
  frontWall.visible = false;
  ceilingMesh.visible = true;
  ceilingCollider.visible = true;

  clearGroup(floorGroup);
  clearGroup(ceilingGroup);
  clearGroup(ceilingColliderGroup);

  const cs = room.cellSize;
  const cellGeo = new THREE.PlaneGeometry(cs, cs);

  room.blocks.forEach((k) => {
    const [i, j] = k.split(",").map(Number);
    const c = { x: i * cs, z: j * cs };

    const fm = new THREE.Mesh(cellGeo, floorMat);
    fm.rotation.x = -Math.PI / 2;
    fm.position.set(c.x, 0, c.z);
    fm.receiveShadow = true;
    fm.userData.isFloor = true;
    fm.name = "FLOOR";
    floorGroup.add(fm);

    const cm = new THREE.Mesh(cellGeo, ceilingMat);
    cm.rotation.x = Math.PI / 2;
    cm.position.set(c.x, room.h, c.z);
    cm.userData.isCeiling = true;
    ceilingGroup.add(cm);

    const cc = new THREE.Mesh(cellGeo, ceilingColliderMat);
    cc.rotation.x = Math.PI / 2;
    cc.position.set(c.x, room.h - 0.002, c.z);
    ceilingColliderGroup.add(cc);
  });

  const neighbors = [
    { side: "N", di: 0, dj: -1 },
    { side: "S", di: 0, dj: 1 },
    { side: "E", di: 1, dj: 0 },
    { side: "W", di: -1, dj: 0 },
  ];

  room.blocks.forEach((k) => {
    const [i, j] = k.split(",").map(Number);
    neighbors.forEach(({ side, di, dj }) => {
      const nk = `${i + di},${j + dj}`;
      if (room.blocks!.has(nk)) return;
      addBlockWall(i, j, side);
    });
  });

  // ⭐ คำนวณ merged walls หลังสร้างเสร็จ
  computeMergedWalls();
}

export function addBlockWall(i: number, j: number, side: string) {
  const { room, surface } = useRoomTwin.getState();
  const cs = room.cellSize;
  const mat = new THREE.MeshStandardMaterial({
    color: surface.wallAll,
    roughness: 0.95,
    side: THREE.FrontSide,
    transparent: true,
  });
  const geo = new THREE.PlaneGeometry(cs, room.h);
  const m = new THREE.Mesh(geo, mat);

  let cx: number, cz: number, rotY: number, nx: number, nz: number, dx: number, dz: number;
  const c = { x: i * cs, z: j * cs };

  if (side === "N") {
    cx = c.x; cz = c.z - cs / 2; rotY = 0;
    nx = 0; nz = -1; dx = 1; dz = 0;
  } else if (side === "S") {
    cx = c.x; cz = c.z + cs / 2; rotY = Math.PI;
    nx = 0; nz = 1; dx = 1; dz = 0;
  } else if (side === "E") {
    cx = c.x + cs / 2; cz = c.z; rotY = -Math.PI / 2;
    nx = 1; nz = 0; dx = 0; dz = 1;
  } else {
    cx = c.x - cs / 2; cz = c.z; rotY = Math.PI / 2;
    nx = -1; nz = 0; dx = 0; dz = 1;
  }

  m.position.set(cx, room.h / 2, cz);
  m.rotation.y = rotY;
  m.receiveShadow = true;
  roomGroup.add(m);

  const wid = `bw_${i}_${j}_${side}`;
  meshWallId.set(m, wid);
  polyWalls.push({
    id: wid, mesh: m, mat,
    outward: new THREE.Vector3(nx, 0, nz),
    cx, cz, dx, dz, nx, nz,
    len: cs, rotY,
  });
}