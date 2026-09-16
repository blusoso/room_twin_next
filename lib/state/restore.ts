// lib/state/restore.ts
//
// ⭐ แหล่งเดียวของการ "เอา snapshot กลับเข้า store + rebuild Three.js runtime"
//    ใช้ร่วมกัน: undo/redo (roomtwin:restore), เปิดไฟล์ที่เซฟไว้ และเปิดลิงก์แชร์
import { useRoomTwin } from "./store";
import type { SerializedState } from "./types";
import { instantiate, removeInstantiated } from "@/lib/three/instantiate";
import { resolveRestHeights } from "@/lib/three/placement";
import {
  applySurface,
  rebuildBaseboards,
  rebuildRoomShell,
} from "@/lib/three/roomShell";
import { relayoutCeilingItemsForObstacles } from "@/lib/three/ceilingPlacement";
import { WALL_COLORS, CELL_SIZE } from "@/lib/data/constants";

export function restoreSerializedState(state: SerializedState) {
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
    blocks: state.room?.blocks ? new Set(state.room.blocks) : null,
    // ⭐ New: cellLevels
    cellLevels: state.room?.cellLevels || {},
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
}

/** wrapper สำหรับ snapshot ที่เป็น JSON string (undo/redo / reload จาก localStorage) */
export function restoreSnapshot(snapshotJson: string) {
  try {
    const state = JSON.parse(snapshotJson) as SerializedState;
    restoreSerializedState(state);
  } catch (err) {
    console.error("Failed to restore snapshot:", err);
  }
}
