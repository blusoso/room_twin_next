// lib/three/placement.ts
import * as THREE from "three";
import { findFloorYAt } from "./roomShell";
import { surfaceColliders } from "./scene";
import { useRoomTwin } from "@/lib/state/store";
import { GRID } from "@/lib/data/constants";

export function footprintOf(dimsOrProduct: any, rotY: number) {
  const d = dimsOrProduct.dims || dimsOrProduct;
  const w = d.w / 100;
  const dd = d.d / 100;
  const c = Math.abs(Math.cos(rotY));
  const s = Math.abs(Math.sin(rotY));
  return { w: w * c + dd * s, d: w * s + dd * c };
}

export function cellKey(i: number, j: number) {
  return `${i},${j}`;
}

export function cellCenter(i: number, j: number) {
  const { room } = useRoomTwin.getState();
  return { x: i * room.cellSize, z: j * room.cellSize };
}

function footprintAllInBlocks(fp: { w: number; d: number }, x: number, z: number) {
  const { room } = useRoomTwin.getState();
  if (room.shape !== "blocks" || !room.blocks) return true;
  const cs = room.cellSize;
  const iMin = Math.floor((x - fp.w / 2) / cs + 0.5);
  const iMax = Math.floor((x + fp.w / 2) / cs + 0.5);
  const jMin = Math.floor((z - fp.d / 2) / cs + 0.5);
  const jMax = Math.floor((z + fp.d / 2) / cs + 0.5);
  for (let i = iMin; i <= iMax; i++)
    for (let j = jMin; j <= jMax; j++)
      if (!room.blocks.has(`${i},${j}`)) return false;
  return true;
}

function blocksCentroid() {
  const { room } = useRoomTwin.getState();
  if (!room.blocks) return { x: 0, z: 0 };
  let sx = 0, sz = 0, n = 0;
  room.blocks.forEach((k) => {
    const [i, j] = k.split(",").map(Number);
    sx += i * room.cellSize;
    sz += j * room.cellSize;
    n++;
  });
  return n ? { x: sx / n, z: sz / n } : { x: 0, z: 0 };
}

function clampToBlocks(x: number, z: number, fp: { w: number; d: number }) {
  if (footprintAllInBlocks(fp, x, z)) return { x, z };
  const c = blocksCentroid();
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const mx = x + (c.x - x) * mid;
    const mz = z + (c.z - z) * mid;
    if (footprintAllInBlocks(fp, mx, mz)) hi = mid;
    else lo = mid;
  }
  const nx = x + (c.x - x) * hi;
  const nz = z + (c.z - z) * hi;
  if (footprintAllInBlocks(fp, nx, nz)) return { x: nx, z: nz };

  const { room } = useRoomTwin.getState();
  let best: { x: number; z: number } | null = null;
  let bestD = Infinity;
  room.blocks?.forEach((k) => {
    const [i, j] = k.split(",").map(Number);
    const cc = { x: i * room.cellSize, z: j * room.cellSize };
    if (footprintAllInBlocks(fp, cc.x, cc.z)) {
      const d = (cc.x - x) ** 2 + (cc.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = cc;
      }
    }
  });
  return best || { x, z };
}

export function clampToRoom(x: number, z: number, fp: { w: number; d: number }) {
  const { room } = useRoomTwin.getState();
  if (room.shape === "blocks" && room.blocks && room.blocks.size > 0)
    return clampToBlocks(x, z, fp);
  const margin = 0.03;
  const maxX = room.w / 2 - fp.w / 2 - margin;
  const maxZ = room.d / 2 - fp.d / 2 - margin;
  return {
    x: Math.max(-maxX, Math.min(maxX, x)),
    z: Math.max(-maxZ, Math.min(maxZ, z)),
  };
}

export function snap(v: number) {
  return Math.round(v / GRID) * GRID;
}

const _surfBox = new THREE.Box3();

export function surfaceBoundsFor(hostUid: string) {
  const collider = surfaceColliders.get(hostUid);
  if (!collider) return null;
  _surfBox.setFromObject(collider);
  return _surfBox.clone();
}

export function clampToSurfaceBox(
  box: THREE.Box3,
  x: number,
  z: number,
  fp: { w: number; d: number },
) {
  const hw = fp.w / 2;
  const hd = fp.d / 2;
  const mnX = box.min.x + hw;
  const mxX = box.max.x - hw;
  const mnZ = box.min.z + hd;
  const mxZ = box.max.z - hd;
  const cx = mnX <= mxX ? Math.max(mnX, Math.min(mxX, x)) : (box.min.x + box.max.x) / 2;
  const cz = mnZ <= mxZ ? Math.max(mnZ, Math.min(mxZ, z)) : (box.min.z + box.max.z) / 2;
  return { x: cx, z: cz };
}

export function clampPosition(
  x: number,
  z: number,
  fp: { w: number; d: number },
  parentUid?: string | null,
) {
  if (parentUid) {
    const box = surfaceBoundsFor(parentUid);
    if (box) return clampToSurfaceBox(box, x, z, fp);
  }
  return clampToRoom(x, z, fp);
}

export function rectOverlap(
  ax: number, az: number, afp: { w: number; d: number },
  bx: number, bz: number, bfp: { w: number; d: number },
) {
  const oX = afp.w / 2 + bfp.w / 2 - Math.abs(ax - bx);
  const oZ = afp.d / 2 + bfp.d / 2 - Math.abs(az - bz);
  return { overlapping: oX > 0 && oZ > 0, overlapX: oX, overlapZ: oZ };
}

export function collectDescendantUids(uid: string, set?: Set<string>): Set<string> {
  const s = set || new Set<string>([uid]);
  const { placedItems } = useRoomTwin.getState();
  placedItems.forEach((i) => {
    if (i.parentUid === uid && !s.has(i.uid)) {
      s.add(i.uid);
      collectDescendantUids(i.uid, s);
    }
  });
  return s;
}

export function resolveFloorOverlap(
  uid: string | null,
  x: number,
  z: number,
  fp: { w: number; d: number },
  parentUid?: string | null,
) {
  const { placedItems } = useRoomTwin.getState();
  const ex = uid ? collectDescendantUids(uid) : new Set<string>();
  let px = x, pz = z;

  for (let p = 0; p < 6; p++) {
    let moved = false;
    placedItems.forEach((other) => {
      if (ex.has(other.uid) || other.wallMount || other.ceilingMount) return;
      if ((other.parentUid || null) !== (parentUid || null)) return;
      if (other.productId === "roundrug" || other.productId === "rectrug") return;
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

export function resolvePlacement(
  uid: string | null,
  x: number,
  z: number,
  fp: { w: number; d: number },
  parentUid: string | null | undefined,
  isRug?: boolean,
) {
  let c = clampPosition(x, z, fp, parentUid);
  if (isRug) return c;
  c = resolveFloorOverlap(uid, c.x, c.z, fp, parentUid);
  c = clampPosition(c.x, c.z, fp, parentUid);
  return c;
}

export function computeRestY(parentUid: string | null | undefined): number {
  if (!parentUid) return 0;
  const { placedItems } = useRoomTwin.getState();
  const p = placedItems.find((i) => i.uid === parentUid);
  if (!p) return 0;
  // surface factor
  const surfaceSet = new Set([
    "nightstand", "dressing", "desk", "bookshelf", "wardrobe", "bench",
  ]);
  const sr = surfaceSet.has(p.productId) ? 1.0 : 0;
  return (p.restY || 0) + sr * (p.params.h / 100);
}

export function resolveRestHeights() {
  const { placedItems, updateItem } = useRoomTwin.getState();
  const resolved = new Map<string, number>();
  placedItems.forEach((i) => {
    if (!i.wallMount && !i.ceilingMount && !i.parentUid)
      resolved.set(i.uid, findFloorYAt(i.x!, i.z!));
  });

  let ch = true;
  let it = 0;
  while (ch && it < 20) {
    ch = false;
    it++;
    placedItems.forEach((i) => {
      if (i.wallMount || i.ceilingMount) return;
      if (i.parentUid && !resolved.has(i.uid) && resolved.has(i.parentUid)) {
        const p = placedItems.find((pp) => pp.uid === i.parentUid);
        if (!p) return;
        const surfaceSet = new Set([
          "nightstand", "dressing", "desk", "bookshelf", "wardrobe", "bench",
        ]);
        const sr = surfaceSet.has(p.productId) ? 1.0 : 0;
        resolved.set(i.uid, resolved.get(i.parentUid)! + sr * (p.params.h / 100));
        ch = true;
      }
    });
  }

  placedItems.forEach((i) => {
    if (i.wallMount) return;
    if (i.ceilingMount) return;
    if (i.parentUid && !placedItems.find((p) => p.uid === i.parentUid))
      updateItem(i.uid, { parentUid: null });
    const newY = resolved.has(i.uid) ? resolved.get(i.uid)! : 0;
    if (Math.abs(newY - (i.restY || 0)) > 1e-6)
      updateItem(i.uid, { restY: newY });
  });
}

export function applyTransformToDescendants(
  hostUid: string,
  oldX: number,
  oldZ: number,
  newX: number,
  newZ: number,
  dRot: number,
) {
  const { placedItems, updateItem } = useRoomTwin.getState();
  const children = placedItems.filter((p) => p.parentUid === hostUid);
  children.forEach((child) => {
    const rx = child.x! - oldX;
    const rz = child.z! - oldZ;
    const c = Math.cos(dRot);
    const s = Math.sin(dRot);
    const ncX = newX + (rx * c - rz * s);
    const ncZ = newZ + (rx * s + rz * c);
    applyTransformToDescendants(child.uid, child.x!, child.z!, ncX, ncZ, dRot);
    updateItem(child.uid, {
      x: ncX,
      z: ncZ,
      rotY: (child.rotY || 0) + dRot,
    });
  });
}