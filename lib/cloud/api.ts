// lib/cloud/api.ts
//
// ⭐ client fetch helpers สำหรับฟีเจอร์บันทึก / แชร์ห้อง
//    ทุก request แนบ header `x-owner-token` เพื่อระบุเจ้าของ (anonymous)
import { getOwnerToken } from "./ownerToken";
import type { SerializedState } from "@/lib/state/types";
import type {
  CloudRoomFull,
  CloudRoomSummary,
} from "@/lib/shared/roomShare";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getOwnerToken();

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-owner-token": token } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
  }

  if (res.status === 204) return undefined as T;

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(payload?.error || `เซิร์ฟเวอร์ตอบกลับผิดพลาด (${res.status})`);
  }

  return payload as T;
}

export async function listRooms(): Promise<CloudRoomSummary[]> {
  const data = await request<{ rooms: CloudRoomSummary[] }>("/api/rooms");
  return data.rooms ?? [];
}

export async function listTemplates(): Promise<CloudRoomSummary[]> {
  const data = await request<{ templates: CloudRoomSummary[] }>(
    "/api/templates",
  );
  return data.templates ?? [];
}

export async function createRoom(input: {
  name: string;
  data: SerializedState;
  isTemplate?: boolean;
  preview?: string;
}): Promise<CloudRoomSummary> {
  return request<CloudRoomSummary>("/api/rooms", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getRoom(id: string): Promise<CloudRoomFull> {
  return request<CloudRoomFull>(`/api/rooms/${encodeURIComponent(id)}`);
}

export async function updateRoom(
  id: string,
  patch: {
    name?: string;
    data?: SerializedState;
    isTemplate?: boolean;
    preview?: string;
  },
): Promise<CloudRoomSummary> {
  return request<CloudRoomSummary>(
    `/api/rooms/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(patch) },
  );
}

export async function deleteRoom(id: string): Promise<void> {
  await request<void>(`/api/rooms/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
