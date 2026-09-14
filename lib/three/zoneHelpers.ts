// lib/three/zoneHelpers.ts
import { useRoomTwin } from "@/lib/state/store";
import { getZoneBounds } from "./zoneBounds";

export interface ZoneHit {
  zoneUid: string;
  dist: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; cx: number; cz: number };
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

export function assignItemToZone(uid: string, zuid: string | null) {
  const { placedItems, updateItem } = useRoomTwin.getState();
  const item = placedItems.find((i) => i.uid === uid);
  if (!item) return;

  if (zuid) {
    const any = placedItems.find((i) => i.zoneUid === zuid && i.zoneDefId);
    updateItem(uid, {
      zoneUid: zuid,
      zoneDefId: any ? any.zoneDefId : null,
      slotId: undefined,
    });
  } else {
    updateItem(uid, {
      zoneUid: null,
      zoneDefId: null,
      slotId: undefined,
    });
  }
}

export function hitTestZoneBounds(cx: number, cy: number): string | null {
  const { placedItems } = useRoomTwin.getState();
  const { raycastFloorPoint } = require("./raycast");
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