// hooks/useRoomTwinInit.ts
"use client";
import { useEffect, useRef } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { loadFromStorage, saveToStorage } from "@/lib/state/storage";
import { ROOM_DEFAULT, WALL_COLORS, CELL_SIZE } from "@/lib/data/constants";
import { initRoomShell, rebuildBaseboards } from "@/lib/three/roomShell";
import { instantiate } from "@/lib/three/instantiate";
import { resolveRestHeights } from "@/lib/three/placement";
import type { SerializedState } from "@/lib/state/types";

export function useRoomTwinInit() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const {
      setRoom,
      setSurface,
      replaceItems,
      setCurrentWallIdx,
      resetHistory,
      addItem,
      setZoneMeta,
    } = useRoomTwin.getState();

    const state = loadFromStorage();

    if (state) {
      // ===== Room =====
      setRoom({
        w: state.room?.w ?? ROOM_DEFAULT.w,
        d: state.room?.d ?? ROOM_DEFAULT.d,
        h: state.room?.h ?? ROOM_DEFAULT.h,
        shape: state.room?.shape || "rect",
        cellSize: state.room?.cellSize || CELL_SIZE,
        blocks: state.room?.blocks ? new Set(state.room.blocks) : null,
      });

      // ===== Surface =====
      setSurface({
        floor: state.surface?.floor ?? "wood",
        wallUniform: state.surface?.wallUniform !== false,
        wallAll: state.surface?.wallAll ?? WALL_COLORS[state.wall ?? 0],
        walls: state.surface?.walls || {},
        ceiling: state.surface?.ceiling ?? 0xf7f3ea,
      });

      // ===== Wall index =====
      if (typeof state.wall === "number") setCurrentWallIdx(state.wall);

      // ===== Zone meta =====
      if (Array.isArray(state.zoneMeta)) {
        state.zoneMeta.forEach(([zuid, meta]) => setZoneMeta(zuid, meta));
      }

      // ===== Items =====
      if (Array.isArray(state.items) && state.items.length > 0) {
        replaceItems(state.items);
        // Instantiate หลัง initShell ด้านล่าง
      }
    } else {
      // Default room
      setRoom({
        w: ROOM_DEFAULT.w,
        d: ROOM_DEFAULT.d,
        h: ROOM_DEFAULT.h,
        shape: "rect",
        cellSize: CELL_SIZE,
        blocks: null,
      });
      setSurface({
        floor: "wood",
        wallUniform: true,
        wallAll: WALL_COLORS[0],
        walls: {},
        ceiling: 0xf7f3ea,
      });
    }

    // ===== Init Three.js shell (ต้องเรียกหลัง setRoom/setSurface) =====
    initRoomShell();

    // ===== Instantiate items =====
    const items = useRoomTwin.getState().placedItems;
    if (items.length === 0) {
      // Seed default door + window
      seedDefaultRoom();
    } else {
      items.forEach((item) => {
        instantiate(item);
      });
      resolveRestHeights();
    }

    rebuildBaseboards();

    // ===== History =====
    const snapshot = JSON.stringify({
      wall: useRoomTwin.getState().currentWallIdx,
      items: useRoomTwin.getState().placedItems,
      zoneMeta: [...useRoomTwin.getState().zoneMeta.entries()],
      surface: useRoomTwin.getState().surface,
      room: {
        ...useRoomTwin.getState().room,
        blocks: useRoomTwin.getState().room.blocks
          ? [...useRoomTwin.getState().room.blocks!]
          : null,
      },
    });
    resetHistory(snapshot);
  }, []);
}

// ===== Seed default room (door + window) =====
function seedDefaultRoom() {
  const { addItem } = useRoomTwin.getState();
  const room = useRoomTwin.getState().room;

  if (room.shape !== "rect") return;

  // Door on front wall
  const doorUid = "i" + Math.random().toString(36).slice(2, 10);
  addItem({
    uid: doorUid,
    productId: "door",
    params: {
      w: 95, d: 6, h: 205, color: 0xc9a776,
      frameColor: 0xf7f3ea,
    },
    wallMount: true,
    wallId: "front",
    u: -1.35,
    v: 0.03,
    rotY: Math.PI,
    rotZ: 0,
  });
  instantiate(useRoomTwin.getState().placedItems.find((i) => i.uid === doorUid)!);

  // Window on back wall
  const winUid = "i" + Math.random().toString(36).slice(2, 10);
  addItem({
    uid: winUid,
    productId: "window",
    params: {
      w: 110, d: 6, h: 130, color: 0xcfe0e8,
      frameColor: 0xf7f3ea,
      glassColor: 0xcfe0e8,
      hasCurtains: false,
      curtainColor: 0xd8b7ae,
    },
    wallMount: true,
    wallId: "back",
    u: 1.15,
    v: 1.55,
    rotY: 0,
    rotZ: 0,
  });
  instantiate(useRoomTwin.getState().placedItems.find((i) => i.uid === winUid)!);
}