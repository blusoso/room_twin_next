// lib/three/zoneHelpers.ts
import { useRoomTwin } from "@/lib/state/store";
import type { PlacedItem } from "@/lib/state/types";
import { getZoneBounds } from "./zoneBounds";
import { raycastFloorPoint } from "./raycast";

export interface ZoneHit {
  zoneUid: string;
  dist: number;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    cx: number;
    cz: number;
  };
}

export function findNearbyZonesAt(x: number, z: number): ZoneHit[] {
  const { placedItems } = useRoomTwin.getState();
  const res: ZoneHit[] = [];
  const seen = new Set<string>();

  placedItems.forEach((i) => {
    if (!i.zoneUid || seen.has(i.zoneUid)) return;
    seen.add(i.zoneUid);
    const b = getZoneBounds(i.zoneUid);
    if (!b) return;
    const dx = Math.max(b.minX - x, 0, x - b.maxX);
    const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
    const dist = Math.hypot(dx, dz);
    res.push({ zoneUid: i.zoneUid, dist, bounds: b });
  });

  res.sort((a, b) => a.dist - b.dist);
  return res;
}

/**
 * ⭐ ย้าย item เข้า/ออกโซน — patch zoneUid/zoneDefId/slotId
 * @param insertBeforeUid ถ้าระบุ จะย้าย item ไปแทรกก่อน item นี้ใน placedItems
 *                        (ใช้ตอนลากจัดลำดับในโซนเดียวกัน) — ถ้าไม่พบจะต่อท้าย
 */
export function assignItemToZone(
  uid: string,
  zuid: string | null,
  insertBeforeUid?: string | null,
) {
  const { placedItems, replaceItems } = useRoomTwin.getState();
  const item = placedItems.find((i) => i.uid === uid);
  if (!item) return;
  if (insertBeforeUid === uid) return;

  const any = zuid
    ? placedItems.find((i) => i.zoneUid === zuid && i.zoneDefId)
    : null;

  // ⭐ patch สมาชิกโซน + จัดลำดับใหม่ใน update เดียว (atomic)
  const patched: PlacedItem = {
    ...item,
    zoneUid: zuid,
    zoneDefId: zuid ? (any ? any.zoneDefId : null) : null,
    slotId: undefined,
  };

  let next = placedItems.map((i) => (i.uid === uid ? patched : i));

  if (insertBeforeUid) {
    next = next.filter((i) => i.uid !== uid);
    const bi = next.findIndex((i) => i.uid === insertBeforeUid);
    if (bi >= 0) next.splice(bi, 0, patched);
    else next.push(patched);
  }

  replaceItems(next);
}

/**
 * ⭐ ตรวจว่าจุด (cx, cy) อยู่บน zone หรือไม่
 * ใช้สำหรับ hover detection + click detection
 */
export function hitTestZoneBounds(cx: number, cy: number): string | null {
  const { placedItems } = useRoomTwin.getState();
  const p = raycastFloorPoint(cx, cy);
  if (!p) return null;

  const zuids = new Set<string>();
  placedItems.forEach((i) => {
    if (i.zoneUid) zuids.add(i.zoneUid);
  });

  for (const z of zuids) {
    const b = getZoneBounds(z);
    if (!b) continue;
    if (p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ)
      return z;
  }
  return null;
}