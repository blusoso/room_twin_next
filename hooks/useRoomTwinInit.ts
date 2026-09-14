// hooks/useRoomTwinInit.ts
"use client";
import { useEffect, useRef } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { loadFromStorage } from "@/lib/state/storage";
import {
  ROOM_DEFAULT,
  WALL_COLORS,
  CELL_SIZE,
} from "@/lib/data/constants";
import { instantiate } from "@/lib/three/instantiate";
import {
  wallFootprint,
  resolveWallPlacement,
} from "@/lib/three/wallPlacement";
import { getWallRotY } from "@/lib/three/roomShell";
import { PRODUCT_BY_ID, defaultParamsFor } from "@/lib/data/products";

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
      setZoneMeta,
    } = useRoomTwin.getState();

    const state = loadFromStorage();

    if (state) {
      setRoom({
        w: state.room?.w ?? ROOM_DEFAULT.w,
        d: state.room?.d ?? ROOM_DEFAULT.d,
        h: state.room?.h ?? ROOM_DEFAULT.h,
        shape: state.room?.shape || "rect",
        cellSize: state.room?.cellSize || CELL_SIZE,
        blocks: state.room?.blocks ? new Set(state.room.blocks) : null,
      });

      setSurface({
        floor: state.surface?.floor ?? "wood",
        wallUniform: state.surface?.wallUniform !== false,
        wallAll: state.surface?.wallAll ?? WALL_COLORS[state.wall ?? 0],
        walls: state.surface?.walls || {},
        ceiling: state.surface?.ceiling ?? 0xf7f3ea,
      });

      if (typeof state.wall === "number") setCurrentWallIdx(state.wall);

      if (Array.isArray(state.zoneMeta)) {
        state.zoneMeta.forEach(([zuid, meta]) => setZoneMeta(zuid, meta));
      }

      if (Array.isArray(state.items) && state.items.length > 0) {
        replaceItems(state.items);
      }
    } else {
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

    // ⭐ ถ้าไม่มี items → seed default door/window
    const items = useRoomTwin.getState().placedItems;
    if (items.length === 0) {
      seedDefaultRoom();
    }

    // History snapshot
    const s = useRoomTwin.getState();
    const snapshot = JSON.stringify({
      wall: s.currentWallIdx,
      items: s.placedItems,
      zoneMeta: [...s.zoneMeta.entries()],
      surface: s.surface,
      room: {
        ...s.room,
        blocks: s.room.blocks ? [...s.room.blocks] : null,
      },
    });
    resetHistory(snapshot);
  }, []);
}

// ============================================================
// Seed default room — ประตูหน้าผนังหลัง, หน้าต่างผนังหลัง
// ⭐ export เพื่อให้ Header เรียกตอน reset ได้
// ============================================================

export function seedDefaultRoom() {
  const store = useRoomTwin.getState();
  const room = store.room;
  if (room.shape !== "rect") return;

  // ===== Door (front wall, ground anchor) =====
  const doorP = PRODUCT_BY_ID.get("door");
  if (doorP) {
    const dp = defaultParamsFor(doorP);
    const { halfU, halfV } = wallFootprint(dp, 0);
    const c = resolveWallPlacement(
      null,
      "front",
      -1.35,
      0,                              // ⭐ v = 0 (ground anchor)
      halfU,
      halfV,
      doorP.groundAnchor || false,
    );
    const uid = "i" + Math.random().toString(36).slice(2, 10);
    const item = {
      uid,
      productId: "door",
      params: dp,
      wallMount: true,
      wallId: "front",
      u: c.u,
      v: c.v,
      rotY: getWallRotY("front"),
      rotZ: 0,
    };
    store.addItem(item);
    instantiate(item);
  }

  // ===== Window (back wall) =====
  const winP = PRODUCT_BY_ID.get("window");
  if (winP) {
    const wp = defaultParamsFor(winP);
    const { halfU, halfV } = wallFootprint(wp, 0);
    const c = resolveWallPlacement(
      null,
      "back",
      1.15,
      1.55,
      halfU,
      halfV,
      false,
    );
    const uid = "i" + Math.random().toString(36).slice(2, 10);
    const item = {
      uid,
      productId: "window",
      params: wp,
      wallMount: true,
      wallId: "back",
      u: c.u,
      v: c.v,
      rotY: getWallRotY("back"),
      rotZ: 0,
    };
    store.addItem(item);
    instantiate(item);
  }
}