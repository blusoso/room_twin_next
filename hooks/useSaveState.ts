// hooks/useSaveState.ts
"use client";
import { useCallback, useRef } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { saveToStorage } from "@/lib/state/storage";
import { relayoutCeilingItemsForObstacles } from "@/lib/three/ceilingPlacement";
import type { SerializedState } from "@/lib/state/types";

/**
 * useSaveState — บันทึก state ลง localStorage + push เข้า history
 *
 * - `saveState()`     — save ทันที (ใช้ตอน user กด action)
 * - `saveStateDebounced()` — save แบบ debounce 400ms (ใช้ตอน input change)
 * - `serialize()`     — คืน SerializedState (ใช้อ่านใน undo/redo)
 */
export function useSaveState() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const serialize = useCallback((): SerializedState => {
    const s = useRoomTwin.getState();
    return {
      wall: s.currentWallIdx,
      items: s.placedItems,
      zoneMeta: [...s.zoneMeta.entries()],
      surface: s.surface,
      room: {
        w: s.room.w,
        d: s.room.d,
        h: s.room.h,
        shape: s.room.shape,
        blocks: s.room.blocks ? [...s.room.blocks] : null,
        cellSize: s.room.cellSize,
        cellLevels: s.room.cellLevels,
      },
    };
  }, []);

  const saveState = useCallback(() => {
    // Auto-relayout ceiling items (กันของทับกัน)
    relayoutCeilingItemsForObstacles();

    const state = serialize();

    // ⭐ โหมด "ดูห้องที่แชร์" — ห้ามทับ localStorage ของผู้ชม
    //    (แก้ไขได้ + undo/redo ได้ แต่ต้องกด "บันทึกเป็นสำเนาของฉัน" ก่อน)
    if (!useRoomTwin.getState().sharedRoomId) {
      saveToStorage(state);
    }

    const snapshot = JSON.stringify(state);
    useRoomTwin.getState().pushHistory(snapshot);
  }, [serialize]);

  const saveStateDebounced = useCallback(
    (delay = 400) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveState();
      }, delay);
    },
    [saveState],
  );

  return { saveState, saveStateDebounced, serialize };
}