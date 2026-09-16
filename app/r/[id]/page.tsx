// app/r/[id]/page.tsx
//
// ⭐ หน้าลิงก์แชร์: /r/<id> — โหลดห้องที่แชร์เข้า editor
//    ⚠️ Next 16: params เป็น Promise ต้อง await
import RoomTwinClient from "@/app/RoomTwinClient";

export const dynamic = "force-dynamic";

export default async function SharedRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RoomTwinClient shareId={id} />;
}
