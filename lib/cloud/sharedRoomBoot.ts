// lib/cloud/sharedRoomBoot.ts
//
// ⭐ แหล่งเดียวของ "ดึง + apply ห้องจากเซิร์ฟเวอร์"
//    - prefetchSharedRoom() : เริ่ม fetch ทันทีที่รู้ shareId (ขนานกับการโหลด chunk ของ editor)
//    - applyCloudRoom()     : เอา snapshot จากเซิร์ฟเวอร์เข้า store (owned = ห้องตัวเอง / !owned = ห้องที่แชร์)
//
//    ⚠️ ไม่ throw: คืน { ok:false, error } เป็นข้อความไทยให้ UI แสดง
import { getRoom } from "./api";
import { setStoredActiveRoomId } from "./activeRoom";
import { normalizeSerializedState, saveToStorage } from "@/lib/state/storage";
import { restoreSerializedState } from "@/lib/state/restore";
import { useRoomTwin } from "@/lib/state/store";
import { serializeSnapshotOf, type CloudRoomFull } from "@/lib/shared/roomShare";

export type SharedRoomResult =
  | { ok: true; room: CloudRoomFull }
  | { ok: false; error: string; notFound: boolean };

/** cache ต่อ id — เรียก prefetchSharedRoom ซ้ำจะได้ promise เดิม (ไม่ยิง request ซ้ำ) */
const inflight = new Map<string, Promise<SharedRoomResult>>();

/** นับ request ที่ยังไม่ settle — ใช้ตัดสินตอน boot ว่าห้ามอ่าน localStorage */
let _pendingCount = 0;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "เปิดห้องไม่สำเร็จ";
}

export function prefetchSharedRoom(id: string): Promise<SharedRoomResult> {
  const existing = inflight.get(id);
  if (existing) return existing;

  _pendingCount += 1;
  const promise = getRoom(id)
    .then((room): SharedRoomResult => ({ ok: true, room }))
    .catch((err): SharedRoomResult => {
      console.error("[sharedRoomBoot] getRoom", err);
      const error = messageOf(err);
      return { ok: false, error, notFound: error.includes("ไม่พบ") };
    })
    .then((result) => {
      _pendingCount = Math.max(0, _pendingCount - 1);
      return result;
    });

  inflight.set(id, promise);
  return promise;
}

/** ล้าง cache แล้วดึงใหม่ (ปุ่ม "ลองอีกครั้ง" บนการ์ด error) */
export function retrySharedRoom(id: string): Promise<SharedRoomResult> {
  inflight.delete(id);
  return prefetchSharedRoom(id);
}

/**
 * ⭐ true เฉพาะช่วงที่ request ยังไม่ settle
 *    useRoomTwinInit ใช้ค่านี้เพื่อ "ไม่โหลดห้องของเจ้าของเครื่อง" ตอนเปิดลิงก์แชร์
 */
export function hasPendingSharedRoom(): boolean {
  return _pendingCount > 0;
}

export function clearPendingSharedRoom(): void {
  _pendingCount = 0;
}

/**
 * ⭐ เอา snapshot ของห้องจากเซิร์ฟเวอร์ขึ้นเป็นห้องปัจจุบันของ editor
 *    (แหล่งเดียวที่ใช้ร่วมกัน: boot ลิงก์แชร์ + SharedRoomLoader + SaveShareModal)
 *
 *    - owned   → ผูกเป็นไฟล์ปัจจุบัน + เขียน localStorage
 *    - !owned  → โหมดดูห้องที่แชร์ (ห้ามทับ localStorage ของผู้ชม)
 */
export function applyCloudRoom(room: CloudRoomFull): void {
  // ⭐ migration ต้องผ่านทางเดียวกับข้อมูลจาก localStorage
  const { state } = normalizeSerializedState(room.data);
  const store = useRoomTwin.getState();

  if (room.owned) {
    store.setActiveCloudRoomId(room.id);
    setStoredActiveRoomId(room.id);
    restoreSerializedState(state);
    saveToStorage(state);
  } else {
    store.enterSharedRoom(room.id, room.name);
    restoreSerializedState(state);
  }

  // เริ่ม history ใหม่ของห้องที่โหลดมา (ไม่ให้ undo ย้อนไปห้องเดิม)
  useRoomTwin.getState().resetHistory(serializeSnapshotOf(state));
}
