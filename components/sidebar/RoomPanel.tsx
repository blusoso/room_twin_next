// components/sidebar/RoomPanel.tsx
"use client";
import { openZoneAddDialog } from "@/components/modals";
import RoomTree from "./RoomTree";

export default function RoomPanel() {
  // ⭐ "+ เพิ่มโซน" เปิดตัวเลือก 2 ทาง (สร้างโซนเอง / เลือกจากโซนสำเร็จรูปใน catalog)
  //    — logic เดิม (สลับไปแท็บสร้างห้อง + หมวดโซน) ย้ายไปอยู่ใน ZoneAddModal
  const handleAddZone = (e: React.MouseEvent) => {
    e.stopPropagation();
    openZoneAddDialog();
  };

  return (
    <>
      <RoomTree />
      <button
        type="button"
        className="add-zone-btn"
        id="addZoneBtn"
        onClick={handleAddZone}
      >
        + เพิ่มโซน
      </button>
    </>
  );
}
