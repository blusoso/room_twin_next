// lib/three/structurePlan.ts
import type { PlacedItem } from "@/lib/state/types";
import { getWallGeom, wallPointXZ } from "./roomShell";

// ⭐ โครงสร้างที่ควรแสดงใน floor plan (ผังห้องแบบบล็อก)
export const STRUCTURE_PLAN_PRODUCTS = new Set([
  "door",
  "window",
  "slidingdoor",
  "column",
  "partition",
  "curtain",
  "ac",
]);

export interface StructurePlan {
  uid: string;
  productId: string;
  cx: number;
  cz: number;
  hw: number;
  hd: number;
  deg: number;
  label: string;
  wallMount: boolean;
}

// ⭐ ศูนย์กลางบล็อก (bbox center ในหน่วย index) — ตรงกับ _blocksOriginI/J ใน roomShell
export function blocksOrigin(blocks: Set<string> | null) {
  if (!blocks || blocks.size === 0) return { oi: 0, oj: 0 };
  let minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity;
  blocks.forEach((k) => {
    const [i, j] = k.split(",").map(Number);
    if (i < minI) minI = i;
    if (i > maxI) maxI = i;
    if (j < minJ) minJ = j;
    if (j > maxJ) maxJ = j;
  });
  return { oi: (minI + maxI) / 2, oj: (minJ + maxJ) / 2 };
}

// ⭐ คำนวณ footprint (หน่วยเมตร, world space) ของ structure
//    wall-mount → ใช้ wallId + u (ตามแนวผนัง)
//    floor item → ใช้ x/z + rotY
export function structurePlanItems(items: PlacedItem[]): StructurePlan[] {
  const out: StructurePlan[] = [];
  items.forEach((item) => {
    if (!STRUCTURE_PLAN_PRODUCTS.has(item.productId)) return;
    const w = (item.params.w ?? 95) / 100;
    const d = (item.params.d ?? 6) / 100;
    const isCol = item.productId === "column" || item.productId === "partition";
    const sp: StructurePlan = {
      uid: item.uid,
      productId: item.productId,
      cx: 0,
      cz: 0,
      hw: w / 2,
      hd: d / 2,
      deg: 0,
      label: isCol
        ? `${Math.round(item.params.w ?? 0)}×${Math.round(item.params.d ?? 0)} ซม.`
        : `${Math.round(item.params.w ?? 0)} ซม.`,
      wallMount: !!item.wallMount,
    };

    if (item.wallMount) {
      if (!item.wallId) return;
      const g = getWallGeom(item.wallId);
      if (!g) return;
      const { x, z } = wallPointXZ(item.wallId, item.u ?? 0, 0);
      sp.cx = x;
      sp.cz = z;
      sp.deg = (Math.atan2(g.dz, g.dx) * 180) / Math.PI;
    } else {
      if (typeof item.x !== "number" || typeof item.z !== "number") return;
      sp.cx = item.x;
      sp.cz = item.z;
      sp.deg = -((item.rotY ?? 0) * 180) / Math.PI;
    }
    out.push(sp);
  });
  return out;
}