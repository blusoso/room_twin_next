// components/ShareBanner.tsx
//
// ⭐ แบนเนอร์โหมด "ดูห้องที่แชร์" (/r/<id> ของคนอื่น)
//    - แก้ไขได้ แต่ autosave ถูกระงับ (ดู hooks/useSaveState.ts)
//    - บันทึกเป็นสำเนาของตัวเองได้
"use client";
import { useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { useSaveState } from "@/hooks/useSaveState";
import { saveSharedAsCopy } from "@/lib/cloud/saveCopy";
import { returnToOwnRoom } from "@/lib/cloud/returnToMine";
import { captureRoomThumbnail } from "@/lib/three/screenshot";
import { showToast } from "@/lib/utils/toast";

export default function ShareBanner() {
  const sharedRoomId = useRoomTwin((s) => s.sharedRoomId);
  const sharedRoomName = useRoomTwin((s) => s.sharedRoomName);
  const { serialize } = useSaveState();
  const [busy, setBusy] = useState(false);

  if (!sharedRoomId) return null;

  const handleSaveCopy = async () => {
    setBusy(true);
    try {
      const name = sharedRoomName
        ? `${sharedRoomName} (สำเนา)`.slice(0, 60)
        : "สำเนาห้อง";

      const room = await saveSharedAsCopy({
        name,
        data: serialize(),
        preview: captureRoomThumbnail() ?? undefined,
      });

      showToast(`บันทึกสำเนา "${room.name}" แล้ว`);
    } catch (err) {
      console.error("[ShareBanner] save copy", err);
      showToast(err instanceof Error ? err.message : "บันทึกสำเนาไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleBackToMine = () => {
    // ⭐ สลับกลับห้องของตัวเองแบบ client-side — โหลดจาก localStorage แล้ว restore
    //    (ไม่ reload ทั้งหน้า ไม่โหลด bundle ใหม่ + เปลี่ยน URL กลับ "/" ให้)
    returnToOwnRoom();
    showToast("กลับไปห้องของฉันแล้ว");
  };

  return (
    <div className="share-banner" id="shareBanner">
      <span className="sb-text">
        👀 กำลังดูห้องที่แชร์: <strong>{sharedRoomName || "ไม่มีชื่อ"}</strong> —
        การแก้ไขจะไม่ถูกบันทึกอัตโนมัติ
      </span>
      <span className="sb-actions">
        <button
          type="button"
          className="sb-btn primary"
          disabled={busy}
          onClick={handleSaveCopy}
        >
          บันทึกเป็นสำเนาของฉัน
        </button>
        <button
          type="button"
          className="sb-btn"
          disabled={busy}
          onClick={handleBackToMine}
        >
          กลับไปห้องของฉัน
        </button>
      </span>
    </div>
  );
}
