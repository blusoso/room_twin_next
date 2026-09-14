// components/RoomTwinApp.tsx
"use client";
import { useEffect } from "react";
import Header from "./Header";
import { Sidebar } from "./sidebar";
import { Viewport } from "./viewport";
import { CartDrawer } from "./cart";
import { ConfirmModal, ZoneEditModal } from "./modals";
import { useRoomTwinInit } from "@/hooks/useRoomTwinInit";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSaveState } from "@/hooks/useSaveState";
import { useRoomTwin } from "@/lib/state/store";
import { reinstantiateItem, removeInstantiated } from "@/lib/three/instantiate";
import { instantiate } from "@/lib/three/instantiate";
import { resolveRestHeights } from "@/lib/three/placement";
import { rebuildBaseboards, applySurface, rebuildRoomShell } from "@/lib/three/roomShell";
import { relayoutCeilingItemsForObstacles } from "@/lib/three/ceilingPlacement";
import { WALL_COLORS, CELL_SIZE } from "@/lib/data/constants";

export default function RoomTwinApp() {
  useRoomTwinInit();
  useKeyboardShortcuts();

  return (
    <>
      <Header />
      <div className="layout">
        <Sidebar />
        <Viewport />
      </div>
      <CartDrawer />
      <ConfirmModal />
      <ZoneEditModal />
      <div className="rotate-badge" id="rotateBadge">
        0°
      </div>
      <HistoryRestoreListener />
      <ClosePanelsListener />
      <SwapSlotListener />
    </>
  );
}

// ============================================================
// History restore listener (undo/redo)
// ============================================================

function HistoryRestoreListener() {
  useEffect(() => {
    const onRestore = (e: Event) => {
      const snapshot = (e as CustomEvent<string>).detail;
      if (!snapshot) return;
      restoreSnapshot(snapshot);
    };
    window.addEventListener("roomtwin:restore", onRestore);
    return () => {
      window.removeEventListener("roomtwin:restore", onRestore);
    };
  }, []);

  return null;
}

function restoreSnapshot(snapshotJson: string) {
  try {
    const state = JSON.parse(snapshotJson);
    const store = useRoomTwin.getState();

    // 1. ลบ Three.js objects ทั้งหมด
    store.placedItems.forEach((item) => {
      removeInstantiated(item.uid);
    });

    // 2. Restore state
    store.closeItemPanel();
    store.deselectZone();
    store.setCustomizeTarget(null);
    store.setSwapTarget(null);
    store.setPendingZoneChooser(null);

    // Room
    store.setRoom({
      w: state.room?.w ?? 4.2,
      d: state.room?.d ?? 3.6,
      h: state.room?.h ?? 2.6,
      shape: state.room?.shape || "rect",
      cellSize: state.room?.cellSize || CELL_SIZE,
      blocks: state.room?.blocks
        ? new Set(state.room.blocks)
        : null,
    });

    // Surface
    store.setSurface({
      floor: state.surface?.floor ?? "wood",
      wallUniform: state.surface?.wallUniform !== false,
      wallAll: state.surface?.wallAll ?? WALL_COLORS[0],
      walls: state.surface?.walls || {},
      ceiling: state.surface?.ceiling ?? 0xf7f3ea,
    });

    // Wall index
    if (typeof state.wall === "number") {
      store.setCurrentWallIdx(state.wall);
    }

    // Zone meta
    store.zoneMeta = new Map(
      Array.isArray(state.zoneMeta) ? state.zoneMeta : [],
    );

    // Items
    const items = Array.isArray(state.items) ? state.items : [];
    store.replaceItems(items);

    // 3. Rebuild scene
    rebuildRoomShell();
    applySurface();

    // 4. Re-instantiate items
    items.forEach((item: any) => {
      instantiate(item);
    });

    resolveRestHeights();
    relayoutCeilingItemsForObstacles();
    rebuildBaseboards();
  } catch (err) {
    console.error("Failed to restore snapshot:", err);
  }
}

// ============================================================
// Close-panels listener (Escape)
// ============================================================

function ClosePanelsListener() {
  useEffect(() => {
    const onClose = () => {
      const store = useRoomTwin.getState();
      store.setCustomizeTarget(null);
      store.setSwapTarget(null);
      // Dispatch custom events for panels ที่เก็บ state เอง
      window.dispatchEvent(
        new CustomEvent("roomtwin:closeRoomStructure"),
      );
      window.dispatchEvent(
        new CustomEvent("roomtwin:closeZoneTheme"),
      );
      window.dispatchEvent(
        new CustomEvent("roomtwin:closeBlocksEditor"),
      );
    };
    window.addEventListener("roomtwin:closePanels", onClose);
    return () => {
      window.removeEventListener("roomtwin:closePanels", onClose);
    };
  }, []);

  return null;
}

// ============================================================
// Swap slot listener
// ============================================================

function SwapSlotListener() {
  const { saveState } = useSaveState();

  useEffect(() => {
    const onSwap = (e: Event) => {
      const { uid, productId } = (e as CustomEvent<{
        uid: string;
        productId: string;
      }>).detail;

      if (!uid || !productId) return;

      const store = useRoomTwin.getState();
      const item = store.placedItems.find((i) => i.uid === uid);
      if (!item) return;

      // ใช้ helper swap ครบชุด
      import("@/lib/three/zoneActions").then(
        ({ swapZoneSlotFull }) => {
          swapZoneSlotFull(uid, productId);
          saveState();
        },
      );
    };
    window.addEventListener("roomtwin:swapSlot", onSwap);
    return () => {
      window.removeEventListener("roomtwin:swapSlot", onSwap);
    };
  }, [saveState]);

  return null;
}