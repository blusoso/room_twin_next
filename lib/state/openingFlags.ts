// lib/state/openingFlags.ts
// ⭐ Flags: user ลบประตู/หน้าต่างเอง → ไม่ seed ซ้ำ
// เก็บใน localStorage แยกจาก state หลัก

const DOOR_REMOVED_KEY = "roomtwin_opening_door_removed_v1";
const WINDOW_REMOVED_KEY = "roomtwin_opening_window_removed_v1";

export function markOpeningRemoved(productId: string): void {
  if (typeof window === "undefined") return;
  if (productId !== "door" && productId !== "window") return;
  try {
    const key =
      productId === "door" ? DOOR_REMOVED_KEY : WINDOW_REMOVED_KEY;
    localStorage.setItem(key, "1");
  } catch {}
}

export function clearOpeningRemoved(productId: string): void {
  if (typeof window === "undefined") return;
  if (productId !== "door" && productId !== "window") return;
  try {
    const key =
      productId === "door" ? DOOR_REMOVED_KEY : WINDOW_REMOVED_KEY;
    localStorage.removeItem(key);
  } catch {}
}

export function isOpeningRemoved(productId: string): boolean {
  if (typeof window === "undefined") return false;
  if (productId !== "door" && productId !== "window") return false;
  try {
    const key =
      productId === "door" ? DOOR_REMOVED_KEY : WINDOW_REMOVED_KEY;
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function clearAllOpeningFlags(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DOOR_REMOVED_KEY);
    localStorage.removeItem(WINDOW_REMOVED_KEY);
  } catch {}
}