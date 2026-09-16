// lib/shared/roomShare.ts
//
// ⭐ ค่าร่วมระหว่าง client และ server สำหรับฟีเจอร์ "บันทึก / แชร์ห้อง"
//    ห้าม import อะไรที่ผูกกับ Node (fs / node:sqlite) ในไฟล์นี้
//    เพื่อให้ฝั่ง browser ใช้ได้ด้วย
import type { SerializedState } from "@/lib/state/types";

// ============================================================
// localStorage keys (view/identity preference — ไม่เข้า SerializedState)
// ============================================================

/** ⭐ token ไม่ระบุตัวตนของเจ้าของเครื่อง (สร้างครั้งแรกที่ใช้ฟีเจอร์บันทึก) */
export const OWNER_TOKEN_KEY = "roomtwin_owner_token";
/** ⭐ id ของไฟล์บนเซิร์ฟเวอร์ที่ผูกกับห้องปัจจุบัน (ไว้กด "บันทึกทับ") */
export const ACTIVE_ROOM_KEY = "roomtwin_active_room";

// ============================================================
// Limits / defaults
// ============================================================

export const DEFAULT_ROOM_NAME = "ห้องของฉัน";
export const MAX_ROOM_NAME = 60;
export const MAX_ITEMS = 500;
export const MAX_DATA_BYTES = 512 * 1024;
/** ⭐ เพดานขนาด data URL ของภาพ preview (thumbnail JPEG) */
export const MAX_PREVIEW_BYTES = 160 * 1024;

// ============================================================
// Types (ใช้ร่วม client/server)
// ============================================================

export interface CloudRoomSummary {
  id: string;
  name: string;
  isTemplate: boolean;
  updatedAt: number;
  itemCount: number;
  /** ⭐ data URL ของภาพ preview (JPEG ย่อ) — "" เมื่อไม่มี/ใช้ไม่ได้ */
  preview: string;
}

export interface CloudRoomFull extends CloudRoomSummary {
  data: SerializedState;
  /** true เมื่อ token ของผู้เรียกตรงกับเจ้าของไฟล์ */
  owned: boolean;
}

export interface RoomPayload {
  name: string;
  data: SerializedState;
  isTemplate: boolean;
}

// ============================================================
// Helpers
// ============================================================

export function newShareId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function newOwnerToken(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 12)
  );
}

/** ตัดช่องว่าง + จำกัดความยาว + fallback เมื่อว่าง */
export function normalizeRoomName(
  raw: unknown,
  fallback = DEFAULT_ROOM_NAME,
): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return fallback;
  return s.length > MAX_ROOM_NAME ? s.slice(0, MAX_ROOM_NAME) : s;
}

/** จำนวนชิ้นของห้อง (ใช้แสดงในรายการ) */
export function itemCountOf(data: SerializedState | null | undefined): number {
  return Array.isArray(data?.items) ? data!.items.length : 0;
}

/**
 * ⭐ ตรวจว่า preview เก็บลง DB ได้ไหม
 *    ต้องเป็น data URL ของรูป และไม่ใหญ่เกิน MAX_PREVIEW_BYTES
 */
export function isStorablePreview(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.startsWith("data:image/") &&
    v.length > 0 &&
    v.length <= MAX_PREVIEW_BYTES
  );
}

/** ลิงก์แชร์เต็ม (ใช้ได้ทั้ง client และ server) */
export function shareUrlOf(id: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/r/${id}`;
}

/**
 * ⭐ สร้าง JSON snapshot แบบเดียวกับ useSaveState().serialize()
 *    ใช้ตอน reset history หลังโหลดห้องจากเซิร์ฟเวอร์ / ลิงก์แชร์
 */
export function serializeSnapshotOf(state: SerializedState): string {
  return JSON.stringify({
    wall: state.wall ?? 0,
    items: state.items ?? [],
    zoneMeta: state.zoneMeta ?? [],
    surface: state.surface,
    room: {
      ...state.room,
      blocks: state.room?.blocks ?? null,
    },
  });
}
