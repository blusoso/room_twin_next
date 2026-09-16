// hooks/usePlacement.ts
"use client";
import { useCallback } from "react";
import { useRoomTwin } from "@/lib/state/store";
import {
  PRODUCT_BY_ID,
  defaultParamsFor,
  isAutoZoneExcludedProduct,
  isAttachToSurfaceProduct,
} from "@/lib/data/products";
import { ZONE_BY_ID } from "@/lib/data/zones";
import { pickUniqueZoneName } from "@/lib/data/zoneResolve";
import { applyThemeToItem } from "@/lib/three/themeApply";
import {
  footprintOf,
  resolvePlacement,
  snap,
  snapFloorPosition,
  computeRestY,
  resolveRestHeights,
} from "@/lib/three/placement";
import {
  resolveWallPlacement,
  wallFootprint,
  mountPlane,
  type MountTarget,
} from "@/lib/three/wallPlacement";
import { resolveCeilingPlacement } from "@/lib/three/ceilingPlacement";
import {
  raycastPlacement,
  raycastWallPlacement,
  raycastCeilingPlacement,
} from "@/lib/three/raycast";
import { instantiate, reinstantiateItem } from "@/lib/three/instantiate";
import { rebuildBaseboards, getWallRotY, findFloorYAt, findFloorYAtFootprint } from "@/lib/three/roomShell";
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
        const hit = raycastWallPlacement(cx, cy, {
          allowHost: isAttachToSurfaceProduct(pid),
        });
        if (!hit) {
          showToast(
            `วาง "${p.name}" ไม่สำเร็จ — ต้องแขวนบนผนัง/เสา/ฉากกั้น/ประตู/หน้าต่างที่มองเห็น`,
          );
          return { uid: null, error: "no-wall" };
        }
        const uid = addWallItem(pid, hit.target, hit.u, hit.v);
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
        const hit = raycastWallPlacement(cx, cy, {
          allowHost: isAttachToSurfaceProduct(pid),
        });
        if (!hit) {
          showToast(
            `วาง "${p.name}" ไม่สำเร็จ — ต้องแขวนบนผนัง/เสา/ฉากกั้น/ประตู/หน้าต่างที่มองเห็น`,
          );
          return { uid: null, error: "no-wall" };
        }
        const uid = addWallItem(pid, hit.target, hit.u, hit.v);
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
  // ⭐ พรมวางอิสระ (ไม่ snap 10 ซม.) — ของอื่นยัง snap ตาม GRID
  const pos = snapFloorPosition(p, x, z);
  const c = resolvePlacement(null, pos.x, pos.z, fp, host, p.rug);
  const restY = host
    ? computeRestY(host)
    : p.rug
      ? findFloorYAt(c.x, c.z)
      : findFloorYAtFootprint(c.x, c.z, fp);

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
  target: MountTarget,
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
    target,
    u,
    v,
    halfU,
    halfV,
    p.groundAnchor || false,
  );

  const plane = mountPlane(target);
  const rotY =
    plane?.rotY ??
    (target.kind === "wall" ? getWallRotY(target.wallId) : 0);

  const uid = "i" + Math.random().toString(36).slice(2, 10);
  const item: PlacedItem = {
    uid,
    productId: pid,
    params,
    wallMount: true,
    u: c.u,
    v: c.v,
    rotY,
    rotZ: 0,
  };

  // ⭐ ผนังห้อง → wallId / ไอเทม → mountUid + mountFace
  if (target.kind === "wall") {
    item.wallId = target.wallId;
  } else {
    item.mountUid = target.hostUid;
    item.mountFace = target.face;
  }

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

  // ⭐ ชื่อไม่ซ้ำ — เทียบกับชื่อที่ resolve แล้ว (definition/override) ของโซนที่มีอยู่
  //    ส่วน icon/color ไม่ copy ลง zoneMeta: ปล่อยให้ derive จาก ZoneDef ผ่าน resolver
  const name = pickUniqueZoneName(zdef.name, zuid);
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
    // ⭐ ใช้กติกาเดียวกัน: พรม (ถ้ามีใน slot) ไม่ snap
    const slotPos = snapFloorPosition(p, tx, tz);
    const c = resolvePlacement(
      null,
      slotPos.x,
      slotPos.z,
      fp,
      hostUid,
      p.rug,
    );
    const restY = hostUid
      ? computeRestY(hostUid)
      : p.rug
        ? findFloorYAt(c.x, c.z)
        : findFloorYAtFootprint(c.x, c.z, fp);

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

function handleZoneDrop(uid: string, x: number, z: number) {
  const { placedItems } = useRoomTwin.getState();
  const item = placedItems.find((i) => i.uid === uid);
  // ⭐ โครงสร้าง/ม่าน & แอร์ (เสา ฉาก ประตู แอร์ ฯลฯ) ห้ามเข้าโซนอัตโนมัติ
  //    — ไม่ auto-assign และไม่เด้ง ZoneChooser
  if (!item || isAutoZoneExcludedProduct(item.productId)) return;

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