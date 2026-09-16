// app/api/rooms/route.ts
//
// ⭐ GET  = รายการห้องที่ token นี้เป็นเจ้าของ
//    POST = บันทึกห้องใหม่
import { type NextRequest } from "next/server";
import {
  createRoom,
  listOwnedRooms,
  validateRoomInput,
} from "@/lib/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ownerOf(request: NextRequest): string | null {
  const token = request.headers.get("x-owner-token");
  return token && token.trim() ? token.trim() : null;
}

export async function GET(request: NextRequest) {
  const owner = ownerOf(request);
  if (!owner) {
    return Response.json({ error: "ไม่พบ token เจ้าของ" }, { status: 401 });
  }

  try {
    return Response.json({ rooms: listOwnedRooms(owner) });
  } catch (err) {
    console.error("[api/rooms] GET failed:", err);
    return Response.json(
      { error: "อ่านรายการห้องไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const owner = ownerOf(request);
  if (!owner) {
    return Response.json({ error: "ไม่พบ token เจ้าของ" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const validated = validateRoomInput(body);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  try {
    const summary = createRoom(owner, validated.value);
    return Response.json(summary, { status: 201 });
  } catch (err) {
    console.error("[api/rooms] POST failed:", err);
    return Response.json({ error: "บันทึกห้องไม่สำเร็จ" }, { status: 500 });
  }
}
