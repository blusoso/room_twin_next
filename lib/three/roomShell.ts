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
  objectsByUid,
  wallItemMaterials,
} from "./scene";
import { makeFloorTexture, makeFloorCanvas } from "./surfaceTextures";
import {
  WALL_COLORS,
  WALL_LABEL_FULL,
  CELL_SIZE,
} from "@/lib/data/constants";
import { PRODUCT_BY_ID } from "@/lib/data/products";
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

// ===== Meshes (rect) =====
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
// Merged Walls
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

function parseBlockWallId(id: string): {
  i: number;
  j: number;
  side: string;
} | null {
  const m = id.match(/^bw_(-?\d+)_(-?\d+)_([NSEW])$/);
  if (!m) return null;
  return { i: parseInt(m[1]), j: parseInt(m[2]), side: m[3] };
}

function wallSideIdOf(
  id: string,
): "N" | "S" | "E" | "W" | null {
  if (id === "back") return "N";
  if (id === "front") return "S";
  if (id === "right") return "E";
  if (id === "side") return "W";

  const parsed = parseBlockWallId(id);

  if (parsed) {
    return parsed.side as "N" | "S" | "E" | "W";
  }

  if (id.startsWith("merged__")) {
    const memberIds = id
      .slice("merged__".length)
      .split("__");

    for (const memberId of memberIds) {
      const parsedMember = parseBlockWallId(memberId);

      if (parsedMember) {
        return parsedMember.side as "N" | "S" | "E" | "W";
      }
    }
  }

  return null;
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
    const key =
      side === "N" || side === "S" ? `${side}|${j}` : `${side}|${i}`;
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
    cx = ((first.i + last.i) / 2 - _blocksOriginI) * cs;
    cz = (first.j - 0.5 - _blocksOriginJ) * cs;
    dx = 1; dz = 0; nx = 0; nz = -1; rotY = 0;
  } else if (side === "S") {
    cx = ((first.i + last.i) / 2 - _blocksOriginI) * cs;
    cz = (first.j + 0.5 - _blocksOriginJ) * cs;
    dx = 1; dz = 0; nx = 0; nz = 1; rotY = Math.PI;
  } else if (side === "E") {
    cx = (first.i + 0.5 - _blocksOriginI) * cs;
    cz = ((first.j + last.j) / 2 - _blocksOriginJ) * cs;
    dx = 0; dz = 1; nx = 1; nz = 0; rotY = -Math.PI / 2;
  } else {
    cx = (first.i - 0.5 - _blocksOriginI) * cs;
    cz = ((first.j + last.j) / 2 - _blocksOriginJ) * cs;
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
// Init
// ============================================================

export function initRoomShell() {
  const { room, surface } = useRoomTwin.getState();

  floorMat = new THREE.MeshStandardMaterial({
    map: makeFloorTexture(surface.floor, room.w, room.d, 1),
    roughness: 0.85,
  });

  floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(room.w, room.d),
    floorMat,
  );
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

  sideWall = new THREE.Mesh(
    new THREE.PlaneGeometry(room.d, room.h),
    sideWallMat,
  );
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(-room.w / 2, room.h / 2, 0);
  sideWall.receiveShadow = true;
  roomGroup.add(sideWall);

  rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(room.d, room.h),
    rightWallMat,
  );
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(room.w / 2, room.h / 2, 0);
  rightWall.receiveShadow = true;
  roomGroup.add(rightWall);

  frontWall = new THREE.Mesh(
    new THREE.PlaneGeometry(room.w, room.h),
    frontWallMat,
  );
  frontWall.rotation.y = Math.PI;
  frontWall.position.set(0, room.h / 2, room.d / 2);
  frontWall.receiveShadow = true;
  roomGroup.add(frontWall);

  WALLS.back = {
    mesh: backWall,
    mat: wallMat,
    outward: new THREE.Vector3(0, 0, -1),
  };
  WALLS.side = {
    mesh: sideWall,
    mat: sideWallMat,
    outward: new THREE.Vector3(-1, 0, 0),
  };
  WALLS.right = {
    mesh: rightWall,
    mat: rightWallMat,
    outward: new THREE.Vector3(1, 0, 0),
  };
  WALLS.front = {
    mesh: frontWall,
    mat: frontWallMat,
    outward: new THREE.Vector3(0, 0, 1),
  };

  Object.entries(WALLS).forEach(([id, w]) => meshWallId.set(w.mesh, id));

  applySurface();
}

// ============================================================
// getWall / getWallGeom / helpers
// ============================================================

export function getWall(id: string): WallEntry | null {
  if (WALLS[id]) return WALLS[id];
  const polyW = polyWalls.find((w) => w.id === id);
  if (polyW) return polyW as any;
  const merged = mergedWallRegistry.get(id);
  if (merged && merged.memberIds.length > 0) {
    return (
      (polyWalls.find((w) => w.id === merged.memberIds[0]) as any) || null
    );
  }
  return null;
}

export function getWallGeom(id: string) {
  const { room } = useRoomTwin.getState();

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

  if (id === "back")
    return {
      cx: 0, cz: -room.d / 2, dx: 1, dz: 0, nx: 0, nz: -1,
      len: room.w, rotY: 0,
    };
  if (id === "front")
    return {
      cx: 0, cz: room.d / 2, dx: 1, dz: 0, nx: 0, nz: 1,
      len: room.w, rotY: Math.PI,
    };
  if (id === "side")
    return {
      cx: -room.w / 2, cz: 0, dx: 0, dz: 1, nx: -1, nz: 0,
      len: room.d, rotY: Math.PI / 2,
    };
  if (id === "right")
    return {
      cx: room.w / 2, cz: 0, dx: 0, dz: 1, nx: 1, nz: 0,
      len: room.d, rotY: -Math.PI / 2,
    };

  const polyW = polyWalls.find((w) => w.id === id);
  if (polyW) {
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
  const { room, surface } =
    useRoomTwin.getState();

  if (!floorMat) return;

  // ============================================================
  // Floor
  // ============================================================
    // ============================================================
  // Floor
  // ============================================================
  if (
    floorMat.map &&
    floorMat.map.dispose
  ) {
    floorMat.map.dispose();
  }

  floorMat.map =
    makeFloorTexture(
      surface.floor,
      room.w,
      room.d,
      1,
    );

  floorMat.map.repeat.set(
    room.w / 1.4,
    room.d / 1.4,
  );

  // ⭐ Tint — คูณกับ map (0xffffff = ไม่แต้ม)
  floorMat.color.setHex(
    (surface.floorTint ?? 0xffffff) as number,
  );

  floorMat.needsUpdate = true;

  // ============================================================
  // Blocks floor
  // ============================================================
  if (blockFloorMat) {
    const old =
      blockFloorMat.map;

    blockFloorMat.map =
      makeBlockFloorTexture();

    // ⭐ Tint ให้ block floor ด้วย
    blockFloorMat.color.setHex(
      (surface.floorTint ?? 0xffffff) as number,
    );

    blockFloorMat.needsUpdate =
      true;

    if (old) {
      old.dispose();
    }
  }

  // ============================================================
  // Semantic wall facades: back / front / side / right
  // ============================================================
  const wallColorOf =
    (facade: WallFacadeId): number => {
      return surface.walls[
        facade
      ] !== undefined
        ? surface.walls[facade]
        : surface.wallAll;
    };

  const setMaterialColor =
    (
      mat: THREE.MeshStandardMaterial,
      color: number,
    ) => {
      mat.color.setHex(color);
      mat.needsUpdate = true;
    };

  // ============================================================
  // Uniform
  // ============================================================
  if (surface.wallUniform) {
    setMaterialColor(
      wallMat,
      surface.wallAll,
    );

    setMaterialColor(
      sideWallMat,
      surface.wallAll,
    );

    setMaterialColor(
      rightWallMat,
      surface.wallAll,
    );

    setMaterialColor(
      frontWallMat,
      surface.wallAll,
    );

    polyWalls.forEach((wall) => {
      setMaterialColor(
        wall.mat,
        surface.wallAll,
      );
    });
  }

  // ============================================================
  // Per facade
  // ============================================================
  else {
    setMaterialColor(
      wallMat,
      wallColorOf("back"),
    );

    setMaterialColor(
      frontWallMat,
      wallColorOf("front"),
    );

    setMaterialColor(
      sideWallMat,
      wallColorOf("side"),
    );

    setMaterialColor(
      rightWallMat,
      wallColorOf("right"),
    );

    polyWalls.forEach((wall) => {
      const facade =
        wallFacadeOf(
          wall.id,
        );

      if (!facade) {
        setMaterialColor(
          wall.mat,
          surface.wallAll,
        );
        return;
      }

      setMaterialColor(
        wall.mat,
        wallColorOf(
          facade,
        ),
      );
    });
  }

  // ============================================================
  // Ceiling
  // ============================================================
  setMaterialColor(
    ceilingMat,
    surface.ceiling,
  );

  // ============================================================
  // ⭐ Baseboards — re-sync สีบัวทุกครั้งที่ surface เปลี่ยน
  // ============================================================
  rebuildBaseboards();

  // ============================================================
  // Partitions sync
  // ============================================================
  const partitions =
    useRoomTwin
      .getState()
      .placedItems
      .filter(
        (item) =>
          item.productId ===
          "partition",
      );

  partitions.forEach((item) => {
    if (
      item.params.color !==
      surface.wallAll
    ) {
      useRoomTwin
        .getState()
        .updateItem(
          item.uid,
          {
            params: {
              ...item.params,
              color:
                surface.wallAll,
            },
          },
        );
    }

    const obj =
      objectsByUid.get(
        item.uid,
      );

    if (!obj) return;

    obj.traverse(
      (child: any) => {
        if (
          !child.isMesh ||
          !child.material
        ) {
          return;
        }

        const mat =
          child.material as
            THREE.MeshStandardMaterial;

        if (
          mat.color &&
          mat.map === undefined
        ) {
          mat.color.setHex(
            surface.wallAll,
          );

          mat.needsUpdate =
            true;
        }
      },
    );
  });
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
  const { room, placedItems, showAllWalls } = useRoomTwin.getState();
  if (!controls || !camera) return;

  _camDir.subVectors(camera.position, controls.target).normalize();
  const topFactor = smoothstep(0.6, 0.88, Math.abs(_camDir.y));
  const labels: string[] = [];

  if (showAllWalls) {
    Object.entries(WALLS).forEach(([, w]) => {
      if (!w.mesh.visible) return;
      w.mat.opacity = 1;
      w.mat.depthWrite = true;
    });

    polyWalls.forEach((w) => {
      w.mat.opacity = 1;
      w.mat.depthWrite = true;
    });
  } else {
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
  }

  const camAbove = smoothstep(room.h, room.h + 0.6, camera.position.y);
  const co = (1 - topFactor) * (1 - camAbove);
  ceilingMat.opacity = co;
  ceilingMat.depthWrite = co > 0.5;

  placedItems.forEach((item) => {
    if (!item.wallMount) return;
    let wo = 1;
    if (item.mountUid) {
      const host = placedItems.find((h) => h.uid === item.mountUid);
      const hostWall = host?.wallMount && host.wallId
        ? getWall(host.wallId)
        : null;
      wo = hostWall ? (hostWall as any).mat.opacity : 1;
    } else {
      const wd = getWall(item.wallId!);
      wo = wd ? (wd as any).mat.opacity : 1;
    }
    const h = objectsByUid.get(item.uid);
    if (h) h.visible = wo > 0.04;
    const mats = wallItemMaterials.get(item.uid);
    if (mats)
      mats.forEach((m) => {
        m.opacity = wo;
        m.depthWrite = wo > 0.5;
      });
  });

  let text: string;

  if (showAllWalls) {
    text = "แสดงผนังทุกด้าน (ปิดการซ่อนผนังอัตโนมัติ)";
  } else if (topFactor > 0.6) {
    text = "มุมมองด้านบน (ผังพื้น)";
  } else {
    text =
      "มองเห็นผนัง: " +
      (labels.length ? [...new Set(labels)].join(" + ") : "มุมสูง");
  }

  lastWallStatusText = text;
}

export function getWallStatusText() {
  return lastWallStatusText;
}

// ============================================================
// findFloorYAt
// ============================================================

const _floorRayOrigin = new THREE.Vector3();
const _floorRayDir = new THREE.Vector3(0, -1, 0);
const _floorRay = new THREE.Raycaster();

export function findFloorYAt(x: number, z: number): number {
  const targets: THREE.Object3D[] = [...floorGroup.children];

  _floorRayOrigin.set(x, 50, z);
  _floorRay.set(_floorRayOrigin, _floorRayDir);
  _floorRay.far = 100;

  const hits = _floorRay.intersectObjects(targets, false);
  if (hits.length === 0) return 0;

  let bestY = 0;
  let found = false;
  hits.forEach((h) => {
    if (!found || h.point.y > bestY) {
      bestY = h.point.y;
      found = true;
    }
  });
  return found ? bestY : 0;
}

export function findFloorYAtFootprint(
  x: number,
  z: number,
  fp: { w: number; d: number },
): number {
  let bestY = findFloorYAt(x, z);
  const hw = fp.w / 2;
  const hd = fp.d / 2;
  const corners: Array<[number, number]> = [
    [x - hw, z - hd],
    [x + hw, z - hd],
    [x - hw, z + hd],
    [x + hw, z + hd],
  ];
  for (const [cx, cz] of corners) {
    const y = findFloorYAt(cx, cz);
    if (y > bestY) bestY = y;
  }
  return bestY;
}

// ============================================================
// ⭐ Baseboards — สีดึงจาก surface.baseboard
// ============================================================

export function rebuildBaseboards() {
  while (baseboardGroup.children.length) {
    const child = baseboardGroup.children[0];
    baseboardGroup.remove(child);
    if ((child as any).geometry) (child as any).geometry.dispose();
    if ((child as any).material) (child as any).material.dispose();
  }

  const { room, placedItems, surface } = useRoomTwin.getState();
  const mat = new THREE.MeshStandardMaterial({
    color: surface.baseboard ?? 0xfbf6ec, // ⭐ อ่านจาก store
    roughness: 0.6,
  });

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
    const doors: Array<{ door: any; u: number }> = [];

    placedItems.forEach((it) => {
      if (!it.wallMount || !it.wallId) return;
      const product = PRODUCT_BY_ID.get(it.productId);
      if (!product?.groundAnchor) return;

      if (it.wallId === g.id) {
        doors.push({ door: it, u: it.u || 0 });
      } else if (g.memberIds && g.memberIds.includes(it.wallId)) {
        doors.push({ door: it, u: it.u || 0 });
      }
    });

    doors.sort((a, b) => a.u - b.u);

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

  notifyShellRebuilt();
}

// ============================================================
// Hook
// ============================================================

let _shellRebuildListener: (() => void) | null = null;

export function setShellRebuildListener(fn: (() => void) | null) {
  _shellRebuildListener = fn;
}

function notifyShellRebuilt() {
  if (!_shellRebuildListener) return;
  try {
    _shellRebuildListener();
  } catch (err) {
    console.warn("[roomShell] shell rebuild listener ล้มเหลว", err);
  }
}

// ============================================================
// rebuildRoomShell
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
// buildBlocksShell
// ============================================================

const FLOOR_TILE = 1.4;
const BASE_SLAB = 0.02;

let _blocksOriginI = 0;
let _blocksOriginJ = 0;

function setBlocksOrigin(blocks: Set<string>): void {
  let minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity;
  blocks.forEach((k) => {
    const [i, j] = k.split(",").map(Number);
    if (i < minI) minI = i;
    if (i > maxI) maxI = i;
    if (j < minJ) minJ = j;
    if (j > maxJ) maxJ = j;
  });
  _blocksOriginI = (minI + maxI) / 2;
  _blocksOriginJ = (minJ + maxJ) / 2;
}

export function getBlocksOrigin(): { oi: number; oj: number } {
  const { room } = useRoomTwin.getState();
  const blocks = room.blocks;
  if (!blocks || blocks.size === 0) return { oi: 0, oj: 0 };
  let minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity;
  blocks.forEach((k) => {
    const [i, j] = k.split(",").map(Number);
    if (i < minI) minI = i;
    if (i > maxI) maxI = i;
    if (j < minJ) minJ = j;
    if (j > maxJ) maxJ = j;
  });
  return { oi: (minI + maxI) / 2, oj: (minJ + maxJ) / 2 };
}

export let blockFloorMat: THREE.MeshStandardMaterial | null = null;

function makeBlockFloorTexture(): THREE.CanvasTexture {
  const { surface } = useRoomTwin.getState();
  const tex = new THREE.CanvasTexture(makeFloorCanvas(surface.floor, 512));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

function ensureBlockFloorMat(): THREE.MeshStandardMaterial {
  if (!blockFloorMat) {
    blockFloorMat = new THREE.MeshStandardMaterial({
      map: makeBlockFloorTexture(),
      roughness: 0.85,
    });
  }
  return blockFloorMat;
}

function cellLevelOf(levels: Record<string, number>, key: string): number {
  return levels[key] ?? 0;
}

function floodFillRegions(cells: Set<string>): Set<string>[] {
  const visited = new Set<string>();
  const regions: Set<string>[] = [];
  for (const start of cells) {
    if (visited.has(start)) continue;
    const region = new Set<string>();
    const stack = [start];
    while (stack.length) {
      const k = stack.pop()!;
      if (region.has(k)) continue;
      region.add(k);
      visited.add(k);
      const [i, j] = k.split(",").map(Number);
      for (const [di, dj] of NEIGHBOR_OFFSETS) {
        const nk = `${i + di},${j + dj}`;
        if (cells.has(nk) && !region.has(nk)) stack.push(nk);
      }
    }
    regions.push(region);
  }
  return regions;
}

export const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

type GridEdge = { x0: number; z0: number; x1: number; z1: number };

function cellBoundaryEdges(cell: string, region: Set<string>): GridEdge[] {
  const [i, j] = cell.split(",").map(Number);
  const has = (a: number, b: number) => region.has(`${a},${b}`);
  const out: GridEdge[] = [];
  if (!has(i, j - 1)) out.push({ x0: i, z0: j, x1: i + 1, z1: j });
  if (!has(i + 1, j)) out.push({ x0: i + 1, z0: j, x1: i + 1, z1: j + 1 });
  if (!has(i, j + 1)) out.push({ x0: i + 1, z0: j + 1, x1: i, z1: j + 1 });
  if (!has(i - 1, j)) out.push({ x0: i, z0: j + 1, x1: i, z1: j });
  return out;
}

const edgeKey = (e: GridEdge) => `${e.x0},${e.z0}->${e.x1},${e.z1}`;

function traceRegionLoops(region: Set<string>): number[][][] {
  const remaining = new Map<string, GridEdge>();
  const byStart = new Map<string, GridEdge[]>();
  for (const cell of region) {
    for (const e of cellBoundaryEdges(cell, region)) {
      const k = edgeKey(e);
      if (remaining.has(k)) continue;
      remaining.set(k, e);
      const sk = `${e.x0},${e.z0}`;
      if (!byStart.has(sk)) byStart.set(sk, []);
      byStart.get(sk)!.push(e);
    }
  }

  const loops: number[][][] = [];
  let guard = 0;
  while (remaining.size > 0 && guard++ < 1e6) {
    const first = remaining.values().next().value as GridEdge;
    const loop: number[][] = [];
    let cur: GridEdge = first;
    let curKey = edgeKey(cur);
    while (remaining.has(curKey)) {
      remaining.delete(curKey);
      loop.push([cur.x0, cur.z0]);
      const cands = (byStart.get(`${cur.x1},${cur.z1}`) || []).filter((e) =>
        remaining.has(edgeKey(e)),
      );
      if (cands.length === 0) break;
      let next = cands[0];
      if (cands.length > 1) {
        let best = -Infinity;
        const px = cur.x1 - cur.x0;
        const pz = cur.z1 - cur.z0;
        for (const c of cands) {
          const dx = c.x1 - c.x0;
          const dz = c.z1 - c.z0;
          const ang = Math.atan2(px * dz - pz * dx, px * dx + pz * dz);
          if (ang > best) {
            best = ang;
            next = c;
          }
        }
      }
      cur = next;
      curKey = edgeKey(cur);
      if (loop.find((p) => p[0] === cur.x0 && p[1] === cur.z0)) break;
    }
    loops.push(loop);
  }
  return loops;
}

type WallFacadeId =
  | "back"
  | "front"
  | "side"
  | "right";

const wallFacadeRegistry =
  new Map<string, WallFacadeId>();

function canonicalGridEdgeKey(
  edge: GridEdge,
): string {
  const a = `${edge.x0},${edge.z0}`;
  const b = `${edge.x1},${edge.z1}`;

  return a < b
    ? `${a}<->${b}`
    : `${b}<->${a}`;
}

function wallGridEdge(
  wallId: string,
): GridEdge | null {
  const parsed =
    parseBlockWallId(wallId);

  if (!parsed) return null;

  const { i, j, side } = parsed;

  switch (side) {
    case "N":
      return {
        x0: i,
        z0: j,
        x1: i + 1,
        z1: j,
      };

    case "E":
      return {
        x0: i + 1,
        z0: j,
        x1: i + 1,
        z1: j + 1,
      };

    case "S":
      return {
        x0: i + 1,
        z0: j + 1,
        x1: i,
        z1: j + 1,
      };

    case "W":
      return {
        x0: i,
        z0: j + 1,
        x1: i,
        z1: j,
      };

    default:
      return null;
  }
}

function gridTurn(
  prev: number[],
  cur: number[],
  next: number[],
): number {
  const ax = cur[0] - prev[0];
  const az = cur[1] - prev[1];

  const bx = next[0] - cur[0];
  const bz = next[1] - cur[1];

  return ax * bz - az * bx;
}

function nearestUnusedConvexCorner(
  points: number[][],
  convexIndices: number[],
  targetX: number,
  targetZ: number,
  used: Set<number>,
): number | null {
  let bestIndex: number | null = null;
  let bestDistance = Infinity;

  for (const index of convexIndices) {
    if (used.has(index)) continue;

    const p = points[index];

    const distance =
      Math.abs(p[0] - targetX) +
      Math.abs(p[1] - targetZ);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function rebuildWallFacadeRegistry(
  blocks: Set<string>,
): void {
  wallFacadeRegistry.clear();

  if (blocks.size === 0) {
    return;
  }

  const loops =
    traceRegionLoops(blocks);

  if (loops.length === 0) {
    return;
  }

  let outerLoop: number[][] | null = null;
  let outerArea = -Infinity;

  for (const loop of loops) {
    if (loop.length < 4) continue;

    let area = 0;

    for (
      let i = 0;
      i < loop.length;
      i++
    ) {
      const p = loop[i];
      const q =
        loop[(i + 1) % loop.length];

      area +=
        p[0] * q[1] -
        q[0] * p[1];
    }

    const absArea = Math.abs(area);

    if (absArea > outerArea) {
      outerArea = absArea;
      outerLoop = loop;
    }
  }

  if (!outerLoop) {
    return;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const [x, z] of outerLoop) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }

  const convexIndices: number[] = [];

  for (
    let i = 0;
    i < outerLoop.length;
    i++
  ) {
    const prev =
      outerLoop[
        (i - 1 + outerLoop.length) %
          outerLoop.length
      ];

    const cur =
      outerLoop[i];

    const next =
      outerLoop[
        (i + 1) %
          outerLoop.length
      ];

    const turn =
      gridTurn(
        prev,
        cur,
        next,
      );

    if (turn > 0) {
      convexIndices.push(i);
    }
  }

  if (convexIndices.length < 4) {
    return;
  }

  const cornerTargets: Array<{
    x: number;
    z: number;
    facade: WallFacadeId;
  }> = [
    {
      x: minX,
      z: minZ,
      facade: "back",
    },
    {
      x: maxX,
      z: minZ,
      facade: "right",
    },
    {
      x: maxX,
      z: maxZ,
      facade: "front",
    },
    {
      x: minX,
      z: maxZ,
      facade: "side",
    },
  ];

  const used =
    new Set<number>();

  const anchors: Array<{
    index: number;
    facade: WallFacadeId;
  }> = [];

  for (const target of cornerTargets) {
    const index =
      nearestUnusedConvexCorner(
        outerLoop,
        convexIndices,
        target.x,
        target.z,
        used,
      );

    if (index == null) {
      wallFacadeRegistry.clear();
      return;
    }

    used.add(index);

    anchors.push({
      index,
      facade: target.facade,
    });
  }

  if (anchors.length !== 4) {
    wallFacadeRegistry.clear();
    return;
  }

  const anchorIndices =
    new Set(
      anchors.map((a) => a.index),
    );

  if (
    anchorIndices.size !== 4
  ) {
    wallFacadeRegistry.clear();
    return;
  }

  const edgeToWallId =
    new Map<string, string>();

  polyWalls.forEach((wall) => {
    const edge =
      wallGridEdge(wall.id);

    if (!edge) return;

    edgeToWallId.set(
      canonicalGridEdgeKey(edge),
      wall.id,
    );
  });

  if (edgeToWallId.size === 0) {
    return;
  }

  const orderedAnchors =
    [...anchors].sort(
      (a, b) =>
        a.index - b.index,
    );

  for (
    let k = 0;
    k < orderedAnchors.length;
    k++
  ) {
    const current =
      orderedAnchors[k];

    const next =
      orderedAnchors[
        (k + 1) %
          orderedAnchors.length
      ];

    const facade =
      current.facade;

    let index =
      current.index;

    while (index !== next.index) {
      const nextIndex =
        (index + 1) %
        outerLoop.length;

      const edge: GridEdge = {
        x0: outerLoop[index][0],
        z0: outerLoop[index][1],
        x1: outerLoop[nextIndex][0],
        z1: outerLoop[nextIndex][1],
      };

      const wallId =
        edgeToWallId.get(
          canonicalGridEdgeKey(edge),
        );

      if (wallId) {
        wallFacadeRegistry.set(
          wallId,
          facade,
        );
      }

      index = nextIndex;
    }
  }
}

function wallFacadeOf(
  wallId: string,
): WallFacadeId | null {
  if (wallId === "back") {
    return "back";
  }

  if (wallId === "front") {
    return "front";
  }

  if (wallId === "side") {
    return "side";
  }

  if (wallId === "right") {
    return "right";
  }

  return (
    wallFacadeRegistry.get(
      wallId,
    ) ?? null
  );
}

function shapeFromLoops(loops: number[][][], cellSize: number): THREE.Shape | null {
  const polys: { pts: THREE.Vector2[]; area: number }[] = [];
  for (const loop of loops) {
    const pts: THREE.Vector2[] = [];
    for (const [ix, iz] of loop)
      pts.push(
        new THREE.Vector2(
          (ix - 0.5 - _blocksOriginI) * cellSize,
          -(iz - 0.5 - _blocksOriginJ) * cellSize,
        ),
      );
    if (pts.length < 3) continue;
    if (pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
    if (pts.length < 3) continue;
    let area = 0;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k];
      const q = pts[(k + 1) % pts.length];
      area += p.x * q.y - q.x * p.y;
    }
    polys.push({ pts, area: area / 2 });
  }
  if (polys.length === 0) return null;
  polys.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  const outer = polys[0];
  const shape = new THREE.Shape();
  shape.moveTo(outer.pts[0].x, outer.pts[0].y);
  for (let k = 1; k < outer.pts.length; k++)
    shape.lineTo(outer.pts[k].x, outer.pts[k].y);
  shape.closePath();
  for (const hole of polys.slice(1)) {
    const path = new THREE.Path();
    path.moveTo(hole.pts[0].x, hole.pts[0].y);
    for (let k = 1; k < hole.pts.length; k++)
      path.lineTo(hole.pts[k].x, hole.pts[k].y);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

function addMergedFloorSlab(
  region: Set<string>,
  cellSize: number,
  bottom: number,
  top: number,
) {
  const height = top - bottom;
  if (height <= 0.0005) return;
  const shape = shapeFromLoops(traceRegionLoops(region), cellSize);
  if (!shape) return;

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);

  const uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
  if (uv) {
    const s = 1 / FLOOR_TILE;
    for (let k = 0; k < uv.count; k++) {
      uv.setXY(k, uv.getX(k) * s, uv.getY(k) * s);
    }
  }

  const m = new THREE.Mesh(geo, ensureBlockFloorMat());
  m.position.set(0, bottom, 0);
  m.receiveShadow = true;
  m.castShadow = true;
  m.userData.isFloor = true;
  m.userData.floorY = top;
  m.name = "FLOOR";
  floorGroup.add(m);
}

export function buildBlocksShell() {
  const { room } =
    useRoomTwin.getState();

  if (!room.blocks) return;

  polyWalls.forEach((wall) => {
    roomGroup.remove(
      wall.mesh,
    );

    if (wall.mesh.geometry) {
      wall.mesh.geometry.dispose();
    }

    if (wall.mat) {
      wall.mat.dispose();
    }

    meshWallId.delete(
      wall.mesh,
    );
  });

  polyWalls = [];
  mergedWallRegistry.clear();
  wallFacadeRegistry.clear();

  backWall.visible = false;
  sideWall.visible = false;
  rightWall.visible = false;
  frontWall.visible = false;

  ceilingMesh.visible = true;
  ceilingCollider.visible = true;

  clearGroup(floorGroup);
  clearGroup(ceilingGroup);
  clearGroup(
    ceilingColliderGroup,
  );

  setBlocksOrigin(
    room.blocks,
  );

  const cs =
    room.cellSize;

  const cellGeo =
    new THREE.PlaneGeometry(
      cs,
      cs,
    );

  const levels =
    room.cellLevels || {};

  const byLevel =
    new Map<
      number,
      Set<string>
    >();

  room.blocks.forEach(
    (key) => {
      const level =
        cellLevelOf(
          levels,
          key,
        );

      if (
        !byLevel.has(
          level,
        )
      ) {
        byLevel.set(
          level,
          new Set(),
        );
      }

      byLevel
        .get(level)!
        .add(key);
    },
  );

  const regionsByLevel =
    new Map<
      number,
      Set<string>[]
    >();

  byLevel.forEach(
    (cells, level) => {
      regionsByLevel.set(
        level,
        floodFillRegions(
          cells,
        ),
      );
    },
  );

  regionsByLevel.forEach(
    (regions, level) => {
      regions.forEach(
        (region) => {
          addMergedFloorSlab(
            region,
            cs,
            0,
            level === 0
              ? BASE_SLAB
              : level,
          );
        },
      );
    },
  );

  room.blocks.forEach(
    (key) => {
      const [i, j] =
        key
          .split(",")
          .map(Number);

      const level =
        cellLevelOf(
          levels,
          key,
        );

      for (
        const [
          di,
          dj,
          side,
        ] of SIDE_DIRS
      ) {
        const neighbor =
          `${i + di},${
            j + dj
          }`;

        if (
          !room.blocks!.has(
            neighbor,
          )
        ) {
          addBlockWall(
            i,
            j,
            side,
            level,
            room.h,
            false,
          );
        }
      }
    },
  );

  room.blocks.forEach(
    (key) => {
      const [i, j] =
        key
          .split(",")
          .map(Number);

      const cx =
        (i -
          _blocksOriginI) *
        cs;

      const cz =
        (j -
          _blocksOriginJ) *
        cs;

      const ceiling =
        new THREE.Mesh(
          cellGeo,
          ceilingMat,
        );

      ceiling.rotation.x =
        Math.PI / 2;

      ceiling.position.set(
        cx,
        room.h,
        cz,
      );

      ceiling.userData.isCeiling =
        true;

      ceilingGroup.add(
        ceiling,
      );

      const collider =
        new THREE.Mesh(
          cellGeo,
          ceilingColliderMat,
        );

      collider.rotation.x =
        Math.PI / 2;

      collider.position.set(
        cx,
        room.h - 0.002,
        cz,
      );

      ceilingColliderGroup.add(
        collider,
      );
    },
  );

  rebuildWallFacadeRegistry(
    room.blocks,
  );

  computeMergedWalls();

  applySurface();
}

const SIDE_DIRS: Array<[number, number, string]> = [
  [0, -1, "N"],
  [0, 1, "S"],
  [1, 0, "E"],
  [-1, 0, "W"],
];

export function addBlockWall(
  i: number,
  j: number,
  side: string,
  bottomY: number,
  topY: number,
  isRiser: boolean,
) {
  const { room, surface } = useRoomTwin.getState();
  const cs = room.cellSize;
  const height = topY - bottomY;
  if (height <= 0.001) return;

  const mat = new THREE.MeshStandardMaterial({
    color: surface.wallAll,
    roughness: 0.95,
    side: THREE.FrontSide,
    transparent: true,
  });

  const geo = new THREE.PlaneGeometry(cs, height);
  const m = new THREE.Mesh(geo, mat);

  let cx: number, cz: number, rotY: number;
  let nx: number, nz: number, dx: number, dz: number;
  const c = {
    x: (i - _blocksOriginI) * cs,
    z: (j - _blocksOriginJ) * cs,
  };

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

  m.position.set(cx, bottomY + height / 2, cz);
  m.rotation.y = rotY;
  m.receiveShadow = true;
  roomGroup.add(m);

  if (isRiser) return;

  const wid = `bw_${i}_${j}_${side}`;
  meshWallId.set(m, wid);
  polyWalls.push({
    id: wid, mesh: m, mat,
    outward: new THREE.Vector3(nx, 0, nz),
    cx, cz, dx, dz, nx, nz,
    len: cs, rotY,
  });
}