// app/RoomTwinClient.tsx
"use client";
import dynamic from "next/dynamic";
import LoadingScreen from "@/components/LoadingScreen";
import { prefetchSharedRoom } from "@/lib/cloud/sharedRoomBoot";

// ⭐ fallback ระหว่างโหลด chunk ของ editor = จอโหลดจริง (skeleton + แบรนด์ + progress)
const RoomTwinApp = dynamic(() => import("@/components/RoomTwinApp"), {
  ssr: false,
  loading: () => (
    <LoadingScreen
      message="กำลังเตรียมห้องของคุณ…"
      sub="โหลดโมเดล 3D และวัสดุ"
    />
  ),
});

export default function RoomTwinClient({ shareId }: { shareId?: string }) {
  // ⭐ เปิดลิงก์แชร์: เริ่มดึงข้อมูลห้องทันที (ขนานกับการโหลด chunk ของ editor)
  //    idempotent — เรียกซ้ำจะได้ promise เดิม ไม่ยิง request ซ้ำ
  //    ⭐ ต้องเช็ค window ก่อน: ตอน SSR fetch แบบ path สัมพัทธ์ ("/api/...") จะล้มเหลว
  //       (request จริงเริ่มตอน hydrate ซึ่งยังเร็วกว่าที่ chunk ของ editor จะโหลดเสร็จ)
  if (shareId && typeof window !== "undefined") prefetchSharedRoom(shareId);

  return <RoomTwinApp shareId={shareId} />;
}
