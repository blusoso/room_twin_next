// components/SharedRoomLoader.tsx
//
// ⭐ เปิดลิงก์แชร์ /r/<id> → โหลดห้องจากเซิร์ฟเวอร์เข้า editor
//
//    - ห้องของตัวเอง : ตั้งเป็นไฟล์ปัจจุบัน (activeCloudRoomId) + บันทึกลง localStorage
//    - ห้องของคนอื่น : เข้าโหมด "ห้องที่แชร์" (sharedRoomId) → ระงับ autosave
//                     จนกว่าจะกด "บันทึกเป็นสำเนาของฉัน"
"use client";
import { useEffect } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { getRoom } from "@/lib/cloud/api";
import { setStoredActiveRoomId } from "@/lib/cloud/activeRoom";
import { normalizeSerializedState, saveToStorage } from "@/lib/state/storage";
import { restoreSerializedState } from "@/lib/state/restore";
import { serializeSnapshotOf } from "@/lib/shared/roomShare";
import { showToast } from "@/lib/utils/toast";

export default function SharedRoomLoader({
  shareId,
}: {
  shareId?: string;
}) {
  useEffect(() => {
    if (!shareId) return;

    let cancelled = false;

    const run = async () => {
      try {
        const room = await getRoom(shareId);
        if (cancelled) return;

        const { state } = normalizeSerializedState(room.data);
        const store = useRoomTwin.getState();

        if (room.owned) {
          // ⭐ เปิดไฟล์ของตัวเอง → ใช้เป็นห้องปัจจุบัน
          store.setActiveCloudRoomId(room.id);
          setStoredActiveRoomId(room.id);
          restoreSerializedState(state);
          saveToStorage(state);
        } else {
          // ⭐ ห้องของคนอื่น → โหมดดูห้องแชร์ (ห้ามทับ localStorage)
          store.enterSharedRoom(room.id, room.name);
          restoreSerializedState(state);
        }

        // เริ่ม history ใหม่ของห้องที่โหลดมา (ไม่ให้ undo ย้อนไปห้องเดิม)
        store.resetHistory(serializeSnapshotOf(state));
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "เปิดห้องไม่สำเร็จ";
        console.error("[SharedRoomLoader]", err);
        showToast(
          msg.includes("ไม่พบ") ? "ไม่พบห้องที่แชร์ (อาจถูกลบแล้ว)" : msg,
        );
      }
    };

    if (useRoomTwin.getState().storeReady) {
      run();
      return () => {
        cancelled = true;
      };
    }

    // ⭐ รอให้ useRoomTwinInit โหลดห้องเดิมเสร็จก่อน แล้วค่อยทับด้วยห้องที่แชร์
    let unsub: (() => void) | null = null;
    unsub = useRoomTwin.subscribe(
      (s) => s.storeReady,
      (ready) => {
        if (!ready) return;
        unsub?.();
        run();
      },
    );

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [shareId]);

  return null;
}
