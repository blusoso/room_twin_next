// components/viewport/FloatingToolbar.tsx
"use client";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { useRoomTwin } from "@/lib/state/store";
import { camera, renderer, objectsByUid } from "@/lib/three/scene";
import { getZoneBounds } from "@/lib/three/zoneBounds";
import { rotateItemBy90 } from "@/lib/three/gizmo";
import { removeZoneFull } from "@/lib/three/zoneActions";
import {
  removeInstantiated,
  reinstantiateItem,
  instantiate,
} from "@/lib/three/instantiate";
import { resolveRestHeights, footprintOf } from "@/lib/three/placement";
import { rebuildBaseboards } from "@/lib/three/roomShell";
import { PRODUCT_BY_ID, defaultParamsFor } from "@/lib/data/products";
import { openConfirm, openZoneEditDialog } from "@/components/modals";
import { useSaveState } from "@/hooks/useSaveState";
import type { PlacedItem } from "@/lib/state/types";

export default function FloatingToolbar() {
  const [pos, setPos] = useState({ x: 0, y: 0, show: false });
  const [mode, setMode] = useState<"item" | "zone">("item");

  const selectedUid = useRoomTwin((s) => s.selectedUid);
  const selectedZoneUid = useRoomTwin((s) => s.selectedZoneUid);
  const placedItems = useRoomTwin((s) => s.placedItems);
  const setCustomizeTarget = useRoomTwin((s) => s.setCustomizeTarget);
  const setSwapTarget = useRoomTwin((s) => s.setSwapTarget);
  const selectZone = useRoomTwin((s) => s.selectZone);
  const deselectZone = useRoomTwin((s) => s.deselectZone);
  const updateItem = useRoomTwin((s) => s.updateItem);
  const removeItem = useRoomTwin((s) => s.removeItem);
  const closeItemPanel = useRoomTwin((s) => s.closeItemPanel);
  const { saveState } = useSaveState();

  const item = selectedUid
    ? placedItems.find((i) => i.uid === selectedUid)
    : null;

  const zoneMode = !!selectedZoneUid;

  // ===== Position RAF loop =====
  useEffect(() => {
    if (!renderer) return;
    let raf = 0;
    const box = new THREE.Box3();
    const topPoint = new THREE.Vector3();

    const tick = () => {
      if (zoneMode && selectedZoneUid) {
        const b = getZoneBounds(selectedZoneUid);
        if (!b) {
          setPos((p) => (p.show ? { ...p, show: false } : p));
        } else {
          topPoint.set(b.cx, 0.5, b.cz).project(camera);
          if (topPoint.z > 1) {
            setPos((p) => (p.show ? { ...p, show: false } : p));
          } else {
            const rect = renderer.domElement.getBoundingClientRect();
            setPos({
              x: (topPoint.x * 0.5 + 0.5) * rect.width,
              y: (-topPoint.y * 0.5 + 0.5) * rect.height,
              show: true,
            });
          }
        }
        setMode("zone");
        raf = requestAnimationFrame(tick);
        return;
      }

      if (!selectedUid) {
        setPos((p) => (p.show ? { ...p, show: false } : p));
        raf = requestAnimationFrame(tick);
        return;
      }

      const obj = objectsByUid.get(selectedUid);
      if (!obj || !obj.visible) {
        setPos((p) => (p.show ? { ...p, show: false } : p));
        raf = requestAnimationFrame(tick);
        return;
      }

      const it = useRoomTwin
        .getState()
        .placedItems.find((i) => i.uid === selectedUid);
      box.setFromObject(obj);
      const topY = it?.ceilingMount ? box.min.y : box.max.y;

      topPoint.set(
        (box.min.x + box.max.x) / 2,
        topY,
        (box.min.z + box.max.z) / 2,
      );
      topPoint.project(camera);

      if (topPoint.z > 1) {
        setPos((p) => (p.show ? { ...p, show: false } : p));
      } else {
        const rect = renderer.domElement.getBoundingClientRect();
        setPos({
          x: (topPoint.x * 0.5 + 0.5) * rect.width,
          y: (-topPoint.y * 0.5 + 0.5) * rect.height,
          show: true,
        });
      }
      setMode("item");
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selectedUid, selectedZoneUid, zoneMode, placedItems]);

  // ===== Item handlers =====
  const handleRotLeft = () => {
    if (!selectedUid || (item && item.locked)) return;
    const wasDoor = item?.productId === "door";
    rotateItemBy90(selectedUid, -1);
    if (wasDoor) rebuildBaseboards();
    saveState();
  };

  const handleRotRight = () => {
    if (!selectedUid || (item && item.locked)) return;
    const wasDoor = item?.productId === "door";
    rotateItemBy90(selectedUid, 1);
    if (wasDoor) rebuildBaseboards();
    saveState();
  };

  const handleLock = () => {
    if (!item) return;
    updateItem(item.uid, { locked: !item.locked });
    saveState();
  };

  const handleDuplicate = () => {
    if (!item) return;
    duplicateItem(item.uid);
    saveState();
  };

  const handleDelete = () => {
    if (!item) return;
    const wasDoor = item.productId === "door";
    removeInstantiated(item.uid);
    removeItem(item.uid);
    closeItemPanel();
    if (wasDoor) rebuildBaseboards();
    saveState();
  };

  const handleZoneSelect = () => {
    if (!item || !item.zoneUid) return;
    selectZone(item.zoneUid);
  };

  // ===== Zone handlers =====
  const handleZoneRotate = (dir: -1 | 1) => {
    if (!selectedZoneUid) return;
    rotateZone(selectedZoneUid, dir);
    saveState();
  };

  const handleZoneDelete = () => {
    if (!selectedZoneUid) return;
    const zoneItems = placedItems.filter(
      (i) => i.zoneUid === selectedZoneUid,
    );
    const meta = useRoomTwin
      .getState()
      .zoneMeta.get(selectedZoneUid) || {};
    openConfirm(
      `ลบทั้งโซน "${meta.name || "โซน"}" (${zoneItems.length} ชิ้น)?`,
      () => {
        const hasDoor = zoneItems.some((i) => i.productId === "door");
        removeZoneFull(selectedZoneUid);
        closeItemPanel();
        deselectZone();
        if (hasDoor) rebuildBaseboards();
        saveState();
      },
    );
  };

  if (!pos.show) {
    return <div className="floating-toolbar" id="floatingToolbar" />;
  }

  return (
    <div
      className={`floating-toolbar ${
        zoneMode ? "zone-mode" : "item-mode"
      } show`}
      id="floatingToolbar"
      style={{ left: pos.x + "px", top: pos.y + "px" }}
    >
      {/* ===== Item mode ===== */}
      <button
        type="button"
        className="ft-btn item-btn"
        id="ftRotLeft"
        title="หมุนซ้าย 90°"
        onClick={handleRotLeft}
        style={item?.locked ? { display: "none" } : undefined}
      >
        ⟲
      </button>
      <button
        type="button"
        className="ft-btn item-btn"
        id="ftRotRight"
        title="หมุนขวา 90°"
        onClick={handleRotRight}
        style={item?.locked ? { display: "none" } : undefined}
      >
        ⟳
      </button>
      <button
        type="button"
        className={`ft-btn item-btn${item?.locked ? " locked" : ""}`}
        id="ftLock"
        title={item?.locked ? "ปลดล็อก" : "ล็อก"}
        onClick={handleLock}
      >
        {item?.locked ? "🔒" : "🔓"}
      </button>
      <button
        type="button"
        className="ft-btn item-btn customize"
        id="ftCustomize"
        title="ปรับแต่ง"
        onClick={() => selectedUid && setCustomizeTarget(selectedUid)}
      >
        🎨
      </button>
      <button
        type="button"
        className="ft-btn item-btn swap"
        id="ftSwap"
        title="เปลี่ยนสินค้า"
        onClick={() => selectedUid && setSwapTarget(selectedUid)}
      >
        ⇄
      </button>
      <button
        type="button"
        className="ft-btn item-btn"
        id="ftDuplicate"
        title="ทำซ้ำ"
        onClick={handleDuplicate}
      >
        ⧉
      </button>
      {item?.zoneUid && (
        <button
          type="button"
          className="ft-btn item-btn zone-btn"
          id="ftZone"
          title="เลือกทั้งโซน"
          onClick={handleZoneSelect}
        >
          📦
        </button>
      )}
      <button
        type="button"
        className="ft-btn item-btn danger"
        id="ftDelete"
        title="ลบ"
        onClick={handleDelete}
      >
        🗑
      </button>

      {/* ===== Zone mode ===== */}
      <button
        type="button"
        className="ft-btn zone-only theme"
        id="ftZoneTheme"
        title="เลือกธีมโซน"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("roomtwin:openZoneTheme"))
        }
      >
        ✨
      </button>
      <button
        type="button"
        className="ft-btn zone-only"
        id="ftZoneRotLeft"
        title="หมุนทั้งโซนซ้าย 90°"
        onClick={() => handleZoneRotate(-1)}
      >
        ⟲
      </button>
      <button
        type="button"
        className="ft-btn zone-only"
        id="ftZoneRotRight"
        title="หมุนทั้งโซนขวา 90°"
        onClick={() => handleZoneRotate(1)}
      >
        ⟳
      </button>
      <button
        type="button"
        className="ft-btn zone-only"
        id="ftZoneEdit"
        title="แก้ไขโซน"
        onClick={() =>
          selectedZoneUid && openZoneEditDialog(selectedZoneUid)
        }
      >
        ✏️
      </button>
      <button
        type="button"
        className="ft-btn zone-only danger"
        id="ftZoneDelete"
        title="ลบทั้งโซน"
        onClick={handleZoneDelete}
      >
        🗑
      </button>
      <button
        type="button"
        className="ft-btn zone-only"
        id="ftZoneExit"
        title="ปิด"
        onClick={() => deselectZone()}
      >
        ✕
      </button>

      <div className="ft-arrow" />
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function duplicateItem(uid: string) {
  const store = useRoomTwin.getState();
  const item = store.placedItems.find((i) => i.uid === uid);
  if (!item) return;
  const product = PRODUCT_BY_ID.get(item.productId);
  if (!product) return;

  const clonedParams = JSON.parse(JSON.stringify(item.params));
  const newUid = "i" + Math.random().toString(36).slice(2, 10);

  if (item.wallMount) {
    const newItem: PlacedItem = {
      uid: newUid,
      productId: item.productId,
      params: clonedParams,
      wallMount: true,
      wallId: item.wallId,
      u: (item.u || 0) + 0.15,
      v: item.v,
      rotY: item.rotY,
      rotZ: item.rotZ,
      themeOverride: item.themeOverride,
      displayName: item.displayName,
    };
    store.addItem(newItem);
    instantiate(newItem);
    if (item.productId === "door") rebuildBaseboards();
    store.selectItem(newUid);
    return;
  }

  if (item.ceilingMount) {
    const newItem: PlacedItem = {
      uid: newUid,
      productId: item.productId,
      params: clonedParams,
      ceilingMount: true,
      x: (item.x || 0) + 0.3,
      z: (item.z || 0) + 0.3,
      rotY: item.rotY,
      themeOverride: item.themeOverride,
      displayName: item.displayName,
    };
    store.addItem(newItem);
    instantiate(newItem);
    store.selectItem(newUid);
    return;
  }

  const newItem: PlacedItem = {
    uid: newUid,
    productId: item.productId,
    params: clonedParams,
    x: (item.x || 0) + 0.3,
    z: (item.z || 0) + 0.3,
    rotY: item.rotY,
    parentUid: item.parentUid,
    restY: item.restY,
    themeOverride: item.themeOverride,
    displayName: item.displayName,
  };
  store.addItem(newItem);
  instantiate(newItem);
  resolveRestHeights();
  store.selectItem(newUid);
}

// ============================================================
// ⭐ rotateZone — Debug + Fix
// ============================================================

function rotateZone(zuid: string, dir: -1 | 1) {
  const store = useRoomTwin.getState();
  const allItems = store.placedItems;

  // ===== 1. Zone items =====
  const zoneItems = allItems.filter((i) => i.zoneUid === zuid);
  if (zoneItems.length === 0) {
    console.log("[rotateZone] no zone items");
    return;
  }

  // ===== 2. Descendants (recursive) =====
  const groupUids = new Set<string>(zoneItems.map((i) => i.uid));
  let changed = true;
  let iter = 0;
  while (changed && iter < 10) {
    changed = false;
    iter++;
    allItems.forEach((i) => {
      if (
        i.parentUid &&
        groupUids.has(i.parentUid) &&
        !groupUids.has(i.uid)
      ) {
        groupUids.add(i.uid);
        changed = true;
      }
    });
  }

  const itemsToRotate = allItems.filter((i) => groupUids.has(i.uid));
  if (itemsToRotate.length === 0) return;

  // ===== 3. Zone bbox center =====
  const floorItems = itemsToRotate.filter(
    (i) =>
      !i.wallMount &&
      !i.ceilingMount &&
      i.x !== undefined &&
      i.z !== undefined,
  );

  let cx = 0;
  let cz = 0;

  if (floorItems.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    floorItems.forEach((it) => {
      const fp = footprintOf(it.params, it.rotY || 0);
      minX = Math.min(minX, it.x! - fp.w / 2);
      maxX = Math.max(maxX, it.x! + fp.w / 2);
      minZ = Math.min(minZ, it.z! - fp.d / 2);
      maxZ = Math.max(maxZ, it.z! + fp.d / 2);
    });

    cx = (minX + maxX) / 2;
    cz = (minZ + maxZ) / 2;
  } else {
    const ceilItems = itemsToRotate.filter(
      (i) => i.ceilingMount && i.x !== undefined,
    );
    if (ceilItems.length === 0) return;
    ceilItems.forEach((i) => {
      cx += i.x || 0;
      cz += i.z || 0;
    });
    cx /= ceilItems.length;
    cz /= ceilItems.length;
  }

  // ===== 4. ⭐ Rotation Matrix =====
  //
  //  Position (top-down X-right, Z-down view):
  //    ⟳ (dir=1) = CW = (dx, dz) → (-dz, dx)
  //    ⟲ (dir=-1) = CCW = (dx, dz) → (dz, -dx)
  //
  //  Three.js Object rotY (Y-axis up):
  //    ⟳ (CW in top-down view) = rotY -= π/2
  //    ⟲ (CCW) = rotY += π/2
  //
  //  → ใช้ theta_rot = -dir·π/2 สำหรับ rotY

  const thetaRot = -(dir * Math.PI) / 2;
  const cosR = Math.cos(thetaRot);
  const sinR = Math.sin(thetaRot);

  // Position: 2D CW rotation matrix (screen coords X-right, Z-down)
  //   nx = cx + dx·cos(θ) - dz·sin(θ)     ⭐ ใช้ θ = +dir·π/2
  //   nz = cz + dx·sin(θ) + dz·cos(θ)
  const thetaPos = (dir * Math.PI) / 2;
  const cosP = Math.cos(thetaPos);
  const sinP = Math.sin(thetaPos);

  console.log("[rotateZone]", {
    dir: dir === 1 ? "⟳ CW" : "⟲ CCW",
    center: { cx: cx.toFixed(3), cz: cz.toFixed(3) },
    itemCount: itemsToRotate.length,
    thetaPos_deg: ((thetaPos * 180) / Math.PI).toFixed(1),
    thetaRot_deg: ((thetaRot * 180) / Math.PI).toFixed(1),
  });

  // ===== 5. Apply =====
  itemsToRotate.forEach((it) => {
    // Skip wall items
    if (it.wallMount) return;
    if (it.x === undefined || it.z === undefined) return;

    const dx = it.x - cx;
    const dz = it.z - cz;

    // Position
    const nx = cx + dx * cosP - dz * sinP;
    const nz = cz + dx * sinP + dz * cosP;

    // Object rotY
    const nrotY = (it.rotY || 0) + thetaRot;

    if (process.env.NODE_ENV === "development") {
      if (it.zoneUid === zuid) {
        console.log("  ↻", it.productId, {
          before: {
            x: it.x.toFixed(3),
            z: it.z.toFixed(3),
            rotY_deg: (((it.rotY || 0) * 180) / Math.PI).toFixed(1),
          },
          after: {
            x: nx.toFixed(3),
            z: nz.toFixed(3),
            rotY_deg: ((nrotY * 180) / Math.PI).toFixed(1),
          },
        });
      }
    }

    // Update state
    store.updateItem(it.uid, { x: nx, z: nz, rotY: nrotY });

    // ⭐ Force update object immediately (do not wait for effect)
    const obj = objectsByUid.get(it.uid);
    if (obj) {
      obj.position.x = nx;
      obj.position.z = nz;
      obj.rotation.y = nrotY;
    }
  });

  // ===== 6. Re-resolve rest heights =====
  resolveRestHeights();
}