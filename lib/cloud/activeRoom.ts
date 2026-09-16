// lib/cloud/activeRoom.ts
//
// ⭐ id ของไฟล์บนเซิร์ฟเวอร์ที่ผูกกับห้องปัจจุบัน (ไว้กด "บันทึกทับ")
//    เก็บแยกจาก SerializedState เพื่อไม่ให้กระทบ undo/redo และไม่ต้อง bump STORAGE_KEY
import { ACTIVE_ROOM_KEY } from "@/lib/shared/roomShare";

export function getStoredActiveRoomId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_ROOM_KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveRoomId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(ACTIVE_ROOM_KEY, id);
    else localStorage.removeItem(ACTIVE_ROOM_KEY);
  } catch {
    /* ignore */
  }
}
