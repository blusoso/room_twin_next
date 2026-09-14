// lib/state/store.ts
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  ROOM_DEFAULT,
  WALL_COLORS,
  CELL_SIZE,
} from "@/lib/data/constants";
import type {
  PlacedItem,
  RoomShape,
  SurfaceState,
  ZoneMeta,
  Params,
} from "./types";

const MAX_HISTORY = 60;

export interface RoomTwinState {
  // ===== Room =====
  room: RoomShape;
  setRoom: (patch: Partial<RoomShape>) => void;
  applyRoomSize: (w: number, d: number, h: number) => void;

  // ===== Surface =====
  surface: SurfaceState;
  setSurface: (patch: Partial<SurfaceState>) => void;
  setWallAll: (color: number) => void;

  // ===== Items =====
  placedItems: PlacedItem[];
  addItem: (item: PlacedItem) => void;
  removeItem: (uid: string) => void;
  updateItem: (uid: string, patch: Partial<PlacedItem>) => void;
  replaceItems: (items: PlacedItem[]) => void;
  clearItems: () => void;

  // ===== Zones =====
  removeZone: (zuid: string) => void;
  getZoneItems: (zuid: string) => PlacedItem[];

  // ===== Selection =====
  selectedUid: string | null;
  selectedZoneUid: string | null;
  selectItem: (uid: string | null) => void;
  selectZone: (zuid: string | null) => void;
  deselectZone: () => void;
  closeItemPanel: () => void;

  // ===== Placing =====
  placingProductId: string | null;
  placingThemeId: string | null;
  placingZoneId: string | null;
  startPlacing: (pid: string, theme?: string | null) => void;
  startPlacingZone: (zid: string) => void;
  cancelPlacing: () => void;

  // ===== Zone Meta =====
  zoneMeta: Map<string, ZoneMeta>;
  setZoneMeta: (zuid: string, meta: Partial<ZoneMeta>) => void;
  deleteZoneMeta: (zuid: string) => void;

  // ===== Swap / Customize targets =====
  swapTargetUid: string | null;
  customizeTargetUid: string | null;
  setSwapTarget: (uid: string | null) => void;
  setCustomizeTarget: (uid: string | null) => void;

  // ===== UI Panel =====
  activePanel: "build" | "room";
  setActivePanel: (p: "build" | "room") => void;
  activeCat: string;
  setActiveCat: (c: string) => void;

  // ===== Wall index =====
  currentWallIdx: number;
  setCurrentWallIdx: (i: number) => void;

  // ===== History (undo/redo) =====
  history: string[];
  historyIndex: number;
  pushHistory: (snapshot: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  resetHistory: (snapshot: string) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ===== Cart =====
  cartExcluded: Set<string>;
  toggleCartLine: (pid: string) => void;
  setCartExcluded: (s: Set<string>) => void;
  clearCartExcluded: () => void;

  // ===== Zone Chooser (pending) =====
  pendingZoneChooserUid: string | null;
  setPendingZoneChooser: (uid: string | null) => void;

  // ===== Sidebar =====
  drawerExpanded: boolean;
  toggleDrawer: () => void;
  expandDrawer: () => void;
  collapseDrawer: () => void;

  // ===== Lock badges =====
  showLockBadges: boolean;
  toggleLockBadges: () => void;

  // ===== Whole-state reset =====
  resetAll: () => void;
}

export const useRoomTwin = create<RoomTwinState>()(
  subscribeWithSelector((set, get) => ({
    // ============================================================
    // Room
    // ============================================================
    room: {
      w: ROOM_DEFAULT.w,
      d: ROOM_DEFAULT.d,
      h: ROOM_DEFAULT.h,
      shape: ROOM_DEFAULT.shape,
      blocks: null,
      cellSize: CELL_SIZE,
    },

    setRoom: (patch) =>
      set((s) => ({ room: { ...s.room, ...patch } })),

    applyRoomSize: (w, d, h) =>
      set((s) => ({ room: { ...s.room, w, d, h } })),

    // ============================================================
    // Surface
    // ============================================================
    surface: {
      floor: "wood",
      wallUniform: true,
      wallAll: WALL_COLORS[0],
      walls: {},
      ceiling: 0xf7f3ea,
    },

    setSurface: (patch) =>
      set((s) => ({ surface: { ...s.surface, ...patch } })),

    setWallAll: (color) =>
      set((s) => ({
        surface: { ...s.surface, wallAll: color, wallUniform: true },
      })),

    // ============================================================
    // Items
    // ============================================================
    placedItems: [],

    addItem: (item) =>
      set((s) => ({ placedItems: [...s.placedItems, item] })),

    removeItem: (uid) =>
      set((s) => {
        const removed = s.placedItems.find((i) => i.uid === uid);
        const next = s.placedItems.filter((i) => i.uid !== uid);

        // Orphan children (ที่ parentUid = uid)
        const hasOrphans = next.some((i) => i.parentUid === uid);
        const finalItems = hasOrphans
          ? next.map((i) =>
              i.parentUid === uid ? { ...i, parentUid: null } : i,
            )
          : next;

        return {
          placedItems: finalItems,
          selectedUid:
            s.selectedUid === uid ? null : s.selectedUid,
          customizeTargetUid:
            s.customizeTargetUid === uid
              ? null
              : s.customizeTargetUid,
          swapTargetUid:
            s.swapTargetUid === uid ? null : s.swapTargetUid,
        };
      }),

    updateItem: (uid, patch) =>
      set((s) => ({
        placedItems: s.placedItems.map((i) =>
          i.uid === uid ? { ...i, ...patch } : i,
        ),
      })),

    replaceItems: (items) => set({ placedItems: items }),

    clearItems: () =>
      set({
        placedItems: [],
        selectedUid: null,
        selectedZoneUid: null,
        customizeTargetUid: null,
        swapTargetUid: null,
      }),

    // ============================================================
    // Zones
    // ============================================================
    removeZone: (zuid) =>
      set((s) => {
        // UIDs ที่อยู่ในโซนนี้
        const uidsInZone = new Set(
          s.placedItems
            .filter((i) => i.zoneUid === zuid)
            .map((i) => i.uid),
        );

        // ลบ items ในโซน + orphan children ที่ parent อยู่ในโซนนี้
        const newItems = s.placedItems
          .filter((i) => !uidsInZone.has(i.uid))
          .map((i) =>
            i.parentUid && uidsInZone.has(i.parentUid)
              ? { ...i, parentUid: null }
              : i,
          );

        // ลบ zoneMeta
        const newMeta = new Map(s.zoneMeta);
        newMeta.delete(zuid);

        return {
          placedItems: newItems,
          zoneMeta: newMeta,

          // Clear selections ที่อ้างถึงโซน/items ที่ถูกลบ
          selectedZoneUid:
            s.selectedZoneUid === zuid ? null : s.selectedZoneUid,
          selectedUid:
            s.selectedUid && uidsInZone.has(s.selectedUid)
              ? null
              : s.selectedUid,
          customizeTargetUid:
            s.customizeTargetUid &&
            uidsInZone.has(s.customizeTargetUid)
              ? null
              : s.customizeTargetUid,
          swapTargetUid:
            s.swapTargetUid && uidsInZone.has(s.swapTargetUid)
              ? null
              : s.swapTargetUid,
        };
      }),

    getZoneItems: (zuid) =>
      get().placedItems.filter((i) => i.zoneUid === zuid),

    // ============================================================
    // Selection
    // ============================================================
    selectedUid: null,
    selectedZoneUid: null,

    selectItem: (uid) =>
      set({ selectedUid: uid, selectedZoneUid: null }),

    selectZone: (zuid) =>
      set({ selectedZoneUid: zuid, selectedUid: null }),

    deselectZone: () => set({ selectedZoneUid: null }),

    closeItemPanel: () => set({ selectedUid: null }),

    // ============================================================
    // Placing
    // ============================================================
    placingProductId: null,
    placingThemeId: null,
    placingZoneId: null,

    startPlacing: (pid, theme = null) =>
      set({
        placingProductId: pid,
        placingThemeId: theme,
        placingZoneId: null,
      }),

    startPlacingZone: (zid) =>
      set({
        placingZoneId: zid,
        placingProductId: null,
        placingThemeId: null,
      }),

    cancelPlacing: () =>
      set({
        placingProductId: null,
        placingThemeId: null,
        placingZoneId: null,
      }),

    // ============================================================
    // Zone Meta
    // ============================================================
    zoneMeta: new Map(),

    setZoneMeta: (zuid, meta) =>
      set((s) => {
        const m = new Map(s.zoneMeta);
        m.set(zuid, { ...(m.get(zuid) || {}), ...meta });
        return { zoneMeta: m };
      }),

    deleteZoneMeta: (zuid) =>
      set((s) => {
        const m = new Map(s.zoneMeta);
        m.delete(zuid);
        return { zoneMeta: m };
      }),

    // ============================================================
    // Swap / Customize targets
    // ============================================================
    swapTargetUid: null,
    customizeTargetUid: null,

    setSwapTarget: (uid) => set({ swapTargetUid: uid }),
    setCustomizeTarget: (uid) => set({ customizeTargetUid: uid }),

    // ============================================================
    // UI Panel
    // ============================================================
    activePanel: "build",
    setActivePanel: (p) => set({ activePanel: p }),

    activeCat: "zone",
    setActiveCat: (c) => set({ activeCat: c }),

    // ============================================================
    // Wall index
    // ============================================================
    currentWallIdx: 0,
    setCurrentWallIdx: (i) => set({ currentWallIdx: i }),

    // ============================================================
    // History
    // ============================================================
    history: [],
    historyIndex: -1,

    pushHistory: (snapshot) =>
      set((s) => {
        // ถ้า snapshot เหมือนตัวปัจจุบัน → ไม่ push
        if (
          s.historyIndex >= 0 &&
          s.history[s.historyIndex] === snapshot
        ) {
          return {};
        }
        const h = s.history.slice(0, s.historyIndex + 1);
        h.push(snapshot);
        if (h.length > MAX_HISTORY) h.shift();
        return { history: h, historyIndex: h.length - 1 };
      }),

    undo: () => {
      const s = get();
      if (s.historyIndex <= 0) return null;
      const idx = s.historyIndex - 1;
      set({ historyIndex: idx });
      return s.history[idx];
    },

    redo: () => {
      const s = get();
      if (s.historyIndex >= s.history.length - 1) return null;
      const idx = s.historyIndex + 1;
      set({ historyIndex: idx });
      return s.history[idx];
    },

    resetHistory: (snapshot) =>
      set({ history: [snapshot], historyIndex: 0 }),

    canUndo: () => get().historyIndex > 0,

    canRedo: () => {
      const s = get();
      return s.historyIndex < s.history.length - 1;
    },

    // ============================================================
    // Cart
    // ============================================================
    cartExcluded: new Set(),

    toggleCartLine: (pid) =>
      set((s) => {
        const c = new Set(s.cartExcluded);
        if (c.has(pid)) c.delete(pid);
        else c.add(pid);
        return { cartExcluded: c };
      }),

    setCartExcluded: (sc) => set({ cartExcluded: new Set(sc) }),

    clearCartExcluded: () => set({ cartExcluded: new Set() }),

    // ============================================================
    // Zone Chooser
    // ============================================================
    pendingZoneChooserUid: null,
    setPendingZoneChooser: (uid) =>
      set({ pendingZoneChooserUid: uid }),

    // ============================================================
    // Sidebar
    // ============================================================
    drawerExpanded: false,
    toggleDrawer: () =>
      set((s) => ({ drawerExpanded: !s.drawerExpanded })),
    expandDrawer: () => set({ drawerExpanded: true }),
    collapseDrawer: () => set({ drawerExpanded: false }),

    // ============================================================
    // Lock badges
    // ============================================================
    showLockBadges: true,
    toggleLockBadges: () =>
      set((s) => ({ showLockBadges: !s.showLockBadges })),

    // ============================================================
    // Reset
    // ============================================================
    resetAll: () =>
      set({
        placedItems: [],
        selectedUid: null,
        selectedZoneUid: null,
        zoneMeta: new Map(),
        cartExcluded: new Set(),
        currentWallIdx: 0,
        pendingZoneChooserUid: null,
        swapTargetUid: null,
        customizeTargetUid: null,
        surface: {
          floor: "wood",
          wallUniform: true,
          wallAll: WALL_COLORS[0],
          walls: {},
          ceiling: 0xf7f3ea,
        },
        room: {
          w: ROOM_DEFAULT.w,
          d: ROOM_DEFAULT.d,
          h: ROOM_DEFAULT.h,
          shape: "rect",
          blocks: null,
          cellSize: CELL_SIZE,
        },
        history: [],
        historyIndex: -1,
      }),
  })),
);

// ============================================================
// Selectors (convenience)
// ============================================================

export const selectSelectedItem = (s: RoomTwinState) => {
  if (!s.selectedUid) return null;
  return s.placedItems.find((i) => i.uid === s.selectedUid) || null;
};

export const selectActiveItems = (s: RoomTwinState) =>
  s.placedItems.filter((i) => !s.cartExcluded.has(i.productId));

export const selectOpenings = (s: RoomTwinState) =>
  s.placedItems.filter(
    (i) =>
      i.wallMount &&
      (i.productId === "door" || i.productId === "window"),
  );

export const selectZoneUids = (s: RoomTwinState) => {
  const set = new Set<string>();
  s.placedItems.forEach((i) => {
    if (i.zoneUid) set.add(i.zoneUid);
  });
  return set;
};

export const selectZoneItems = (zuid: string) => (s: RoomTwinState) =>
  s.placedItems.filter((i) => i.zoneUid === zuid);