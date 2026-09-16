// lib/three/placement.ts
import * as THREE from "three";
import { findFloorYAt, findFloorYAtFootprint, getBlocksOrigin } from "./roomShell";
import { surfaceColliders, objectsByUid } from "./scene";
import { useRoomTwin } from "@/lib/state/store";
import { PRODUCT_BY_ID } from "@/lib/data/products";
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
  const { oi, oj } = getBlocksOrigin();
  return { x: (i - oi) * room.cellSize, z: (j - oj) * room.cellSize };
}

function footprintAllInBlocks(fp: { w: number; d: number }, x: number, z: number) {
  const { room } = useRoomTwin.getState();
  if (room.shape !== "blocks" || !room.blocks) return true;
  const cs = room.cellSize;
  // ⭐ world → index ต้องบวก origin เพราะ cell (i,j) render ที่ ((i-oi)*cs, (j-oj)*cs)
  const { oi, oj } = getBlocksOrigin();
  const iMin = Math.floor((x - fp.w / 2) / cs + oi + 0.5);
  const iMax = Math.floor((x + fp.w / 2) / cs + oi + 0.5);
  const jMin = Math.floor((z - fp.d / 2) / cs + oj + 0.5);
  const jMax = Math.floor((z + fp.d / 2) / cs + oj + 0.5);
  for (let i = iMin; i <= iMax; i++)
    for (let j = jMin; j <= jMax; j++)
      if (!room.blocks.has(`${i},${j}`)) return false;
  return true;
}

function blocksCentroid() {
  const { room } = useRoomTwin.getState();
  if (!room.blocks) return { x: 0, z: 0 };
  const { oi, oj } = getBlocksOrigin();
  let sx = 0, sz = 0, n = 0;
  room.blocks.forEach((k) => {
    const [i, j] = k.split(",").map(Number);
    sx += (i - oi) * room.cellSize;
    sz += (j - oj) * room.cellSize;
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
  const { oi, oj } = getBlocksOrigin();
  let best: { x: number; z: number } | null = null;
  let bestD = Infinity;
  room.blocks?.forEach((k) => {
    const [i, j] = k.split(",").map(Number);
    const cc = { x: (i - oi) * room.cellSize, z: (j - oj) * room.cellSize };
    if (footprintAllInBlocks(fp, cc.x, cc.z)) {
      const d = (cc.x - x) ** 2 + (cc.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = cc;
      }
    }
  });
  // ⭐ ถ้าไม่มี cell ไหนพอดี ให้ fallback ไป centroid (อยู่ในผังเสมอ) — ไม่ปล่อยหลุดเป็น {x,z} ดิบ
  return best || c;
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

/**
 * ⭐ ตรวจว่าถ้าเลื่อน item ทุกตัวใน entries ด้วย (dx, dz) แล้ว footprint ยังอยู่ในผังบล็อกครบ
 *    ใช้สำหรับลากทั้งโซนแบบ rigid (delta เดียวกันทุกตัว)
 */
export function allFootprintsInBlocks(
  entries: ReadonlyArray<{ uid: string; x: number; z: number }>,
  dx: number,
  dz: number,
): boolean {
  const { room, placedItems } = useRoomTwin.getState();
  if (room.shape !== "blocks" || !room.blocks || room.blocks.size === 0)
    return true;
  return entries.every((si) => {
    const it = placedItems.find((i) => i.uid === si.uid);
    if (!it) return true;
    const fp = footprintOf(it.params, it.rotY || 0);
    return footprintAllInBlocks(fp, si.x + dx, si.z + dz);
  });
}

// ============================================================
// ⭐ ลากทั้งโซนแบบ rigid — clamp delta ไม่ให้หลุดพื้นที่ห้อง
// ============================================================

type ZoneDragEntry = { uid: string; x: number; z: number };

/** bbox ของกลุ่ม item ที่ลาก (ใช้ footprint จริงของแต่ละตัว) */
function bboxOfEntries(entries: ReadonlyArray<ZoneDragEntry>) {
  const { placedItems } = useRoomTwin.getState();
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  entries.forEach((si) => {
    const it = placedItems.find((i) => i.uid === si.uid);
    if (!it) return;
    const fp = footprintOf(it.params, it.rotY || 0);
    minX = Math.min(minX, si.x - fp.w / 2);
    maxX = Math.max(maxX, si.x + fp.w / 2);
    minZ = Math.min(minZ, si.z - fp.d / 2);
    maxZ = Math.max(maxZ, si.z + fp.d / 2);
  });
  if (!isFinite(minX)) return null;
  return { minX, maxX, minZ, maxZ };
}

/**
 * ⭐ ขอบเขต "พื้นที่ห้อง" ที่โซนต้องอยู่ภายใน
 *    - rect   : ขอบห้อง (margin 0.03 เท่ากับ clampToRoom)
 *    - blocks : ขอบ cell ของผัง (margin 0 — ให้ตรงกับที่ render จริง)
 */
function roomOuterBounds(): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const { room } = useRoomTwin.getState();
  if (room.shape === "blocks" && room.blocks && room.blocks.size > 0) {
    const cs = room.cellSize;
    const { oi, oj } = getBlocksOrigin();
    let minI = Infinity;
    let maxI = -Infinity;
    let minJ = Infinity;
    let maxJ = -Infinity;
    room.blocks.forEach((k) => {
      const [i, j] = k.split(",").map(Number);
      if (i < minI) minI = i;
      if (i > maxI) maxI = i;
      if (j < minJ) minJ = j;
      if (j > maxJ) maxJ = j;
    });
    return {
      minX: (minI - oi) * cs - cs / 2,
      maxX: (maxI - oi) * cs + cs / 2,
      minZ: (minJ - oj) * cs - cs / 2,
      maxZ: (maxJ - oj) * cs + cs / 2,
    };
  }
  const margin = 0.03;
  return {
    minX: -room.w / 2 + margin,
    maxX: room.w / 2 - margin,
    minZ: -room.d / 2 + margin,
    maxZ: room.d / 2 - margin,
  };
}

/**
 * ⭐ clamp delta ของ bbox ต่อ 1 แกน ให้ bbox อยู่ใน [lo, hi]
 *    ถ้า bbox กว้างกว่าห้อง ให้จัดกึ่งกลาง (กัน clamp สองฝั่งหักกันเอง)
 *    คืนค่าเป็น delta สัมบูรณ์ (ไม่ใช่ค่าปรับเพิ่ม)
 */
function clampAxisDelta(
  min: number,
  max: number,
  lo: number,
  hi: number,
  raw: number,
): number {
  if (max - min > hi - lo) return (lo + hi) / 2 - (min + max) / 2;
  if (min + raw < lo) return lo - min;
  if (max + raw > hi) return hi - max;
  return raw;
}

/**
 * ⭐ delta สำหรับลากทั้งโซน (rigid — item ทุกตัวขยับเท่ากัน)
 *    รับประกันว่า bbox ของโซนไม่หลุดออกนอกพื้นที่ห้อง
 *    และในห้องแบบ blocks จะพยายามให้ item ทุกตัวยังอยู่ใน cell ที่มีอยู่จริง
 */
export function clampZoneDelta(
  entries: ReadonlyArray<ZoneDragEntry>,
  rawDx: number,
  rawDz: number,
): { dx: number; dz: number } {
  const bbox = bboxOfEntries(entries);
  if (!bbox) return { dx: rawDx, dz: rawDz };

  const { room } = useRoomTwin.getState();
  const isBlocks =
    room.shape === "blocks" && !!room.blocks && room.blocks.size > 0;

  if (isBlocks) {
    // ปลายทางอยู่ในผังแล้ว → ใช้ได้เลย
    if (allFootprintsInBlocks(entries, rawDx, rawDz))
      return { dx: rawDx, dz: rawDz };

    // เริ่มจาก pose ที่ถูกต้อง → หา delta มากสุดที่ item ทุกตัวยังอยู่ในผัง
    //    mid=0 = ตำแหน่งปัจจุบัน (valid), mid=1 = ปลายทาง ⇒ valid ให้เก็บ lo
    if (allFootprintsInBlocks(entries, 0, 0)) {
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        if (allFootprintsInBlocks(entries, rawDx * mid, rawDz * mid))
          lo = mid;
        else hi = mid;
      }
      return { dx: rawDx * lo, dz: rawDz * lo };
    }
  }

  // กรณี rect หรือเริ่มจาก pose ที่ไม่ครบผัง → จำกัดให้อยู่ในขอบพื้นที่ห้อง
  const b = roomOuterBounds();
  return {
    dx: clampAxisDelta(bbox.minX, bbox.maxX, b.minX, b.maxX, rawDx),
    dz: clampAxisDelta(bbox.minZ, bbox.maxZ, b.minZ, b.maxZ, rawDz),
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

/**
 * ⭐ bottom offset ของ mesh — ระยะจาก origin ลงมาถึงขอบล่างจริงของ model
 * คำนวณจาก Box3 ครั้งเดียวตอน instantiate (หมุนเฉพาะแกน Y จึงไม่กระทบ min.y)
 * default = 0 สำหรับ product ที่ pivot อยู่ base
 */
export function bottomOffsetFor(uid: string): number {
  return objectsByUid.get(uid)?.userData.bottomOffset ?? 0;
}

/** ⭐ หา floor Y จาก center + 4 มุม footprint (max); rug ยังใช้ center ตามเดิม */
function floorYForItem(item: {
  x?: number;
  z?: number;
  params: any;
  rotY?: number;
  productId: string;
}): number {
  const x = item.x ?? 0;
  const z = item.z ?? 0;
  const isRug = item.productId === "roundrug" || item.productId === "rectrug";
  return isRug
    ? findFloorYAt(x, z)
    : findFloorYAtFootprint(x, z, footprintOf(item.params, item.rotY || 0));
}

export function resolveRestHeights() {
  const { placedItems, updateItem } = useRoomTwin.getState();
  const resolved = new Map<string, number>();
  placedItems.forEach((i) => {
    if (i.wallMount || i.ceilingMount) return;
    const product = PRODUCT_BY_ID.get(i.productId);
    if (product?.structural) {
      // ⭐ โครงสร้าง (เสา/ฉาก/บันได) ยึดกับพิกัดโครงสร้างห้อง — ไม่ตามระดับพื้น
      resolved.set(i.uid, i.restY ?? 0);
    } else if (!i.parentUid) {
      resolved.set(i.uid, floorYForItem(i));
    }
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
    if (i.parentUid && !placedItems.find((p) => p.uid === i.parentUid)) {
      updateItem(i.uid, { parentUid: null });
      // ⭐ orphan — parent หายไปแล้ว ให้ fallback ลงพื้นด้วย footprint (ไม่ใช่ 0)
      resolved.set(i.uid, floorYForItem(i));
    }
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