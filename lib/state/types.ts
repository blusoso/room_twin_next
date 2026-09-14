// lib/state/types.ts
import type { ProductDef } from "@/lib/data/products";

export type Dims = { w: number; d: number; h: number };

export type Params = Dims & { color: number; [key: string]: any };

export interface PlacedItem {
  uid: string;
  productId: string;
  params: Params;

  // floor items
  x?: number;
  z?: number;
  restY?: number;
  rotY?: number;
  parentUid?: string | null;

  // wall items
  wallMount?: boolean;
  wallId?: string;
  u?: number;
  v?: number;
  rotZ?: number;

  // ceiling items
  ceilingMount?: boolean;

  // zone membership
  zoneUid?: string | null;
  zoneDefId?: string | null;
  slotId?: string;

  // extras
  locked?: boolean;
  themeOverride?: string;
  displayName?: string | null;
}

export interface RoomShape {
  w: number;
  d: number;
  h: number;
  shape: "rect" | "blocks";
  blocks: Set<string> | null;
  cellSize: number;
}

export interface SurfaceState {
  floor: string;
  wallUniform: boolean;
  wallAll: number;
  walls: Record<string, number>;
  ceiling: number;
}

export interface ZoneMeta {
  name?: string;
  icon?: string;
  color?: number;
  themeId?: string;
  themeBaseline?: Record<string, { params: Params; displayName: string | null }>;
}

export interface SerializedState {
  wall: number;
  items: PlacedItem[];
  zoneMeta: [string, ZoneMeta][];
  surface: SurfaceState;
  room: {
    w: number;
    d: number;
    h: number;
    shape: "rect" | "blocks";
    blocks: string[] | null;
    cellSize: number;
  };
}