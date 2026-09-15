// hooks/usePlacement.ts
"use client";
import { useCallback } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { PRODUCT_BY_ID, defaultParamsFor } from "@/lib/data/products";
import { ZONE_BY_ID } from "@/lib/data/zones";
import { applyThemeToItem } from "@/lib/three/themeApply";
import {
  footprintOf,
  resolvePlacement,
  snap,
  computeRestY,
  resolveRestHeights,
} from "@/lib/three/placement";
import {
  resolveWallPlacement,
  wallFootprint,
} from "@/lib/three/wallPlacement";
import { resolveCeilingPlacement } from "@/lib/three/ceilingPlacement";
import {
  raycastPlacement,
  raycastWallPlacement,
  raycastCeilingPlacement,
} from "@/lib/three/raycast";
import { instantiate, reinstantiateItem } from "@/lib/three/instantiate";
import { rebuildBaseboards, getWallRotY } from "@/lib/three/roomShell";
import { findNearbyZonesAt, assignItemToZone } from "@/lib/three/zoneHelpers";
import {
  ZONE_ATTACH_MAX_DIST,
  ZONE_AMBIGUOUS_GAP,
} from "@/lib/data/constants";
import { showToast } from "@/lib/three/toast";
import type { PlacedItem, Params } from "@/lib/state/types";

// ============================================================
// Types
// ============================================================

export interface PlaceResult {
  uid: string | null;
  error?: string;
}

// ============================================================
// Hook
// ============================================================

export function usePlacement() {
  // ===== Place product (floor / wall / ceiling) =====
  const placeProduct = useCallback(
    (pid: string, cx: number, cy: number): PlaceResult => {
      const p = PRODUCT_BY_ID.get(pid);
      if (!p) {
        showToast("ไม่พบไอเทมนี้ในแคตตาล็อก");
        return { uid: null, error: "no-product" };
      }

      // Wall-mounted
      if (p.wallMount) {
        const hit = raycastWallPlacement(cx, cy);
        if (!hit) {
          showToast(`วาง "${p.name}" ไม่สำเร็จ — ต้องแขวนบนผนังที่มองเห็น`);
          return { uid: null, error: "no-wall" };
        }
        const uid = addWallItem(pid, hit.wallId, hit.u, hit.v);
        return { uid };
      }

      // Ceiling-mounted
      if (p.ceilingMount) {
        const hit = raycastCeilingPlacement(cx, cy);
        if (!hit) {
          showToast(`วาง "${p.name}" ไม่สำเร็จ — ต้องแขวนบนเพดาน`);
          return { uid: null, error: "no-ceiling" };
        }
        const uid = addCeilingItem(pid, hit.x, hit.z);
        return { uid };
      }

      // Floor
      const hit = raycastPlacement(cx, cy, null);
      if (!hit) {
        showToast(`วาง "${p.name}" ไม่สำเร็จ — วางบนพื้นหรือเฟอร์นิเจอร์`);
        return { uid: null, error: "no-floor" };
      }
      const uid = addFloorItem(pid, hit.point.x, hit.point.z, hit.hostUid);
      if (uid) handleZoneDrop(uid, hit.point.x, hit.point.z);
      return { uid };
    },
    [],
  );

  // ===== Place themed product =====
  const placeThemedProduct = useCallback(
    (pid: string, tid: string, cx: number, cy: number): PlaceResult => {
      const p = PRODUCT_BY_ID.get(pid);
      if (!p) {
        showToast("ไม่พบไอเทมนี้ในแคตตาล็อก");
        return { uid: null, error: "no-product" };
      }

      // Wall-mounted
      if (p.wallMount) {
        const hit = raycastWallPlacement(cx, cy);
        if (!hit) {
          showToast(`วาง "${p.name}" ไม่สำเร็จ — ต้องแขวนบนผนังที่มองเห็น`);
          return { uid: null, error: "no-wall" };
        }
        const uid = addWallItem(pid, hit.wallId, hit.u, hit.v);
        if (uid) applyThemeAndRebuild(uid, tid);
        return { uid };
      }

      // Ceiling-mounted
      if (p.ceilingMount) {
        const hit = raycastCeilingPlacement(cx, cy);
        if (!hit) {
          showToast(`วาง "${p.name}" ไม่สำเร็จ — ต้องแขวนบนเพดาน`);
          return { uid: null, error: "no-ceiling" };
        }
        const uid = addCeilingItem(pid, hit.x, hit.z);
        if (uid) applyThemeAndRebuild(uid, tid);
        return { uid };
      }

      // Floor
      const hit = raycastPlacement(cx, cy, null);
      if (!hit) {
        showToast(`วาง "${p.name}" ไม่สำเร็จ — วางบนพื้นหรือเฟอร์นิเจอร์`);
        return { uid: null, error: "no-floor" };
      }
      const uid = addFloorItem(pid, hit.point.x, hit.point.z, hit.hostUid);
      if (uid) {
        applyThemeAndRebuild(uid, tid);
        handleZoneDrop(uid, hit.point.x, hit.point.z);
      }
      return { uid };
    },
    [],
  );

  // ===== Place zone =====
  const placeZone = useCallback(
    (zid: string, cx: number, cy: number): PlaceResult => {
      const hit = raycastPlacement(cx, cy, null);
      if (!hit || hit.hostUid) {
        showToast("วางโซนบนพื้นห้องเท่านั้น");
        return { uid: null, error: "no-floor" };
      }
      const uid = addZone(zid, hit.point.x, hit.point.z);
      return { uid };
    },
    [],
  );

  return { placeProduct, placeThemedProduct, placeZone };
}

// ============================================================
// Internal helpers
// ============================================================

function addFloorItem(
  pid: string,
  x: number,
  z: number,
  hostUid: string | null,
): string | null {
  const p = PRODUCT_BY_ID.get(pid);
  if (!p) return null;

  const { addItem, surface } = useRoomTwin.getState();
  const params: Params = defaultParamsFor(p);

  // ⭐ Partition ใช้สีเดียวกับผนังอัตโนมัติ
  if (pid === "partition") {
    params.color = surface.wallAll;
  }

  const host = p.rug ? null : hostUid;

  const uid = "i" + Math.random().toString(36).slice(2, 10);
  const fp = footprintOf(params, 0);
  const c = resolvePlacement(null, snap(x), snap(z), fp, host, p.rug);
  const restY = computeRestY(host);

  const item: PlacedItem = {
    uid,
    productId: pid,
    params,
    x: c.x,
    z: c.z,
    rotY: 0,
    parentUid: host,
    restY,
  };

  addItem(item);
  instantiate(item);
  return uid;
}

function addWallItem(
  pid: string,
  wallId: string,
  u: number,
  v: number,
): string | null {
  const p = PRODUCT_BY_ID.get(pid);
  if (!p) return null;

  const { addItem } = useRoomTwin.getState();
  const params: Params = defaultParamsFor(p);
  const { halfU, halfV } = wallFootprint(params, 0);
  const c = resolveWallPlacement(
    null,
    wallId,
    u,
    v,
    halfU,
    halfV,
    p.groundAnchor || false,
  );

  const uid = "i" + Math.random().toString(36).slice(2, 10);
  const item: PlacedItem = {
    uid,
    productId: pid,
    params,
    wallMount: true,
    wallId,
    u: c.u,
    v: c.v,
    rotY: getWallRotY(wallId),
    rotZ: 0,
  };

  addItem(item);
  instantiate(item);
  rebuildBaseboards();
  return uid;
}

function addCeilingItem(
  pid: string,
  x: number,
  z: number,
): string | null {
  const p = PRODUCT_BY_ID.get(pid);
  if (!p) return null;

  const { addItem } = useRoomTwin.getState();
  const params: Params = defaultParamsFor(p);
  const fp = footprintOf(params, 0);
  const dropH = params.h / 100;
  const c = resolveCeilingPlacement(null, snap(x), snap(z), fp, dropH);

  const uid = "i" + Math.random().toString(36).slice(2, 10);
  const item: PlacedItem = {
    uid,
    productId: pid,
    params,
    ceilingMount: true,
    x: c.x,
    z: c.z,
    rotY: 0,
  };

  addItem(item);
  instantiate(item);
  return uid;
}

function applyThemeAndRebuild(uid: string, tid: string) {
  const { placedItems } = useRoomTwin.getState();
  const item = placedItems.find((i) => i.uid === uid);
  if (!item) return;
  applyThemeToItem(item, tid);
  reinstantiateItem(uid);
  resolveRestHeights();
}

function addZone(zid: string, cx: number, cz: number): string | null {
  const zdef = ZONE_BY_ID.get(zid);
  if (!zdef) return null;

  const { addItem, setZoneMeta, selectZone } = useRoomTwin.getState();
  const zuid = "z" + Math.random().toString(36).slice(2, 10);

  // Unique name
  let name = zdef.name;
  let n = 2;
  while (isZoneNameTaken(name, zuid)) {
    name = zdef.name + " " + n;
    n++;
  }
  if (name !== zdef.name) setZoneMeta(zuid, { name });

  // Sort so parents come first
  const slots = [...zdef.slots].sort(
    (a, b) => (a.parentSlot ? 1 : 0) - (b.parentSlot ? 1 : 0),
  );
  const slotUidMap: Record<string, string> = {};

  slots.forEach((slot) => {
    const p = PRODUCT_BY_ID.get(slot.productId);
    if (!p) return;

    const params: Params = defaultParamsFor(p);
    const tx = cx + slot.dx;
    const tz = cz + slot.dz;

    let hostUid: string | null = null;
    if (slot.parentSlot && slotUidMap[slot.parentSlot]) {
      hostUid = slotUidMap[slot.parentSlot];
    }

    const uid = "i" + Math.random().toString(36).slice(2, 10);
    const fp = footprintOf(params, 0);
    const c = resolvePlacement(null, snap(tx), snap(tz), fp, hostUid, p.rug);
    const restY = computeRestY(hostUid);

    const item: PlacedItem = {
      uid,
      productId: slot.productId,
      params,
      x: c.x,
      z: c.z,
      rotY: 0,
      parentUid: hostUid,
      restY,
      zoneUid: zuid,
      zoneDefId: zid,
      slotId: slot.slotId,
    };

    addItem(item);
    instantiate(item);
    slotUidMap[slot.slotId] = uid;
  });

  selectZone(zuid);
  return zuid;
}

function isZoneNameTaken(name: string, exclude: string): boolean {
  const { placedItems, zoneMeta } = useRoomTwin.getState();
  const norm = name.trim().toLowerCase();
  const uids = new Set<string>();
  placedItems.forEach((i) => {
    if (i.zoneUid) uids.add(i.zoneUid);
  });
  for (const z of uids) {
    if (z === exclude) continue;
    const m = zoneMeta.get(z);
    if (m && (m.name || "").trim().toLowerCase() === norm) return true;
  }
  return false;
}

function handleZoneDrop(uid: string, x: number, z: number) {
  const nearby = findNearbyZonesAt(x, z).filter(
    (r) => r.dist < ZONE_ATTACH_MAX_DIST,
  );
  if (nearby.length === 0) return;
  if (nearby.length === 1) {
    assignItemToZone(uid, nearby[0].zoneUid);
    return;
  }
  const [first, second] = nearby;
  if (second.dist - first.dist > ZONE_AMBIGUOUS_GAP) {
    assignItemToZone(uid, first.zoneUid);
    return;
  }
  // Ambiguous → เปิด chooser
  useRoomTwin.getState().setPendingZoneChooser(uid);
}