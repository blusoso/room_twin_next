// hooks/usePlacingHighlight.ts
// ⭐ sync class .placing บนการ์ดใน catalog กับ store (single source of truth)
//    ทุกทางที่ออกจากโหมดวางของ (วางสำเร็จ / ปุ่มยกเลิกการวาง / Escape)
//    จึงล้างไฮไลต์ให้เอง — ไม่ต้องจำทำทุก call site
"use client";
import { useEffect } from "react";
import { useRoomTwin } from "@/lib/state/store";
import type { RoomTwinState } from "@/lib/state/store";

type PlacingSlice = Pick<
  RoomTwinState,
  "placingProductId" | "placingThemeId" | "placingZoneId"
>;

function placingKey(s: PlacingSlice): string | null {
  if (s.placingProductId) {
    return `${s.placingProductId}|${s.placingThemeId ?? ""}`;
  }
  if (s.placingZoneId) return `z|${s.placingZoneId}`;
  return null;
}

function removeAllPlacing() {
  if (typeof document === "undefined") return;
  document
    .querySelectorAll(".item-card.placing")
    .forEach((c) => c.classList.remove("placing"));
}

export function usePlacingHighlight() {
  useEffect(() => {
    let last = placingKey(useRoomTwin.getState());

    const sync = (s: PlacingSlice) => {
      const key = placingKey(s);
      if (key === last) return;
      last = key;
      // ⭐ ยัง arm อยู่ → ปล่อยให้ useCardDrag เป็นคนไฮไลต์การ์ดใบที่เพิ่งแตะ
      if (!key) removeAllPlacing();
    };

    return useRoomTwin.subscribe(
      (s) => [s.placingProductId, s.placingThemeId, s.placingZoneId] as const,
      ([p, t, z]) =>
        sync({ placingProductId: p, placingThemeId: t, placingZoneId: z }),
      {
        equalityFn: (a, b) =>
          a[0] === b[0] && a[1] === b[1] && a[2] === b[2],
      },
    );
  }, []);
}
