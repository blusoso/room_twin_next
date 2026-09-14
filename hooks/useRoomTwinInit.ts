// hooks/useRoomTwinInit.ts
"use client";
import { useEffect, useRef } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { loadFromStorage } from "@/lib/state/storage";
import {
  ROOM_DEFAULT,
  WALL_COLORS,
  CELL_SIZE,
  WALL_OUTWARD,
} from "@/lib/data/constants";
import {
  wallFootprint,
  resolveWallPlacement,
} from "@/lib/three/wallPlacement";
import {
  getWallRotY,
  getMergedWalls,
  getWallGeom,
  wallPointXZ,
  rebuildBaseboards,
  MergedWall,
} from "@/lib/three/roomShell";
import { objectsByUid, roomGroup } from "@/lib/three/scene";
import { PRODUCT_BY_ID, defaultParamsFor } from "@/lib/data/products";
import type { PlacedItem } from "@/lib/state/types";

let _seedingInProgress = false;

// ============================================================
// Opening Snapshot — เก็บ style + ตำแหน่ง relative
// ============================================================

export interface OpeningSnapshot {
  uid: string;
  productId: string;
  params: any;
  themeOverride?: string;
  displayName?: string | null;
  side: "N" | "S" | "E" | "W";
  relativeU: number;
  v: number;
  rotZ: number;
}

function getSideFromWallId(wallId: string): "N" | "S" | "E" | "W" | null {
  if (wallId === "back") return "N";
  if (wallId === "front") return "S";
  if (wallId === "side") return "W";
  if (wallId === "right") return "E";

  const m = wallId.match(/^bw_(-?\d+)_(-?\d+)_([NSEW])$/);
  if (m) {
    const dir = m[3];
    if (dir === "N") return "N";
    if (dir === "S") return "S";
    if (dir === "E") return "E";
    if (dir === "W") return "W";
  }

  const g = getWallGeom(wallId);
  if (g) {
    if (g.nz > 0.9) return "S";
    if (g.nz < -0.9) return "N";
    if (g.nx > 0.9) return "E";
    if (g.nx < -0.9) return "W";
  }
  return null;
}

function computeRelativeU(item: PlacedItem): number {
  if (!item.wallId) return 0.5;
  const g = getWallGeom(item.wallId);
  if (g && g.len > 0) {
    return (item.u! + g.len / 2) / g.len;
  }
  const cs = useRoomTwin.getState().room.cellSize;
  return (item.u! + cs / 2) / cs;
}

export function captureOpeningsRelative(): OpeningSnapshot[] {
  const store = useRoomTwin.getState();
  const snapshots: OpeningSnapshot[] = [];

  store.placedItems.forEach((item) => {
    if (!item.wallMount) return;
    if (item.productId !== "door" && item.productId !== "window") return;
    if (!item.wallId) return;

    const side = getSideFromWallId(item.wallId);
    if (!side) {
      console.warn("[capture] unknown side for wallId:", item.wallId);
      return;
    }

    snapshots.push({
      uid: item.uid,
      productId: item.productId,
      params: JSON.parse(JSON.stringify(item.params)),
      themeOverride: item.themeOverride,
      displayName: item.displayName,
      side,
      relativeU: computeRelativeU(item),
      v: item.v || 0,
      rotZ: item.rotZ || 0,
    });
  });

  console.log("[capture] captured", snapshots.length, "openings");
  return snapshots;
}

function findBestWallForSide(side: "N" | "S" | "E" | "W"): {
  id: string;
  len: number;
  rotY: number;
} | null {
  const { room } = useRoomTwin.getState();

  if (room.shape === "rect") {
    const wallId =
      side === "N" ? "back"
      : side === "S" ? "front"
      : side === "W" ? "side"
      : "right";
    const g = getWallGeom(wallId);
    if (!g) return null;
    return { id: wallId, len: g.len, rotY: g.rotY };
  }

  const merged = getMergedWalls();
  if (!merged || merged.length === 0) return null;

  const candidates = merged.filter((w) => {
    if (side === "N" && w.nz < -0.9) return true;
    if (side === "S" && w.nz > 0.9) return true;
    if (side === "E" && w.nx > 0.9) return true;
    if (side === "W" && w.nx < -0.9) return true;
    return false;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (Math.abs(b.len - a.len) > 0.01) return b.len - a.len;
    return a.id.localeCompare(b.id);
  });

  return {
    id: candidates[0].id,
    len: candidates[0].len,
    rotY: candidates[0].rotY,
  };
}

/**
 * ⭐ Restore — วางช่องเปิดกลับตาม side + relative position
 * อัปเดตเฉพาะ position ไม่แตะ params/theme
 * เรียก rebuildBaseboards() ที่ท้ายเพื่อให้บัวมีช่องตรงประตู
 */
export function restoreOpeningsRelative(snapshots: OpeningSnapshot[]): void {
  if (snapshots.length === 0) return;

  const store = useRoomTwin.getState();

  snapshots.forEach((snap) => {
    const item = store.placedItems.find((i) => i.uid === snap.uid);
    if (!item) return;

    const wall = findBestWallForSide(snap.side);
    if (!wall) {
      console.warn(
        "[restore] no wall for side",
        snap.side,
        "→ removing",
        snap.uid,
      );
      store.removeItem(snap.uid);
      const obj = objectsByUid.get(snap.uid);
      if (obj) {
        roomGroup.remove(obj);
        objectsByUid.delete(snap.uid);
      }
      return;
    }

    const product = PRODUCT_BY_ID.get(item.productId);
    if (!product) return;

    const newU = snap.relativeU * wall.len - wall.len / 2;

    const { halfU, halfV } = wallFootprint(item.params, item.rotZ || 0);
    const c = resolveWallPlacement(
      item.uid,
      wall.id,
      newU,
      snap.v,
      halfU,
      halfV,
      product.groundAnchor || false,
    );

    // ⭐ updateItem — คง style เดิม (params/themeOverride/displayName ไม่แตะ)
    store.updateItem(item.uid, {
      wallId: wall.id,
      u: c.u,
      v: c.v,
      rotY: wall.rotY,
    });

    // อัปเดต scene object
    const obj = objectsByUid.get(item.uid);
    if (obj) {
      const p = wallPointXZ(wall.id, c.u, WALL_OUTWARD);
      obj.position.set(p.x, c.v, p.z);
      obj.rotation.y = wall.rotY;
    }

    console.log(
      "[restore]",
      snap.uid,
      "→ wall",
      wall.id,
      "u=",
      c.u.toFixed(2),
      "rel=",
      snap.relativeU.toFixed(2),
    );
  });

  // ⭐⭐⭐ Rebuild baseboards หลัง restore เสร็จ
  //       → บัววาดใหม่ โดยมีช่องตรงตำแหน่งประตูที่ restore แล้ว
  rebuildBaseboards();

  console.log(
    "[restore] rebuilt baseboards for",
    snapshots.length,
    "openings",
  );
}

// ============================================================
// useRoomTwinInit
// ============================================================

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
// ensureDefaultOpenings — seed เฉพาะเมื่อไม่มี
// ============================================================

export function ensureDefaultOpenings() {
  if (_seedingInProgress) return;
  _seedingInProgress = true;
  try {
    const store = useRoomTwin.getState();
    const room = store.room;
    if (room.shape !== "rect" && room.shape !== "blocks") return;

    const items = store.placedItems;
    const hasDoor = items.some((i) => i.productId === "door");
    const hasWindow = items.some((i) => i.productId === "window");

    if (hasDoor && hasWindow) return;

    if (room.shape === "rect") {
      if (!hasDoor) seedDoorRect();
      if (!hasWindow) seedWindowRect();
    } else {
      if (!hasDoor) seedDoorBlocks();
      if (!hasWindow) seedWindowBlocks();
    }
  } finally {
    _seedingInProgress = false;
  }
}

// ============================================================
// Seed RECT
// ============================================================

function seedDoorRect() {
  const doorP = PRODUCT_BY_ID.get("door");
  if (!doorP) return;
  const store = useRoomTwin.getState();
  const dp = defaultParamsFor(doorP);
  const { halfU, halfV } = wallFootprint(dp, 0);
  const c = resolveWallPlacement(
    null, "front", -1.35, 0, halfU, halfV,
    doorP.groundAnchor || false,
  );
  const uid = "i" + Math.random().toString(36).slice(2, 10);
  store.addItem({
    uid,
    productId: "door",
    params: dp,
    wallMount: true,
    wallId: "front",
    u: c.u, v: c.v,
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
    null, "back", 1.15, 1.55, halfU, halfV, false,
  );
  const uid = "i" + Math.random().toString(36).slice(2, 10);
  store.addItem({
    uid,
    productId: "window",
    params: wp,
    wallMount: true,
    wallId: "back",
    u: c.u, v: c.v,
    rotY: getWallRotY("back"),
    rotZ: 0,
  });
}

// ============================================================
// Seed BLOCKS
// ============================================================

function pickWallForOpening(
  minLen: number,
  preferredSide: "N" | "S" | "E" | "W",
): MergedWall | null {
  const walls = getMergedWalls();
  if (!walls || walls.length === 0) return null;

  const eligible = walls.filter((w) => w.len >= minLen);
  if (eligible.length === 0) return null;

  const prefScore = (w: MergedWall): number => {
    if (preferredSide === "S" && w.nz > 0.9) return 3;
    if (preferredSide === "N" && w.nz < -0.9) return 3;
    if (preferredSide === "E" && w.nx > 0.9) return 3;
    if (preferredSide === "W" && w.nx < -0.9) return 3;
    return 1;
  };

  eligible.sort((a, b) => {
    const sa = prefScore(a);
    const sb = prefScore(b);
    if (sa !== sb) return sb - sa;
    if (Math.abs(b.len - a.len) > 0.01) return b.len - a.len;
    return a.id.localeCompare(b.id);
  });

  return eligible[0];
}

function seedDoorBlocks() {
  const doorP = PRODUCT_BY_ID.get("door");
  if (!doorP) return;
  const dp = defaultParamsFor(doorP);
  const { halfU, halfV } = wallFootprint(dp, 0);
  const wall = pickWallForOpening(dp.w / 100 + 0.2, "S");
  if (!wall) return;

  const c = resolveWallPlacement(
    null, wall.id, 0, 0, halfU, halfV,
    doorP.groundAnchor || false,
  );
  const uid = "i" + Math.random().toString(36).slice(2, 10);
  useRoomTwin.getState().addItem({
    uid,
    productId: "door",
    params: dp,
    wallMount: true,
    wallId: wall.id,
    u: c.u, v: c.v,
    rotY: wall.rotY,
    rotZ: 0,
  });
}

function seedWindowBlocks() {
  const winP = PRODUCT_BY_ID.get("window");
  if (!winP) return;
  const wp = defaultParamsFor(winP);
  const { halfU, halfV } = wallFootprint(wp, 0);
  const wall = pickWallForOpening(wp.w / 100 + 0.2, "N");
  if (!wall) return;

  const c = resolveWallPlacement(
    null, wall.id, 0, 1.55, halfU, halfV, false,
  );
  const uid = "i" + Math.random().toString(36).slice(2, 10);
  useRoomTwin.getState().addItem({
    uid,
    productId: "window",
    params: wp,
    wallMount: true,
    wallId: wall.id,
    u: c.u, v: c.v,
    rotY: wall.rotY,
    rotZ: 0,
  });
}

export function seedDefaultRoom() {
  ensureDefaultOpenings();
}