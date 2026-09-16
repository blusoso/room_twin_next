// components/SharedRoomLoader.tsx
//
// ⭐ เปิดลิงก์แชร์ /r/<id> → โหลดห้องจากเซิร์ฟเวอร์เข้า editor
//
//    ลำดับใหม่ (ขนานกัน ไม่ต่อคิว):
//      1) RoomTwinClient เริ่ม prefetchSharedRoom() ไปแล้วตั้งแต่ก่อน editor โหลดเสร็จ
//      2) ที่นี่รอ "ข้อมูลห้อง" + "storeReady" พร้อมกัน → applyCloudRoom()
//      3) useRoomTwinInit จะไม่โหลดห้องของเจ้าของเครื่องระหว่างที่ยัง pending
//
//    - ห้องของตัวเอง : ตั้งเป็นไฟล์ปัจจุบัน (activeCloudRoomId) + บันทึกลง localStorage
//    - ห้องของคนอื่น : เข้าโหมด "ห้องที่แชร์" (sharedRoomId) → ระงับ autosave
//                     จนกว่าจะกด "บันทึกเป็นสำเนาของฉัน"
"use client";
import { useEffect } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { applyCloudRoom, prefetchSharedRoom } from "@/lib/cloud/sharedRoomBoot";

export interface BootStatus {
  phase: "loading" | "ready" | "error";
  message?: string;
}

/** รอให้ useRoomTwinInit ตั้ง storeReady (ถ้าพร้อมแล้วคืนทันที) */
function waitForStoreReady(): Promise<void> {
  if (useRoomTwin.getState().storeReady) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const unsub = useRoomTwin.subscribe(
      (s) => s.storeReady,
      (ready) => {
        if (!ready) return;
        unsub();
        resolve();
      },
    );
  });
}

export default function SharedRoomLoader({
  shareId,
  reloadToken = 0,
  onStatus,
}: {
  shareId?: string;
  /** ⭐ เปลี่ยนค่า = สั่งโหลดใหม่ (ปุ่ม "ลองอีกครั้ง" บนการ์ด error) */
  reloadToken?: number;
  onStatus: (status: BootStatus) => void;
}) {
  useEffect(() => {
    if (!shareId) return;

    let cancelled = false;
    onStatus({ phase: "loading" });

    const run = async () => {
      // ⭐ ไม่ await แบบต่อคิว: ข้อมูลห้องถูกดึงไปแล้วตั้งแต่ bootstrap
      const [result] = await Promise.all([
        prefetchSharedRoom(shareId),
        waitForStoreReady(),
      ]);
      if (cancelled) return;

      if (!result.ok) {
        onStatus({ phase: "error", message: result.error });
        return;
      }

      try {
        applyCloudRoom(result.room);
        if (cancelled) return;
        onStatus({ phase: "ready" });
      } catch (err) {
        console.error("[SharedRoomLoader] apply room", err);
        onStatus({
          phase: "error",
          message: err instanceof Error ? err.message : "เปิดห้องไม่สำเร็จ",
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [shareId, reloadToken, onStatus]);

  return null;
}
