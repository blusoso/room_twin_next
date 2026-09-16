// hooks/usePointerInteraction.ts
"use client";
import { useEffect, useRef } from "react";
import { renderer, controls, objectsByUid } from "@/lib/three/scene";
import { useRoomTwin } from "@/lib/state/store";
import { usePlacement } from "./usePlacement";
import { useSaveState } from "./useSaveState";
import {
  hitTestPlacedItems,
  raycastPlacement,
  raycastWallPlacement,
  raycastCeilingPlacement,
  raycastFloorPoint,
} from "@/lib/three/raycast";
import {
  hitTestZoneBounds,
} from "@/lib/three/zoneHelpers";
import {
  footprintOf,
  resolvePlacement,
  snap,
  computeRestY,
  applyTransformToDescendants,
  clampToRoom,
  bottomOffsetFor,
  clampZoneDelta,
} from "@/lib/three/placement";
import {
  resolveWallPlacement,
  wallFootprint,
  targetOfItem,
  mountPlane,
  mountPointXZ,
  mountOutwardFor,
} from "@/lib/three/wallPlacement";
import { resolveCeilingPlacement } from "@/lib/three/ceilingPlacement";
import { reclampAttachmentsOf } from "@/lib/three/reclamp";
import { rebuildBaseboards, findFloorYAt, findFloorYAtFootprint } from "@/lib/three/roomShell";
import {
  hitTestGizmoHandle,
  beginGizmoRotate,
  updateGizmoRotateDrag,
  endGizmoRotate,
  isGizmoDragging,
} from "@/lib/three/gizmo";
import {
  setItemDragging,
  setZoneDragging,
  setHoveredZone,
} from "@/lib/three/interactionState";
import {
  PRODUCT_BY_ID,
  isAttachToSurfaceProduct,
} from "@/lib/data/products";
import { GRID } from "@/lib/data/constants";
import type { PlacedItem } from "@/lib/state/types";

const DRAG_THRESHOLD = 8;

// ============================================================
// Helpers
// ============================================================

function collectDescendants(
  placedItems: PlacedItem[],
  roots: string[],
): Set<string> {
  const set = new Set<string>();
  const collect = (uid: string) => {
    if (set.has(uid)) return;
    set.add(uid);
    placedItems.forEach((p) => {
      if (p.parentUid === uid) collect(p.uid);
    });
  };
  roots.forEach((uid) => collect(uid));
  return set;
}

// ============================================================
// Hook
// ============================================================

export function usePointerInteraction() {
  const { placeProduct, placeThemedProduct, placeZone } = usePlacement();
  const { saveState } = useSaveState();

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const itemDragRef = useRef<{
    uid: string;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const zoneDragRef = useRef<{
    zoneUid: string;
    itemUid: string | null;
    pointerId: number;
    startFloor: { x: number; z: number };
    startItems: Array<{ uid: string; x: number; z: number }>;
    startX: number;
    startY: number;
    started: boolean;
    captured: boolean;
  } | null>(null);

  useEffect(() => {
    if (!renderer) return;
    const el = renderer.domElement;

    const isLocked = (uid: string) => {
      const { placedItems } = useRoomTwin.getState();
      const item = placedItems.find((i) => i.uid === uid);
      return !!(item && item.locked);
    };

    // ============================================================
    // POINTER DOWN
    // ============================================================
    const onDown = (e: PointerEvent) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
      const store = useRoomTwin.getState();

      if (store.placingProductId || store.placingZoneId) return;

      // ⭐ โหมด "เปลี่ยนสินค้า" — ล็อกการลาก/ย้าย object ระหว่างเลือกสินค้าแทนที่
      if (store.swapTargetUid) return;

      // Rotate handle?
      if (
        store.selectedUid &&
        !isLocked(store.selectedUid) &&
        hitTestGizmoHandle(e.clientX, e.clientY)
      ) {
        beginGizmoRotate(e);
        return;
      }

      const itemUid = hitTestPlacedItems(e.clientX, e.clientY);
      const zoneAtPoint = hitTestZoneBounds(e.clientX, e.clientY);

      // Zone selected → prep zone drag
      if (store.selectedZoneUid) {
        const it = itemUid
          ? store.placedItems.find((i) => i.uid === itemUid)
          : null;
        const itemInSelZone = it && it.zoneUid === store.selectedZoneUid;
        const emptyInSelZone = zoneAtPoint === store.selectedZoneUid;

        if (itemInSelZone || emptyInSelZone) {
          zoneDragRef.current = {
            zoneUid: store.selectedZoneUid,
            itemUid,
            pointerId: e.pointerId,
            startFloor: { x: 0, z: 0 },
            startItems: [],
            startX: e.clientX,
            startY: e.clientY,
            started: false,
            captured: false,
          };
          e.preventDefault();
          return;
        }
        store.deselectZone();
      }

      if (itemUid && !isLocked(itemUid)) {
        itemDragRef.current = {
          uid: itemUid,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
        };
        e.preventDefault();
        return;
      }

      if (zoneAtPoint) {
        store.selectZone(zoneAtPoint);
        zoneDragRef.current = {
          zoneUid: zoneAtPoint,
          itemUid: null,
          pointerId: e.pointerId,
          startFloor: { x: 0, z: 0 },
          startItems: [],
          startX: e.clientX,
          startY: e.clientY,
          started: false,
          captured: false,
        };
        e.preventDefault();
        return;
      }

      if (store.pendingZoneChooserUid) {
        store.setPendingZoneChooser(null);
        return;
      }
      if (store.selectedUid) store.closeItemPanel();
      if (store.selectedZoneUid) store.deselectZone();
    };

    // ============================================================
    // POINTER MOVE
    // ============================================================
    const onMove = (e: PointerEvent) => {
      // 1. Zone drag
      if (zoneDragRef.current) {
        const zd = zoneDragRef.current;
        const dx = e.clientX - zd.startX;
        const dy = e.clientY - zd.startY;

        if (!zd.started && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          const sp = raycastFloorPoint(zd.startX, zd.startY);
          if (!sp) return;
          const { placedItems } = useRoomTwin.getState();
          const zoneItems = placedItems.filter(
            (i) => i.zoneUid === zd.zoneUid,
          );
          const allUids = collectDescendants(
            placedItems,
            zoneItems.map((i) => i.uid),
          );

          zd.startFloor = { x: sp.x, z: sp.z };
          zd.startItems = Array.from(allUids)
            .map((uid) => {
              const it = placedItems.find((i) => i.uid === uid);
              // ⭐ wall item ไม่มีตำแหน่ง x/z — ไม่ร่วมชุดลาก rigid
              if (!it || it.wallMount) return null;
              return { uid, x: it.x || 0, z: it.z || 0 };
            })
            .filter(
              (s): s is { uid: string; x: number; z: number } => !!s,
            );

          zd.started = true;
          controls.enabled = false;
          setZoneDragging(true, zd.zoneUid);
          setHoveredZone(null);
          try {
            el.setPointerCapture(zd.pointerId);
            zd.captured = true;
          } catch {}
          el.style.cursor = "move";
        }

        if (zd.started) {
          const p = raycastFloorPoint(e.clientX, e.clientY);
          if (!p) return;
          const dxR = p.x - zd.startFloor.x;
          const dzR = p.z - zd.startFloor.z;
          const rawDx = Math.round(dxR / GRID) * GRID;
          const rawDz = Math.round(dzR / GRID) * GRID;
          const { updateItem } = useRoomTwin.getState();
          // ⭐ clamp delta ให้ทั้งโซนยังอยู่ในพื้นที่ห้อง (rect/blocks)
          const { dx: cdx, dz: cdz } = clampZoneDelta(
            zd.startItems,
            rawDx,
            rawDz,
          );
          zd.startItems.forEach((si) => {
            const newX = si.x + cdx;
            const newZ = si.z + cdz;
            updateItem(si.uid, { x: newX, z: newZ });
            const obj = objectsByUid.get(si.uid);
            if (obj) {
              obj.position.x = newX;
              obj.position.z = newZ;
            }
            // ⭐ ของที่แขวนอยู่กับพื้ นผิวของ item นี้ ขยับตามทันที
            reclampAttachmentsOf(si.uid);
          });
        }
        return;
      }

      // 2. Rotate gizmo
      if (isGizmoDragging()) {
        setHoveredZone(null);
        updateGizmoRotateDrag(e.clientX, e.clientY);
        return;
      }

      // 3. Item drag
      if (itemDragRef.current) {
        const id = itemDragRef.current;
        const dx = e.clientX - id.startX;
        const dy = e.clientY - id.startY;

        if (!id.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          id.moved = true;
          controls.enabled = false;
          setItemDragging(true, id.uid);
          setHoveredZone(null);
          useRoomTwin.getState().closeItemPanel();
          try {
            el.setPointerCapture(id.pointerId);
          } catch {}
          const obj = objectsByUid.get(id.uid);
          const { placedItems } = useRoomTwin.getState();
          const item = placedItems.find((i) => i.uid === id.uid);
          if (obj && item) {
            if (item.ceilingMount)
              obj.position.y = useRoomTwin.getState().room.h;
            else if (!item.wallMount)
              obj.position.y = bottomOffsetFor(id.uid) + 0.02;
          }
          el.style.cursor = "grabbing";
        }

        if (!id.moved) return;

        const { placedItems, updateItem, room } = useRoomTwin.getState();
        const item = placedItems.find((i) => i.uid === id.uid);
        if (!item) return;

        // Wall item
        if (item.wallMount) {
          const product = PRODUCT_BY_ID.get(item.productId);
          if (!product) return;
          const hit = raycastWallPlacement(e.clientX, e.clientY, {
            allowHost: isAttachToSurfaceProduct(item.productId),
            excludeUid: item.uid,
          });
          if (!hit) return;
          const { halfU, halfV } = wallFootprint(item.params, item.rotZ || 0);
          const c = resolveWallPlacement(
            item.uid,
            hit.target,
            hit.u,
            hit.v,
            halfU,
            halfV,
            product.groundAnchor || false,
          );
          const plane = mountPlane(hit.target);
          const rotY = plane?.rotY ?? item.rotY ?? 0;

          // ⭐ ย้ายระหว่างพื้ นผิว — ล้าง link เก่าให้หมดก่อนเซ็ต link ใหม่
          const patch: Partial<PlacedItem> = {
            u: c.u,
            v: c.v,
            rotY,
            wallId: undefined,
            mountUid: null,
            mountFace: undefined,
          };
          if (hit.target.kind === "wall") {
            patch.wallId = hit.target.wallId;
          } else {
            patch.mountUid = hit.target.hostUid;
            patch.mountFace = hit.target.face;
          }

          updateItem(item.uid, patch);

          const obj = objectsByUid.get(item.uid);
          if (obj && plane) {
            const w = mountPointXZ(
              plane,
              c.u,
              mountOutwardFor(hit.target, item.params.d),
            );
            obj.position.set(w.x, plane.baseY + c.v, w.z);
            obj.rotation.y = rotY;
          }
          if (product.id === "door") rebuildBaseboards();
          // ⭐ ประตู/หน้าต่างถูกย้ายพื้ นผิว → ของที่แขวนอยู่บนนั้นขยับตาม
          reclampAttachmentsOf(item.uid);
          return;
        }

        // Ceiling item
        if (item.ceilingMount) {
          const hit = raycastCeilingPlacement(e.clientX, e.clientY);
          if (!hit) return;
          const fp = footprintOf(item.params, item.rotY || 0);
          const c = resolveCeilingPlacement(
            item.uid,
            snap(hit.x),
            snap(hit.z),
            fp,
            item.params.h / 100,
          );
          updateItem(item.uid, { x: c.x, z: c.z });
          const obj = objectsByUid.get(item.uid);
          if (obj) obj.position.set(c.x, room.h - 0.04, c.z);
          return;
        }

        // Floor item
        const hit = raycastPlacement(e.clientX, e.clientY, item.uid);
        if (!hit) return;
        const product = PRODUCT_BY_ID.get(item.productId);
        if (!product) return;
        const hostUid = product.rug ? null : hit.hostUid;
        const fp = footprintOf(item.params, item.rotY || 0);
        const c = resolvePlacement(
          item.uid,
          snap(hit.point.x),
          snap(hit.point.z),
          fp,
          hostUid,
          product.rug,
        );
        const ox = item.x!;
        const oz = item.z!;
        applyTransformToDescendants(item.uid, ox, oz, c.x, c.z, 0);
        const restY = hostUid
          ? computeRestY(hostUid)
          : product.rug
            ? findFloorYAt(c.x, c.z)
            : findFloorYAtFootprint(c.x, c.z, fp);
        updateItem(item.uid, {
          x: c.x,
          z: c.z,
          parentUid: hostUid,
          restY,
        });
        const obj = objectsByUid.get(item.uid);
        if (obj)
          obj.position.set(
            c.x,
            restY + 0.02 - bottomOffsetFor(item.uid),
            c.z,
          );
        // ⭐ เสา/ฉากกั้นถูกย้าย → ของที่แขวนอยู่บนพื้ นผิวขยับตาม
        reclampAttachmentsOf(item.uid);
        return;
      }

      // ============================================================
      // Cursor feedback
      // ============================================================
      const store = useRoomTwin.getState();

      if (store.placingProductId || store.placingZoneId) {
        el.style.cursor = "crosshair";
        setHoveredZone(null);
        return;
      }

      if (store.selectedUid && hitTestGizmoHandle(e.clientX, e.clientY)) {
        el.style.cursor = "grab";
        setHoveredZone(null);
        return;
      }

      const itemUid = hitTestPlacedItems(e.clientX, e.clientY);
      if (itemUid) {
        el.style.cursor = isLocked(itemUid) ? "not-allowed" : "grab";
        setHoveredZone(null);
        return;
      }

      const zoneUid = hitTestZoneBounds(e.clientX, e.clientY);
      if (zoneUid) {
        setHoveredZone(zoneUid);
        el.style.cursor = "move";
        return;
      }

      setHoveredZone(null);
      el.style.cursor = "auto";
    };

    // ============================================================
    // POINTER UP
    // ============================================================
    const onUp = (e: PointerEvent) => {
      const store = useRoomTwin.getState();

      // Zone drag
      if (zoneDragRef.current) {
        const zd = zoneDragRef.current;
        const { started, itemUid, zoneUid } = zd;
        if (started) {
          controls.enabled = true;
          el.style.cursor = "";
          setZoneDragging(false);
          try {
            if (zd.captured) el.releasePointerCapture(zd.pointerId);
          } catch {}
          import("@/lib/three/reclamp").then(({ reclampAllToRoom }) => {
            reclampAllToRoom();
          });
          saveState();
        } else {
          try {
            if (zd.captured) el.releasePointerCapture(zd.pointerId);
          } catch {}
          if (itemUid) store.selectItem(itemUid);
          else store.selectZone(zoneUid);
        }
        zoneDragRef.current = null;
        return;
      }

      // Gizmo
      if (isGizmoDragging()) {
        endGizmoRotate(e);
        saveState();
        return;
      }

      // Item drag
      if (itemDragRef.current) {
        const id = itemDragRef.current;
        controls.enabled = true;
        el.style.cursor = "";
        setItemDragging(false);
        try {
          el.releasePointerCapture(id.pointerId);
        } catch {}

        const item = store.placedItems.find((i) => i.uid === id.uid);
        const isDoor = item?.productId === "door";

        if (id.moved) {
          const obj = objectsByUid.get(id.uid);
          const { placedItems } = useRoomTwin.getState();
          const it = placedItems.find((i) => i.uid === id.uid);
          if (obj && it) {
            if (it.ceilingMount) obj.position.y = store.room.h;
            else if (it.wallMount) {
              // ⭐ y = ฐานของพื้ นผิว + v (host ที่อยู่สูงกว่าพื้นต้องไม่ลอยกลับลงมา)
              const target = targetOfItem(it);
              const plane = target ? mountPlane(target) : null;
              obj.position.y = plane ? plane.baseY + (it.v ?? 0) : it.v!;
            } else obj.position.y = (it.restY || 0) - bottomOffsetFor(it.uid);
          }
          saveState();
          store.selectItem(id.uid);
        } else {
          store.selectItem(id.uid);
        }

        if (isDoor) rebuildBaseboards();
        itemDragRef.current = null;
        return;
      }

      // Click
      const moved =
        pointerDownPos.current &&
        (Math.abs(e.clientX - pointerDownPos.current.x) > 6 ||
          Math.abs(e.clientY - pointerDownPos.current.y) > 6);
      if (moved) return;

      if (store.placingZoneId) {
        placeZone(store.placingZoneId, e.clientX, e.clientY);
        store.cancelPlacing();
        store.collapseDrawer();
        return;
      }

      if (store.placingProductId) {
        const pid = store.placingProductId;
        const tid = store.placingThemeId;
        const res = tid
          ? placeThemedProduct(pid, tid, e.clientX, e.clientY)
          : placeProduct(pid, e.clientX, e.clientY);
        if (res.uid) store.selectItem(res.uid);
        store.cancelPlacing();
        store.collapseDrawer();
        return;
      }

      const uid = hitTestPlacedItems(e.clientX, e.clientY);
      if (uid) {
        store.selectItem(uid);
      } else {
        store.closeItemPanel();
        store.deselectZone();
      }
    };

    // Cancel
    const onCancel = () => {
      if (zoneDragRef.current) {
        controls.enabled = true;
        el.style.cursor = "";
        setZoneDragging(false);
        zoneDragRef.current = null;
        return;
      }
      if (isGizmoDragging()) {
        endGizmoRotate();
        return;
      }
      if (itemDragRef.current) {
        if (itemDragRef.current.moved) {
          controls.enabled = true;
          el.style.cursor = "";
          setItemDragging(false);
          const item = useRoomTwin
            .getState()
            .placedItems.find((i) => i.uid === itemDragRef.current!.uid);
          if (item?.productId === "door") rebuildBaseboards();
          saveState();
        }
        itemDragRef.current = null;
      }
    };

    const onPointerLeave = () => {
      setHoveredZone(null);
      el.style.cursor = "auto";
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("pointerleave", onPointerLeave);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("pointerleave", onPointerLeave);
      setHoveredZone(null);
    };
  }, [placeProduct, placeThemedProduct, placeZone, saveState]);
}