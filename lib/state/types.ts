// lib/state/types.ts
import type { ProductDef } from "@/lib/data/products";

export type Dims = { w: number; d: number; h: number };
export type Params = Dims & { color: number; [key: string]: any };

/** ⭐ ผิวด้านตั้งของไอเทมที่แขวนได้ (แกนใน local frame ของ host) */
export type MountFace = "pz" | "nz" | "px" | "nx";

export interface PlacedItem {
  uid: string;
  productId: string;
  params: Params;

  x?: number;
  z?: number;
  restY?: number;
  rotY?: number;
  parentUid?: string | null;

  wallMount?: boolean;
  wallId?: string;
  u?: number;
  v?: number;
  rotZ?: number;

  // ⭐ แขวนกับพื้นผิวของไอเทมอื่น (เสา/ฉากกั้น/ประตู/หน้าต่าง)
  //    mountUid = uid ของ host, mountFace = ผิวใน local frame ของ host
  //    v = ความสูงจากฐาน (baseY) ของพื้นผิว (ผนังห้อง baseY = 0 → เหมือนเดิม)
  mountUid?: string | null;
  mountFace?: MountFace;

  ceilingMount?: boolean;

  zoneUid?: string | null;
  zoneDefId?: string | null;
  slotId?: string;

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
  // ⭐ Y level per cell: key = "i,j", value = meters (default 0)
  cellLevels: Record<string, number>;
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
  themeBaseline?: Record<
    string,
    { params: Params; displayName: string | null }
  >;
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
    cellLevels: Record<string, number>;
  };
}