// lib/three/roomShell.ts
import * as THREE from "three";
import {
  roomGroup, floorGroup, ceilingGroup, ceilingColliderGroup,
  baseboardGroup, camera, controls, sun, meshWallId,
} from "./scene";
import { makeFloorTexture } from "./surfaceTextures";
import { WALL_COLORS, WALL_LABEL_FULL } from "@/lib/data/constants";
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

export function getWall(id: string): WallEntry | null {
  if (WALLS[id]) return WALLS[id];
  return polyWalls.find((w) => w.id === id) || null;
}

export function getWallGeom(id: string) {
  const { room } = useRoomTwin.getState();
  if (id === "back")
    return { cx: 0, cz: -room.d / 2, dx: 1, dz: 0, nx: 0, nz: -1, len: room.w, rotY: 0 };
  if (id === "front")
    return { cx: 0, cz: room.d / 2, dx: 1, dz: 0, nx: 0, nz: 1, len: room.w, rotY: Math.PI };
  if (id === "side")
    return { cx: -room.w / 2, cz: 0, dx: 0, dz: 1, nx: -1, nz: 0, len: room.d, rotY: Math.PI / 2 };
  if (id === "right")
    return { cx: room.w / 2, cz: 0, dx: 0, dz: 1, nx: 1, nz: 0, len: room.d, rotY: -Math.PI / 2 };
  const w = polyWalls.find((w) => w.id === id);
  if (!w) return null;
  return { cx: w.cx, cz: w.cz, dx: w.dx, dz: w.dz, nx: w.nx, nz: w.nz, len: w.len, rotY: w.rotY };
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

// ===== Wall visibility (fade based on camera) =====
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
    const wo = wd ? wd.mat.opacity : 1;
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

// ===== Baseboards =====
export function rebuildBaseboards() {
  while (baseboardGroup.children.length) {
    const child = baseboardGroup.children[0];
    baseboardGroup.remove(child);
    if ((child as any).geometry) (child as any).geometry.dispose();
    if ((child as any).material) (child as any).material.dispose();
  }
  const { room, placedItems } = useRoomTwin.getState();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: 0.6 });
  const wallIds: string[] = [];
  if (room.shape === "rect") wallIds.push("back", "front", "side", "right");
  else polyWalls.forEach((w) => wallIds.push(w.id));

  wallIds.forEach((wid) => {
    const g = getWallGeom(wid);
    if (!g) return;
    const doors = placedItems.filter(
      (it) => it.wallMount && it.wallId === wid && it.productId === "door",
    );
    doors.sort((a, b) => (a.u || 0) - (b.u || 0));
    const segs: [number, number][] = [];
    let cur = -g.len / 2;
    doors.forEach((d) => {
      const hw = (d.params.w || 95) / 100 / 2;
      const l = (d.u || 0) - hw;
      const r = (d.u || 0) + hw;
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
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.02), mat);
      m.position.set(x, 0.04, z);
      m.rotation.y = g.rotY;
      baseboardGroup.add(m);
    });
  });
}

// ===== Room shell rebuild (rect mode) =====
export function rebuildRoomShell() {
  const { room, surface } = useRoomTwin.getState();

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

// ===== Blocks shell =====
export function buildBlocksShell() {
  const { room, surface } = useRoomTwin.getState();
  if (!room.blocks) return;

  polyWalls.forEach((w) => {
    roomGroup.remove(w.mesh);
    if (w.mesh.geometry) w.mesh.geometry.dispose();
    if (w.mat) w.mat.dispose();
    meshWallId.delete(w.mesh);
  });
  polyWalls = [];

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

export function getPolyWalls(): PolyWall[] {
  return polyWalls;
}