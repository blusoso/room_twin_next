// app/api/rooms/[id]/route.ts
//
// ⭐ GET    = อ่านห้อง (สาธารณะ — ใช้กับลิงก์แชร์ /r/<id>)
//    PUT    = แก้ไข (เฉพาะเจ้าของ)
//    DELETE = ลบ (เฉพาะเจ้าของ)
//
//    ⚠️ Next 16: context.params เป็น Promise ต้อง await
import { type NextRequest } from "next/server";
import {
  deleteRoom,
  getRoomRow,
  updateRoom,
  validateRoomInput,
} from "@/lib/server/rooms";
import { isStorablePreview, normalizeRoomName } from "@/lib/shared/roomShare";
import type { SerializedState } from "@/lib/state/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function ownerOf(request: NextRequest): string | null {
  const token = request.headers.get("x-owner-token");
  return token && token.trim() ? token.trim() : null;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  try {
    const row = getRoomRow(id);
    if (!row) {
      return Response.json({ error: "ไม่พบห้องนี้" }, { status: 404 });
    }

    let data: SerializedState;
    try {
      data = JSON.parse(row.data) as SerializedState;
    } catch {
      return Response.json(
        { error: "ข้อมูลห้องเสียหาย" },
        { status: 500 },
      );
    }

    const owner = ownerOf(request);
    return Response.json({
      id: row.id,
      name: row.name,
      isTemplate: row.is_template === 1,
      updatedAt: row.updated_at,
      itemCount: row.item_count,
      preview: row.preview ?? "",
      data,
      owned: !!owner && owner === row.owner_token,
    });
  } catch (err) {
    console.error("[api/rooms/:id] GET failed:", err);
    return Response.json({ error: "อ่านห้องไม่สำเร็จ" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
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

  const b = (body ?? {}) as Record<string, unknown>;
  const patch: {
    name?: string;
    data?: SerializedState;
    isTemplate?: boolean;
    preview?: string;
  } = {};

  const row = getRoomRow(id);
  if (!row) {
    return Response.json({ error: "ไม่พบห้องนี้" }, { status: 404 });
  }

  if (b.data !== undefined) {
    // ⭐ ใช้ validator ตัวเดียวกับ POST → เพดานขนาด/จำนวนชิ้นสม่ำเสมอ
    const validated = validateRoomInput(
      {
        name: b.name !== undefined ? b.name : row.name,
        data: b.data,
        isTemplate:
          b.isTemplate !== undefined ? b.isTemplate : row.is_template === 1,
        preview: b.preview,
      },
      row.preview,
    );
    if (!validated.ok) {
      return Response.json({ error: validated.error }, { status: 400 });
    }
    patch.name = validated.value.name;
    patch.data = validated.value.data;
    patch.isTemplate = validated.value.isTemplate;
    patch.preview = validated.value.preview;
  } else {
    if (b.name !== undefined) patch.name = normalizeRoomName(b.name, row.name);
    if (b.isTemplate !== undefined) patch.isTemplate = b.isTemplate === true;
    // ⭐ "" = ลบภาพทิ้ง, ค่าที่ใช้ไม่ได้ = ไม่แตะภาพเดิม
    if (b.preview === "") patch.preview = "";
    else if (isStorablePreview(b.preview)) patch.preview = b.preview;
  }

  try {
    const result = updateRoom(id, owner, patch);
    if (!result.ok) {
      return Response.json(
        {
          error:
            result.status === 403
              ? "ไม่มีสิทธิ์แก้ไขห้องนี้"
              : "ไม่พบห้องนี้",
        },
        { status: result.status },
      );
    }
    return Response.json(result.summary);
  } catch (err) {
    console.error("[api/rooms/:id] PUT failed:", err);
    return Response.json({ error: "บันทึกห้องไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const owner = ownerOf(request);
  if (!owner) {
    return Response.json({ error: "ไม่พบ token เจ้าของ" }, { status: 401 });
  }

  try {
    const result = deleteRoom(id, owner);
    if (!result.ok) {
      return Response.json(
        {
          error:
            result.status === 403
              ? "ไม่มีสิทธิ์ลบห้องนี้"
              : "ไม่พบห้องนี้",
        },
        { status: result.status },
      );
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[api/rooms/:id] DELETE failed:", err);
    return Response.json({ error: "ลบห้องไม่สำเร็จ" }, { status: 500 });
  }
}
