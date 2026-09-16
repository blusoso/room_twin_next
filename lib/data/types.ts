// lib/data/types.ts
import type * as THREE from "three";

// ============================================================
// Product / Zone / Theme types
// ============================================================

export interface Dims {
  w: number;
  d: number;
  h: number;
}

export interface ProductDef {
  id: string;
  name: string;
  cat: string;
  dims: Dims;
  price: number;
  color: number;
  build: (dims: any, color: number, opts?: any) => THREE.Group;
  surface?: number;
  rug?: boolean;
  wallMount?: boolean;
  ceilingMount?: boolean;
  groundAnchor?: boolean;
  structural?: boolean;
  extraDefaults?: Record<string, any>;
}

// ⭐ ZoneDef / ZoneSlot ประกาศที่ lib/data/zones.ts เท่านั้น (กัน type drift)
//    แล้ว re-export ท้ายไฟล์

export interface ZoneTheme {
  id: string;
  name: string;
  desc: string;
  swatch: number[];
  primary: number;
  secondary: number;
  accent: number;
  wood: number;
  neutral: number;
  dark: number;
  canvas: number;
  style: Record<string, any>;
}

// ============================================================
// Param schema types
// ============================================================

export interface DimDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

export interface ColorDef {
  key: string;
  label: string;
}

export interface BoolDef {
  key: string;
  label: string;
}

export interface ParamSchema {
  dims?: DimDef[];
  colors?: ColorDef[];
  bools?: BoolDef[];
}

// ============================================================
// Re-export types (เพื่อให้ import จากที่เดียวได้)
// ============================================================

// ⭐ Zone — ประกาศจริงอยู่ใน lib/data/zones.ts (single source of truth)
export type { ZoneDef, ZoneSlot } from "./zones";

export type {
  PlacedItem,
  Params,
  RoomShape,
  SurfaceState,
  ZoneMeta,
  SerializedState,
} from "@/lib/state/types";