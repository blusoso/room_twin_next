// components/modals/ZoneEditModal.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { useZoneEditStore } from "./useModalStores";
import ZoneEditIconPicker from "./ZoneEditIconPicker";
import ZoneEditColorPicker from "./ZoneEditColorPicker";

// ============================================================
// Local helpers (อ่าน zone info จาก store)
// ============================================================

interface ZoneMetaLocal {
  name: string;
  icon: string;
  color: number;
}

function getZoneMeta(zuid: string): ZoneMetaLocal {
  const { zoneMeta, placedItems } = useRoomTwin.getState();
  const ov = zoneMeta.get(zuid) || {};
  const any = placedItems.find((i) => i.zoneUid === zuid);
  return {
    name: ov.name || "โซน",
    icon: ov.icon || "📦",
    color: ov.color !== undefined ? ov.color : 0xb8752e,
  };
}

function isZoneNameTaken(name: string, exclude: string | null): boolean {
  const { placedItems, zoneMeta } = useRoomTwin.getState();
  const norm = name.trim().toLowerCase();
  if (!norm) return false;

  const uids = new Set<string>();
  placedItems.forEach((i) => {
    if (i.zoneUid) uids.add(i.zoneUid);
  });

  for (const z of uids) {
    if (z === exclude) continue;
    const m = zoneMeta.get(z);
    if (m && (m.name || "").trim().toLowerCase() === norm) return true;
  }
  return false;
}

// ============================================================
// Modal
// ============================================================

interface Draft {
  name: string;
  icon: string;
  color: number;
}

export default function ZoneEditModal() {
  const targetUid = useZoneEditStore((s) => s.targetUid);
  const close = useZoneEditStore((s) => s.closeZoneEdit);
  const setZoneMeta = useRoomTwin((s) => s.setZoneMeta);

  const [draft, setDraft] = useState<Draft>({
    name: "",
    icon: "📦",
    color: 0xb8752e,
  });
  const [error, setError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const open = !!targetUid;

  // ===== โหลด draft เมื่อเปิด =====
  useEffect(() => {
    if (!targetUid) return;
    const meta = getZoneMeta(targetUid);
    setDraft({
      name: meta.name,
      icon: meta.icon,
      color: meta.color,
    });
    setError("");
    // focus name input หลัง modal เปิดเล็กน้อย
    setTimeout(() => nameInputRef.current?.focus(), 80);
  }, [targetUid]);

  // ===== Validate name =====
  const handleNameChange = (value: string) => {
    setDraft((d) => ({ ...d, name: value }));
    const trimmed = value.trim();
    if (!trimmed) {
      setError("");
      return;
    }
    if (isZoneNameTaken(trimmed, targetUid)) {
      setError(`ชื่อ "${trimmed}" ถูกใช้ไปแล้ว — กรุณาตั้งชื่ออื่น`);
    } else {
      setError("");
    }
  };

  // ===== Save =====
  const handleSave = () => {
    if (!targetUid) return;
    const name = draft.name.trim();

    if (!name) {
      setError("กรุณากรอกชื่อโซน");
      nameInputRef.current?.focus();
      return;
    }
    if (isZoneNameTaken(name, targetUid)) {
      setError(`ชื่อ "${name}" ถูกใช้ไปแล้ว — กรุณาตั้งชื่ออื่น`);
      nameInputRef.current?.focus();
      return;
    }

    setZoneMeta(targetUid, {
      name,
      icon: draft.icon,
      color: draft.color,
    });
    close();
  };

  // ===== Cancel =====
  const handleCancel = () => {
    close();
  };

  // ===== Backdrop =====
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleCancel();
  };

  // ===== Keyboard =====
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div
      className={`zone-edit-overlay${open ? " show" : ""}`}
      onClick={handleBackdrop}
      aria-hidden={!open}
    >
      <div className="zone-edit-box" role="dialog" aria-modal="true">
        <div className="zone-edit-title">แก้ไขโซน</div>

        <label className="zone-edit-label">ชื่อโซน</label>
        <input
          ref={nameInputRef}
          type="text"
          className={`zone-edit-input${error ? " error" : ""}`}
          value={draft.name}
          onChange={(e) => handleNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={30}
          placeholder="เช่น โซนนอน"
        />
        <div className={`zone-edit-error${error ? " show" : ""}`}>
          {error}
        </div>

        <label className="zone-edit-label">ไอคอน</label>
        <ZoneEditIconPicker
          value={draft.icon}
          onChange={(icon) => setDraft((d) => ({ ...d, icon }))}
        />

        <label className="zone-edit-label">สีโซน</label>
        <ZoneEditColorPicker
          value={draft.color}
          onChange={(color) => setDraft((d) => ({ ...d, color }))}
        />

        <div className="zone-edit-actions">
          <button
            type="button"
            className="zone-edit-cancel"
            onClick={handleCancel}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="zone-edit-save"
            onClick={handleSave}
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}