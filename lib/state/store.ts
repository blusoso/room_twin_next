// lib/state/store.ts
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  ROOM_DEFAULT,
  WALL_COLORS,
  CELL_SIZE,
} from "@/lib/data/constants";
import {
  markOpeningRemoved,
  clearOpeningRemoved,
} from "./openingFlags";
import {
  makeDefaultCatalogFilters,
  type CatalogFilters,
} from "@/lib/data/productSearch";
import type {
  PlacedItem,
  RoomShape,
  SurfaceState,
  ZoneMeta,
} from "./types";

const MAX_HISTORY = 60;

export interface RoomTwinState {
  room: RoomShape;
  setRoom: (patch: Partial<RoomShape>) => void;
  applyRoomSize: (w: number, d: number, h: number) => void;

  // ⭐ Cell levels
  getCellLevel: (i: number, j: number) => number;
  setCellLevel: (i: number, j: number, y: number) => void;
  setManyCellLevels: (
    entries: Array<{ key: string; y: number }>,
  ) => void;

  surface: SurfaceState;
  setSurface: (patch: Partial<SurfaceState>) => void;
  setWallAll: (color: number) => void;

  placedItems: PlacedItem[];
  addItem: (item: PlacedItem) => void;
  removeItem: (uid: string) => void;
  updateItem: (uid: string, patch: Partial<PlacedItem>) => void;
  replaceItems: (items: PlacedItem[]) => void;
  clearItems: () => void;

  removeZone: (zuid: string) => void;
  getZoneItems: (zuid: string) => PlacedItem[];

  selectedUid: string | null;
  selectedZoneUid: string | null;
  selectItem: (uid: string | null) => void;
  selectZone: (zuid: string | null) => void;
  deselectZone: () => void;
  closeItemPanel: () => void;

  placingProductId: string | null;
  placingThemeId: string | null;
  placingZoneId: string | null;
  startPlacing: (pid: string, theme?: string | null) => void;
  startPlacingZone: (zid: string) => void;
  cancelPlacing: () => void;

  zoneMeta: Map<string, ZoneMeta>;
  setZoneMeta: (zuid: string, meta: Partial<ZoneMeta>) => void;
  deleteZoneMeta: (zuid: string) => void;

  swapTargetUid: string | null;
  customizeTargetUid: string | null;
  setSwapTarget: (uid: string | null) => void;
  setCustomizeTarget: (uid: string | null) => void;

  activePanel: "build" | "room";
  setActivePanel: (p: "build" | "room") => void;
  activeCat: string;
  setActiveCat: (c: string) => void;

  // ⭐ ค้นหา/กรองสินค้าในแคตตาล็อก — transient ล้วน
  //    ไม่เข้า serialize/history/localStorage และไม่กระทบ undo/redo
  catalogQuery: string;
  catalogFilters: CatalogFilters;
  catalogSearchFocusNonce: number;
  /** ⭐ สถานะเปิด/ปิด floating filter panel (ข้าง sidebar) — transient */
  catalogFiltersOpen: boolean;
  setCatalogQuery: (q: string) => void;
  setCatalogFilters: (patch: Partial<CatalogFilters>) => void;
  /** ล้างทั้งคำค้นและตัวกรอง (ใช้กับปุ่ม "ล้างการค้นหา" และ Escape ในช่องค้นหา) */
  clearCatalogSearch: () => void;
  /** ขอโฟกัสช่องค้นหา (nonce — ใช้จาก keyboard shortcut ที่อยู่คนละ component) */
  requestCatalogSearchFocus: () => void;
  setCatalogFiltersOpen: (open: boolean) => void;
  toggleCatalogFilters: () => void;

  currentWallIdx: number;
  setCurrentWallIdx: (i: number) => void;

  history: string[];
  historyIndex: number;
  pushHistory: (snapshot: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  resetHistory: (snapshot: string) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  cartExcluded: Set<string>;
  toggleCartLine: (pid: string) => void;
  setCartExcluded: (s: Set<string>) => void;
  clearCartExcluded: () => void;

  pendingZoneChooserUid: string | null;
  setPendingZoneChooser: (uid: string | null) => void;

  drawerExpanded: boolean;
  toggleDrawer: () => void;
  expandDrawer: () => void;
  collapseDrawer: () => void;

  showLockBadges: boolean;
  toggleLockBadges: () => void;

  // ⭐ โหมด "ผนังรอบด้าน" — แสดงผนังทุกด้านพร้อมกัน (ปิดการซ่อนผนังอัตโนมัติ)
  //    เป็น view preference ชั่วคราว (ไม่เข้า serialize/history) แต่ persist แยก key
  showAllWalls: boolean;
  setShowAllWalls: (v: boolean) => void;
  toggleAllWalls: () => void;

  // ⭐ สถานะเปิด/ปิด Blocks Editor (transient — ไม่เข้า serialize/history)
  blocksEditorOpen: boolean;
  setBlocksEditorOpen: (open: boolean) => void;

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
      cellLevels: {},
    },

    setRoom: (patch) => set((s) => ({ room: { ...s.room, ...patch } })),

    applyRoomSize: (w, d, h) =>
      set((s) => ({ room: { ...s.room, w, d, h } })),

    // ============================================================
    // Cell Levels
    // ============================================================
    getCellLevel: (i, j) => {
      const key = `${i},${j}`;
      return get().room.cellLevels[key] ?? 0;
    },

    setCellLevel: (i, j, y) => {
      const key = `${i},${j}`;
      set((s) => {
        const next = { ...s.room.cellLevels };
        if (y === 0) delete next[key];
        else next[key] = y;
        return { room: { ...s.room, cellLevels: next } };
      });
    },

    setManyCellLevels: (entries) => {
      set((s) => {
        const next = { ...s.room.cellLevels };
        entries.forEach(({ key, y }) => {
          if (y === 0) delete next[key];
          else next[key] = y;
        });
        return { room: { ...s.room, cellLevels: next } };
      });
    },

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
      set((s) => {
        if (item.productId === "door" || item.productId === "window") {
          clearOpeningRemoved(item.productId);
        }
        return { placedItems: [...s.placedItems, item] };
      }),

    removeItem: (uid) =>
      set((s) => {
        const removed = s.placedItems.find((i) => i.uid === uid);

        if (
          removed &&
          (removed.productId === "door" ||
            removed.productId === "window")
        ) {
          markOpeningRemoved(removed.productId);
        }

        const next = s.placedItems.filter((i) => i.uid !== uid);
        const hasOrphans = next.some((i) => i.parentUid === uid);
        const finalItems = hasOrphans
          ? next.map((i) =>
              i.parentUid === uid ? { ...i, parentUid: null } : i,
            )
          : next;

        return {
          placedItems: finalItems,
          selectedUid: s.selectedUid === uid ? null : s.selectedUid,
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
        const uidsInZone = new Set(
          s.placedItems
            .filter((i) => i.zoneUid === zuid)
            .map((i) => i.uid),
        );

        // ⭐ ของที่แขวนอยู่กับพื้ นผิวของ item ที่อยู่ในโซน ต้องถูกลบไปด้วยทั้งชุด
        let grew = true;
        while (grew) {
          grew = false;
          s.placedItems.forEach((i) => {
            if (
              i.mountUid &&
              uidsInZone.has(i.mountUid) &&
              !uidsInZone.has(i.uid)
            ) {
              uidsInZone.add(i.uid);
              grew = true;
            }
          });
        }

        s.placedItems.forEach((it) => {
          if (!uidsInZone.has(it.uid)) return;
          if (it.productId === "door" || it.productId === "window") {
            markOpeningRemoved(it.productId);
          }
        });

        const newItems = s.placedItems
          .filter((i) => !uidsInZone.has(i.uid))
          .map((i) =>
            i.parentUid && uidsInZone.has(i.parentUid)
              ? { ...i, parentUid: null }
              : i,
          );

        const newMeta = new Map(s.zoneMeta);
        newMeta.delete(zuid);

        return {
          placedItems: newItems,
          zoneMeta: newMeta,
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
    // Selection / Placing / Zone meta / Swap / UI (เหมือนเดิม)
    // ============================================================
    selectedUid: null,
    selectedZoneUid: null,

    // ⭐ เลือก object อื่น = ออกจากโหมด "เปลี่ยนสินค้า" ของ object เดิม
    //    (คลิก object เดิมซ้ำไม่หลุดโหมด)
    selectItem: (uid) =>
      set((s) => ({
        selectedUid: uid,
        selectedZoneUid: null,
        swapTargetUid: s.swapTargetUid === uid ? s.swapTargetUid : null,
      })),

    selectZone: (zuid) =>
      set({
        selectedZoneUid: zuid,
        selectedUid: null,
        swapTargetUid: null,
      }),

    // ⭐ ย้ายบริบทไปโซน = ออกจากโหมด "เปลี่ยนสินค้า" (object ที่เปลี่ยนค้างอยู่)
    deselectZone: () =>
      set({
        selectedZoneUid: null,
        swapTargetUid: null,
      }),
    // ⭐ ปิด item panel = ออกจากโหมด "เปลี่ยนสินค้า" ด้วย
    closeItemPanel: () =>
      set({ selectedUid: null, swapTargetUid: null }),

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

    zoneMeta: new Map(),

    setZoneMeta: (zuid, meta) =>
      set((s) => {
        const m = new Map(s.zoneMeta);
        const next = { ...(m.get(zuid) || {}), ...meta };
        // ⭐ ไม่มีข้อมูลเหลือเลย → ลบ entry (ไม่เก็บ definition ซ้ำเป็น entry เปล่า)
        const isEmpty = Object.values(next).every((v) => v === undefined);
        if (isEmpty) m.delete(zuid);
        else m.set(zuid, next);
        return { zoneMeta: m };
      }),

    deleteZoneMeta: (zuid) =>
      set((s) => {
        const m = new Map(s.zoneMeta);
        m.delete(zuid);
        return { zoneMeta: m };
      }),

    swapTargetUid: null,
    customizeTargetUid: null,

    // ⭐ เข้าโหมด "เปลี่ยนสินค้า" — เป็น transient UI ล้วน ๆ (ไม่เข้า serialize/history)
    //    เคลียร์โหมด placing/ปรับแต่งที่ค้างอยู่ + พา sidebar ไปแท็บ "สร้างห้อง" ให้เห็น catalog
    setSwapTarget: (uid) =>
      set(
        uid
          ? {
              swapTargetUid: uid,
              customizeTargetUid: null,
              placingProductId: null,
              placingThemeId: null,
              placingZoneId: null,
              activePanel: "build" as const,
            }
          : { swapTargetUid: null },
      ),

    setCustomizeTarget: (uid) =>
      set({ customizeTargetUid: uid }),

    activePanel: "build",
    // ⭐ ออกจากแท็บ "สร้างห้อง" → ปิด floating filter panel ด้วย
    //    (กันแผงโผล่ซ้ำแบบไม่คาดคิดเมื่อกลับมา)
    setActivePanel: (p) =>
      set(
        p === "room"
          ? { activePanel: p, catalogFiltersOpen: false }
          : { activePanel: p },
      ),

    activeCat: "zone",
    setActiveCat: (c) => set({ activeCat: c }),

    // ============================================================
    // Catalog search (transient — ไม่เข้า serialize/history)
    // ============================================================
    catalogQuery: "",
    catalogFilters: makeDefaultCatalogFilters(),
    catalogSearchFocusNonce: 0,

    setCatalogQuery: (q) => set({ catalogQuery: q }),

    setCatalogFilters: (patch) =>
      set((s) => ({ catalogFilters: { ...s.catalogFilters, ...patch } })),

    clearCatalogSearch: () =>
      set({ catalogQuery: "", catalogFilters: makeDefaultCatalogFilters() }),

    requestCatalogSearchFocus: () =>
      set((s) => ({
        catalogSearchFocusNonce: s.catalogSearchFocusNonce + 1,
      })),

    catalogFiltersOpen: false,

    setCatalogFiltersOpen: (open) => set({ catalogFiltersOpen: open }),

    toggleCatalogFilters: () =>
      set((s) => ({ catalogFiltersOpen: !s.catalogFiltersOpen })),

    currentWallIdx: 0,
    setCurrentWallIdx: (i) => set({ currentWallIdx: i }),

    // ============================================================
    // History
    // ============================================================
    history: [],
    historyIndex: -1,

    pushHistory: (snapshot) =>
      set((s) => {
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

    pendingZoneChooserUid: null,
    setPendingZoneChooser: (uid) =>
      set({ pendingZoneChooserUid: uid }),

    drawerExpanded: false,
    toggleDrawer: () =>
      set((s) => ({ drawerExpanded: !s.drawerExpanded })),
    expandDrawer: () => set({ drawerExpanded: true }),
    collapseDrawer: () => set({ drawerExpanded: false }),

    showLockBadges: true,
    toggleLockBadges: () =>
      set((s) => ({ showLockBadges: !s.showLockBadges })),

    showAllWalls: false,
    setShowAllWalls: (v) => set({ showAllWalls: v }),
    toggleAllWalls: () =>
      set((s) => ({ showAllWalls: !s.showAllWalls })),

    blocksEditorOpen: false,
    setBlocksEditorOpen: (open) => set({ blocksEditorOpen: open }),

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
        blocksEditorOpen: false,
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
          cellLevels: {},
        },
        history: [],
        historyIndex: -1,
      }),
  })),
);

// ============================================================
// Selectors (ไม่เปลี่ยน)
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