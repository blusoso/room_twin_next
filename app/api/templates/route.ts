// app/api/templates/route.ts
//
// ⭐ GET = รายการเทมเพลตสาธารณะ (เจ้าของติ๊ก "เป็นเทมเพลต") — เปิดให้ทุกคนอ่าน
import { listTemplateRooms } from "@/lib/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ templates: listTemplateRooms() });
  } catch (err) {
    console.error("[api/templates] GET failed:", err);
    return Response.json(
      { error: "อ่านรายการเทมเพลตไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
