// hooks/useLighting.ts
//
// ⭐ ร้อย store (โหมดแสง + สวิตช์ไฟโคม + รายการไอเทม) เข้ากับระบบแสงใน scene
//
//    - init lighting/env ครั้งแรก (idempotent — Canvas3D เรียกซ้ำได้)
//    - เปลี่ยนโหมดแสง / สวิตช์ไฟ → apply ทันที
//    - ไอเทมเปลี่ยน → reconcile ไฟของโคม (syncLampLights)
//
//    ข้ามการ sync ตอน "ลาก/ย้ายไอเทม" (ตำแหน่งเปลี่ยนแต่ชุดโคมไม่เปลี่ยน)
//    เพราะไฟเป็นลูกของ object อยู่แล้ว → ขยับตามอัตโนมัติ

"use client";
import { useEffect } from "react";
import { isInitialized } from "@/lib/three/scene";
import { initLighting, applyLightingMode } from "@/lib/three/lighting";
import { syncLampLights, applyLampPower } from "@/lib/three/lampLights";
import { LAMP_PRODUCT_IDS } from "@/lib/data/lighting";
import { useRoomTwin } from "@/lib/state/store";
import type { PlacedItem } from "@/lib/state/types";

/** ลายเซ็นของ "ชุดโคม + สวิตช์ต่อโคม" — เปลี่ยนเมื่อไรต้อง reconcile ไฟใหม่ */
function lampSignature(items: PlacedItem[]): string {
  return items
    .filter((i) => LAMP_PRODUCT_IDS.has(i.productId))
    .map(
      (i) =>
        `${i.uid}:${i.productId}:${i.params?.lightOn === false ? 0 : 1}`,
    )
    .join("|");
}

export function useLighting() {
  useEffect(() => {
    if (!isInitialized()) return;

    initLighting();

    let lastSig = lampSignature(useRoomTwin.getState().placedItems);
    syncLampLights();
    applyLampPower();

    const unsubMode = useRoomTwin.subscribe(
      (s) => s.lightingMode,
      () => applyLightingMode(),
    );
    const unsubLamps = useRoomTwin.subscribe(
      (s) => s.lampsOn,
      () => applyLampPower(),
    );
    const unsubItems = useRoomTwin.subscribe(
      (s) => s.placedItems,
      (items) => {
        const sig = lampSignature(items);
        if (sig === lastSig) return;
        lastSig = sig;
        syncLampLights();
      },
    );

    return () => {
      unsubMode();
      unsubLamps();
      unsubItems();
    };
  }, []);
}
