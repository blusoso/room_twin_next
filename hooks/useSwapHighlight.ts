// hooks/useSwapHighlight.ts
// ⭐ ร้อย store (swapTargetUid) เข้ากับ visual indicator ใน scene
"use client";
import { useEffect } from "react";
import { useRoomTwin } from "@/lib/state/store";
import {
  setSwapHighlight,
  clearSwapHighlight,
} from "@/lib/three/swapHighlight";

export function useSwapHighlight() {
  useEffect(() => {
    const sync = (uid: string | null) => setSwapHighlight(uid);

    // sync ค่าเริ่มต้น (กรณี mount ระหว่างมี swap mode ค้างอยู่)
    sync(useRoomTwin.getState().swapTargetUid);

    const unsub = useRoomTwin.subscribe((s) => s.swapTargetUid, sync);

    return () => {
      unsub();
      clearSwapHighlight();
    };
  }, []);
}
