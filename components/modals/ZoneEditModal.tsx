// components/modals/ZoneEditModal.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import type { ZoneMeta } from "@/lib/state/types";
import {
  getZoneDefForZone,
  resolveZoneDisplay,
  isZoneNameTaken,
  isZoneIconTaken,
  isZoneColorTaken,
} from "@/lib/data/zoneResolve";
import { ZONE_FALLBACK } from "@/lib/data/zones";
import { useZoneEditStore } from "./useModalStores";
import ZoneEditIconPicker from "./ZoneEditIconPicker";
import ZoneEditColorPicker from "./ZoneEditColorPicker";

// ============================================================
// Draft + validation
// ============================================================

interface Draft {
  name: string;
  icon: string;
  color: number;
}

/**
 * ⭐ ตรวจ uniqueness ของ name / emoji / color
 *    - name: ห้ามซ้ำกับโซนใด ๆ (เทียบชื่อที่ resolve แล้ว)
 *    - icon/color: ห้ามซ้ำกับโซนชนิดอื่น (โซนชนิดเดียวกันใช้ค่าร่วมกันได้)
 */
function validateDraft(
  draft: Draft,
  exclude: string | null,
  live = false,
): string {
  const name = draft.name.trim();

  if (!name) return live ? "" : "กรุณากรอกชื่อโซน";
  if (isZoneNameTaken(name, exclude)) {
    return `ชื่อ "${name}" ถูกใช้ไปแล้ว — กรุณาตั้งชื่ออื่น`;
  }
  if (isZoneIconTaken(draft.icon, exclude)) {
    return `ไอคอน ${draft.icon} ถูกใช้ในโซนอื่นแล้ว — กรุณาเลือกไอคอนอื่น`;
  }
  if (isZoneColorTaken(draft.color, exclude)) {
    return `สีนี้ถูกใช้ในโซนอื่นแล้ว — กรุณาเลือกสีอื่น`;
  }
  return "";
}

/**
 * ⭐ ค่า default ของ definition ที่โซนนี้อ้างอิง (หรือ fallback ถ้าไม่มี def)
 *    ใช้เป็นเกณฑ์ตัดสินว่า "ค่าไหนคือ override ที่ต้องเก็บ"
 */
function defaultsFor(zuid: string): Draft {
  const def = getZoneDefForZone(zuid);
  return {
    name: def?.name ?? ZONE_FALLBACK.name,
    icon: def?.icon ?? ZONE_FALLBACK.icon,
    color: def?.color ?? ZONE_FALLBACK.color,
  };
}

// ============================================================
// Modal
// ============================================================

export default function ZoneEditModal() {
  const targetUid = useZoneEditStore((s) => s.targetUid);
  const close = useZoneEditStore((s) => s.closeZoneEdit);
  const setZoneMeta = useRoomTwin((s) => s.setZoneMeta);

  // ⭐ subscribe zoneMeta เพื่อให้ draft ตรงกับค่าล่าสุด (รวมตอน undo/redo)
  const zoneMeta = useRoomTwin((s) => s.zoneMeta);

  const [draft, setDraft] = useState<Draft>({
    name: ZONE_FALLBACK.name,
    icon: ZONE_FALLBACK.icon,
    color: ZONE_FALLBACK.color,
  });
  const [error, setError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const open = !!targetUid;

  // ===== โหลด/ซิงก์ draft จาก resolver (definition + override) =====
  useEffect(() => {
    if (!targetUid) return;
    const d = resolveZoneDisplay(targetUid);
    setDraft({ name: d.name, icon: d.icon, color: d.color });
    setError("");
  }, [targetUid, zoneMeta]);

  // ===== focus name input เมื่อเปิด modal =====
  useEffect(() => {
    if (!targetUid) return;
    const t = setTimeout(() => nameInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [targetUid]);

  // ===== เปลี่ยนค่าใน draft + validate แบบ live =====
  const applyDraft = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setError(validateDraft(next, targetUid, true));
  };

  // ===== Save =====
  const handleSave = () => {
    if (!targetUid) return;
    const name = draft.name.trim();
    const message = validateDraft({ ...draft, name }, targetUid);

    if (message) {
      setError(message);
      if (!name) nameInputRef.current?.focus();
      return;
    }

    // ⭐ เก็บเฉพาะฟิลด์ที่เป็น override จริง — ค่าที่เท่ากับ definition ไม่ต้อง copy ลง state
    const def = defaultsFor(targetUid);
    const patch: Partial<ZoneMeta> = {
      name: name !== def.name ? name : undefined,
      icon: draft.icon !== def.icon ? draft.icon : undefined,
      color: draft.color !== def.color ? draft.color : undefined,
    };

    setZoneMeta(targetUid, patch);
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
          onChange={(e) => applyDraft({ name: e.target.value })}
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
          onChange={(icon) => applyDraft({ icon })}
        />

        <label className="zone-edit-label">สีโซน</label>
        <ZoneEditColorPicker
          value={draft.color}
          onChange={(color) => applyDraft({ color })}
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
