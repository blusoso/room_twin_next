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
import { hitTestZoneBounds } from "@/lib/three/zoneHelpers";
import {
  footprintOf,
  resolvePlacement,
  snap,
  computeRestY,
  applyTransformToDescendants,
  clampToRoom,
} from "@/lib/three/placement";
import {
  resolveWallPlacement,
  wallFootprint,
  wallItemWorldXZ,
} from "@/lib/three/wallPlacement";
import { resolveCeilingPlacement } from "@/lib/three/ceilingPlacement";
import { getWallRotY } from "@/lib/three/roomShell";
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
} from "@/lib/three/interactionState";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { GRID } from "@/lib/data/constants";

const DRAG_THRESHOLD = 8;

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

    const DEBUG = process.env.NODE_ENV === "development";

    // ============================================================
    // POINTER DOWN
    // ============================================================
    const onDown = (e: PointerEvent) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
      const store = useRoomTwin.getState();

      if (store.placingProductId || store.placingZoneId) return;

      // Gizmo handle?
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

      if (DEBUG) {
        console.log("[pointer down]", {
          itemUid,
          zoneAtPoint,
          objectsCount: objectsByUid.size,
        });
      }

      // Zone selected → drag zone
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

      // Click item → item drag ref
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

      // Click zone (no item)
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
      // Zone drag
      if (zoneDragRef.current) {
        const zd = zoneDragRef.current;
        const dx = e.clientX - zd.startX;
        const dy = e.clientY - zd.startY;

        if (!zd.started && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          const sp = raycastFloorPoint(zd.startX, zd.startY);
          if (!sp) return;
          const { placedItems } = useRoomTwin.getState();
          const zi = placedItems.filter((i) => i.zoneUid === zd.zoneUid);
          zd.startFloor = { x: sp.x, z: sp.z };
          zd.startItems = zi.map((i) => ({ uid: i.uid, x: i.x!, z: i.z! }));
          zd.started = true;
          controls.enabled = false;
          setZoneDragging(true);
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
          const sdx = Math.round(dxR / GRID) * GRID;
          const sdz = Math.round(dzR / GRID) * GRID;

          const { placedItems, updateItem } = useRoomTwin.getState();
          const zi = placedItems.filter((i) => i.zoneUid === zd.zoneUid);
          zd.startItems.forEach((si) => {
            const it = zi.find((i) => i.uid === si.uid);
            if (!it) return;
            const fp = footprintOf(it.params, it.rotY || 0);
            const c = clampToRoom(si.x + sdx, si.z + sdz, fp);
            updateItem(it.uid, { x: c.x, z: c.z });
            const obj = objectsByUid.get(it.uid);
            if (obj) {
              obj.position.x = c.x;
              obj.position.z = c.z;
            }
          });
        }
        return;
      }

      // Gizmo drag
      if (isGizmoDragging()) {
        updateGizmoRotateDrag(e.clientX, e.clientY);
        return;
      }

      // Item drag
      if (itemDragRef.current) {
        const id = itemDragRef.current;
        const dx = e.clientX - id.startX;
        const dy = e.clientY - id.startY;

        if (!id.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          id.moved = true;
          controls.enabled = false;
          setItemDragging(true);
          useRoomTwin.getState().closeItemPanel();
          try {
            el.setPointerCapture(id.pointerId);
          } catch {}
          const obj = objectsByUid.get(id.uid);
          const { placedItems } = useRoomTwin.getState();
          const item = placedItems.find((i) => i.uid === id.uid);
          if (obj && item) {
            if (item.ceilingMount) obj.position.y = 4;
            else if (!item.wallMount) obj.position.y = 0.02;
          }
          el.style.cursor = "grabbing";
        }

        if (!id.moved) return;

        const { placedItems, updateItem, room } = useRoomTwin.getState();
        const item = placedItems.find((i) => i.uid === id.uid);
        if (!item) return;

        // Wall item
        if (item.wallMount) {
          const hit = raycastWallPlacement(e.clientX, e.clientY);
          if (!hit) return;
          const product = PRODUCT_BY_ID.get(item.productId);
          if (!product) return;
          const { halfU, halfV } = wallFootprint(item.params, item.rotZ || 0);
          const c = resolveWallPlacement(
            item.uid,
            hit.wallId,
            hit.u,
            hit.v,
            halfU,
            halfV,
            product.groundAnchor || false,
          );
          updateItem(item.uid, {
            wallId: hit.wallId,
            rotY: getWallRotY(hit.wallId),
            u: c.u,
            v: c.v,
          });
          const obj = objectsByUid.get(item.uid);
          if (obj) {
            const w = wallItemWorldXZ({ wallId: hit.wallId, u: c.u });
            obj.position.set(w.x, c.v, w.z);
            obj.rotation.y = getWallRotY(hit.wallId);
          }
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
        const restY = computeRestY(hostUid);
        updateItem(item.uid, {
          x: c.x,
          z: c.z,
          parentUid: hostUid,
          restY,
        });
        const obj = objectsByUid.get(item.uid);
        if (obj) obj.position.set(c.x, restY + 0.02, c.z);
        return;
      }

      // Cursor feedback
      const store = useRoomTwin.getState();
      if (store.placingProductId || store.placingZoneId) {
        el.style.cursor = "crosshair";
        return;
      }
      if (store.selectedUid && hitTestGizmoHandle(e.clientX, e.clientY)) {
        el.style.cursor = "grab";
        return;
      }
      const uid = hitTestPlacedItems(e.clientX, e.clientY);
      if (uid) {
        el.style.cursor = isLocked(uid) ? "not-allowed" : "grab";
        return;
      }
      el.style.cursor = "auto";
    };

    // ============================================================
    // POINTER UP — ⭐ Fix: ถ้า tap (ไม่ drag) → selectItem
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

      // Gizmo drag
      if (isGizmoDragging()) {
        endGizmoRotate(e);
        saveState();
        return;
      }

      // ⭐⭐ ITEM — แก้แล้ว ⭐⭐
      if (itemDragRef.current) {
        const id = itemDragRef.current;
        controls.enabled = true;
        el.style.cursor = "";
        setItemDragging(false);
        try {
          el.releasePointerCapture(id.pointerId);
        } catch {}

        if (id.moved) {
          // ===== ลากจริง =====
          const obj = objectsByUid.get(id.uid);
          const { placedItems } = useRoomTwin.getState();
          const item = placedItems.find((i) => i.uid === id.uid);
          if (obj && item) {
            if (item.ceilingMount) obj.position.y = 4;
            else if (item.wallMount) obj.position.y = item.v!;
            else obj.position.y = item.restY || 0;
          }
          saveState();
          store.selectItem(id.uid);
          if (DEBUG) {
            console.log("[pointer up] drag → selectItem", id.uid);
          }
        } else {
          // ⭐ คลิกเฉยๆ → select (นี่คือ fix!)
          store.selectItem(id.uid);
          if (DEBUG) {
            console.log("[pointer up] tap → selectItem", id.uid);
          }
        }
        itemDragRef.current = null;
        return;
      }

      // Click (moved ตรวจระยะ)
      const moved =
        pointerDownPos.current &&
        (Math.abs(e.clientX - pointerDownPos.current.x) > 6 ||
          Math.abs(e.clientY - pointerDownPos.current.y) > 6);
      if (moved) return;

      // Placing zone
      if (store.placingZoneId) {
        placeZone(store.placingZoneId, e.clientX, e.clientY);
        store.cancelPlacing();
        store.collapseDrawer();
        return;
      }

      // Placing product
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

      // Click empty space
      const uid = hitTestPlacedItems(e.clientX, e.clientY);
      if (DEBUG) {
        console.log("[pointer up]", {
          uid,
          objectsCount: objectsByUid.size,
        });
      }
      if (uid) {
        store.selectItem(uid);
      } else {
        store.closeItemPanel();
        store.deselectZone();
      }
    };

    // Pointer cancel
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
          saveState();
        }
        itemDragRef.current = null;
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
    };
  }, [placeProduct, placeThemedProduct, placeZone, saveState]);
}