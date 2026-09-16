// lib/cloud/ownerToken.ts
//
// ⭐ token เจ้าของแบบไม่ระบุตัวตน (anonymous) — สร้างครั้งแรกที่ใช้ฟีเจอร์บันทึกห้อง
//    เก็บใน localStorage แยกจาก SerializedState
import { OWNER_TOKEN_KEY, newOwnerToken } from "@/lib/shared/roomShare";

let cached: string | null = null;

export function getOwnerToken(): string {
  if (cached) return cached;
  if (typeof window === "undefined") return "";

  try {
    const existing = localStorage.getItem(OWNER_TOKEN_KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const token = newOwnerToken();
    localStorage.setItem(OWNER_TOKEN_KEY, token);
    cached = token;
    return token;
  } catch {
    return "";
  }
}
