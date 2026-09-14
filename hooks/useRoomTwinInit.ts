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
import {
  wallFootprint,
  resolveWallPlacement,
} from "@/lib/three/wallPlacement";
import { getWallRotY, getPolyWalls } from "@/lib/three/roomShell";
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
    // ⚠️ ไม่เรียก ensureDefaultOpenings ที่นี่ — Canvas3D effect จะเรียกให้
  }, []);
}

// ============================================================
// ⭐ Ensure default openings — รองรับทั้ง rect และ blocks
// ============================================================

export function ensureDefaultOpenings() {
  const store = useRoomTwin.getState();
  const room = store.room;

  const items = store.placedItems;
  const hasDoor = items.some((i) => i.productId === "door");
  const hasWindow = items.some((i) => i.productId === "window");

  if (room.shape === "rect") {
    if (!hasDoor) seedDoorRect();
    if (!hasWindow) seedWindowRect();
  } else if (room.shape === "blocks") {
    if (!hasDoor) seedDoorBlocks();
    if (!hasWindow) seedWindowBlocks();
  }
}

// ============================================================
// RECT MODE
// ============================================================

function seedDoorRect() {
  const doorP = PRODUCT_BY_ID.get("door");
  if (!doorP) return;

  const store = useRoomTwin.getState();
  const dp = defaultParamsFor(doorP);
  const { halfU, halfV } = wallFootprint(dp, 0);

  const c = resolveWallPlacement(
    null,
    "front",
    -1.35,
    0,
    halfU,
    halfV,
    doorP.groundAnchor || false,
  );

  const uid = "i" + Math.random().toString(36).slice(2, 10);
  store.addItem({
    uid,
    productId: "door",
    params: dp,
    wallMount: true,
    wallId: "front",
    u: c.u,
    v: c.v,
    rotY: getWallRotY("front"),
    rotZ: 0,
  });
}

function seedWindowRect() {
  const winP = PRODUCT_BY_ID.get("window");
  if (!winP) return;

  const store = useRoomTwin.getState();
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
  store.addItem({
    uid,
    productId: "window",
    params: wp,
    wallMount: true,
    wallId: "back",
    u: c.u,
    v: c.v,
    rotY: getWallRotY("back"),
    rotZ: 0,
  });
}

// ============================================================
// ⭐ BLOCKS MODE — หา wall ที่ยาวพอ
// ============================================================

function pickLongestWall(
  minLen: number,
  exclude: string[] = [],
): any | null {
  const walls = getPolyWalls();
  if (!walls || walls.length === 0) return null;

  const candidates = walls
    .filter((w) => w.len >= minLen && !exclude.includes(w.id))
    .sort((a, b) => b.len - a.len);

  return candidates[0] || null;
}

function seedDoorBlocks() {
  const doorP = PRODUCT_BY_ID.get("door");
  if (!doorP) return;

  const dp = defaultParamsFor(doorP);
  const doorWidth = dp.w / 100;
  const { halfU, halfV } = wallFootprint(dp, 0);

  const wall = pickLongestWall(doorWidth + 0.2);
  if (!wall) {
    console.warn(
      "[seedDoorBlocks] no wall long enough for door",
      doorWidth,
    );
    return;
  }

  const c = resolveWallPlacement(
    null,
    wall.id,
    0,
    0,
    halfU,
    halfV,
    doorP.groundAnchor || false,
  );

  const uid = "i" + Math.random().toString(36).slice(2, 10);
  useRoomTwin.getState().addItem({
    uid,
    productId: "door",
    params: dp,
    wallMount: true,
    wallId: wall.id,
    u: c.u,
    v: c.v,
    rotY: wall.rotY,
    rotZ: 0,
  });

  console.log("[seedDoorBlocks] placed door on wall", wall.id);
}

function seedWindowBlocks() {
  const winP = PRODUCT_BY_ID.get("window");
  if (!winP) return;

  const wp = defaultParamsFor(winP);
  const winWidth = wp.w / 100;
  const { halfU, halfV } = wallFootprint(wp, 0);

  const store = useRoomTwin.getState();
  const usedWallIds = store.placedItems
    .filter((i) => i.wallMount && i.wallId)
    .map((i) => i.wallId!);

  let wall = pickLongestWall(winWidth + 0.2, usedWallIds);

  if (!wall) {
    wall = pickLongestWall(winWidth + 0.2);
  }
  if (!wall) {
    console.warn(
      "[seedWindowBlocks] no wall long enough for window",
      winWidth,
    );
    return;
  }

  const c = resolveWallPlacement(
    null,
    wall.id,
    0,
    1.55,
    halfU,
    halfV,
    false,
  );

  const uid = "i" + Math.random().toString(36).slice(2, 10);
  store.addItem({
    uid,
    productId: "window",
    params: wp,
    wallMount: true,
    wallId: wall.id,
    u: c.u,
    v: c.v,
    rotY: wall.rotY,
    rotZ: 0,
  });

  console.log("[seedWindowBlocks] placed window on wall", wall.id);
}

// ============================================================
// Alias
// ============================================================

export function seedDefaultRoom() {
  ensureDefaultOpenings();
}