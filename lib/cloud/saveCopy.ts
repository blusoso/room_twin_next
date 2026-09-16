// lib/cloud/saveCopy.ts
//
// ⭐ บันทึกห้องที่กำลังดูอยู่ (โหมดลิงก์แชร์) เป็นสำเนาของตัวเอง
//    ใช้ร่วมกันระหว่างแบนเนอร์ ShareBanner และ modal บันทึก / แชร์
//    ขั้นตอนต้องครบตามลำดับ: สร้างไฟล์ → ออกจาก shared view → ผูกเป็นห้องปัจจุบัน
//    → เขียน localStorage → เปลี่ยน URL กลับ "/"
import { useRoomTwin } from "@/lib/state/store";
import { saveToStorage } from "@/lib/state/storage";
import { createRoom } from "@/lib/cloud/api";
import { setStoredActiveRoomId } from "@/lib/cloud/activeRoom";
import type { SerializedState } from "@/lib/state/types";
import type { CloudRoomSummary } from "@/lib/shared/roomShare";

export async function saveSharedAsCopy(input: {
  name: string;
  data: SerializedState;
  preview?: string;
}): Promise<CloudRoomSummary> {
  const room = await createRoom(input);

  const store = useRoomTwin.getState();
  store.exitSharedRoom();
  store.setActiveCloudRoomId(room.id);
  setStoredActiveRoomId(room.id);

  // ตอนนี้พ้น shared view แล้ว → เขียนลง localStorage ได้
  saveToStorage(input.data);

  // ออกจาก URL /r/<id> เพื่อไม่ให้ refresh แล้วโหลดห้องเดิมซ้ำ
  window.history.replaceState({}, "", "/");

  return room;
}
