// hooks/useCatalogSearchResult.ts
// ⭐ แหล่งเดียวของ "ผลการค้นหา/กรองสินค้าปัจจุบัน"
//    ใช้ร่วมกันระหว่าง BuildPanel (แคตตาล็อกใน sidebar) และ CatalogFilterPanel (floating panel)
//    → ตัวเลข/รายการที่แสดงตรงกันเสมอ ไม่มีสำเนาที่สอง
"use client";
import { useMemo } from "react";
import { useRoomTwin } from "@/lib/state/store";
import {
  isSearchMode,
  searchCatalog,
  type CatalogHit,
} from "@/lib/data/productSearch";
import type { ZoneDef } from "@/lib/data/types";

export interface CatalogSearchResultView {
  /** มี query หรือ facet เปิดอยู่ → โหมดค้นหา (ซ่อน tabs หมวดหมู่) */
  searchMode: boolean;
  hits: CatalogHit[];
  zones: ZoneDef[];
  resultCount: number;
}

export function useCatalogSearchResult(): CatalogSearchResultView {
  const query = useRoomTwin((s) => s.catalogQuery);
  const filters = useRoomTwin((s) => s.catalogFilters);
  const roomW = useRoomTwin((s) => s.room.w);
  const roomD = useRoomTwin((s) => s.room.d);
  const roomH = useRoomTwin((s) => s.room.h);
  const swapTargetUid = useRoomTwin((s) => s.swapTargetUid);

  const isSwapping = !!swapTargetUid;

  const result = useMemo(
    () =>
      searchCatalog({
        query,
        filters,
        room: { w: roomW, d: roomD, h: roomH },
      }),
    [query, filters, roomW, roomD, roomH],
  );

  return useMemo(() => {
    // ⭐ โหมดเปลี่ยนสินค้าแสดงได้แค่สินค้าพื้นฐาน (themed variant ไม่ใช่คู่แทนที่)
    //    และไม่แสดงโซน เพราะการ์ดโซนถูกปิดในโหมดนี้อยู่แล้ว
    const hits = isSwapping
      ? result.hits.filter((h) => h.themeId === null)
      : result.hits;
    const zones = isSwapping ? [] : result.zones;
    return {
      searchMode: isSearchMode(query, filters),
      hits,
      zones,
      resultCount: hits.length + zones.length,
    };
  }, [result, isSwapping, query, filters]);
}
