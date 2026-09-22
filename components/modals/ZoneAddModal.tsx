// components/modals/ZoneAddModal.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { ZONE_FALLBACK } from "@/lib/data/zones";
import { ZONE_COLOR_CHOICES } from "@/lib/data/constants";
import { PRODUCT_BY_ID, isAutoZoneExcludedProduct } from "@/lib/data/products";
import { ZONE_ICON_CATEGORIES } from "@/lib/data/icons";
import {
  resolveZoneDisplay,
  pickUniqueZoneName,
  isZoneIconTaken,
  isZoneColorTaken,
  validateZoneIdentity,
} from "@/lib/data/zoneResolve";
import { createCustomZoneFull } from "@/lib/three/zoneActions";
import { useSaveState } from "@/hooks/useSaveState";
import { useZoneAddStore } from "./useModalStores";
import ZoneEditIconPicker from "./ZoneEditIconPicker";
import ZoneEditColorPicker from "./ZoneEditColorPicker";
import ThumbIcon from "@/components/sidebar/ThumbIcon";
import { Button, Modal } from "@/components/ui";

// ============================================================
// Defaults — เลือกค่าที่ "ไม่ชนกับโซนเดิม" ให้ก่อน
// ============================================================

interface Draft {
  name: string;
  icon: string;
  color: number;
}

function firstFreeIcon(): string {
  for (const cat of ZONE_ICON_CATEGORIES) {
    for (const icon of cat.icons) {
      if (!isZoneIconTaken(icon, null)) return icon;
    }
  }
  return ZONE_FALLBACK.icon;
}

function firstFreeColor(): number {
  for (const col of ZONE_COLOR_CHOICES) {
    if (!isZoneColorTaken(col, null)) return col;
  }
  return ZONE_FALLBACK.color;
}

// ============================================================
// Modal
// ============================================================

export default function ZoneAddModal() {
  const open = useZoneAddStore((s) => s.open);
  const mode = useZoneAddStore((s) => s.mode);
  const setMode = useZoneAddStore((s) => s.setZoneAddMode);
  const close = useZoneAddStore((s) => s.closeZoneAdd);

  const placedItems = useRoomTwin((s) => s.placedItems);
  const zoneMeta = useRoomTwin((s) => s.zoneMeta);
  const setActivePanel = useRoomTwin((s) => s.setActivePanel);
  const setActiveCat = useRoomTwin((s) => s.setActiveCat);
  const expandDrawer = useRoomTwin((s) => s.expandDrawer);
  const setSwapTarget = useRoomTwin((s) => s.setSwapTarget);
  const { saveState } = useSaveState();

  const [draft, setDraft] = useState<Draft>({
    name: ZONE_FALLBACK.name,
    icon: ZONE_FALLBACK.icon,
    color: ZONE_FALLBACK.color,
  });
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  // ===== reset ทุกครั้งที่เปิด (default = ค่าที่ไม่ชนกับโซนเดิม) =====
  useEffect(() => {
    if (!open) return;
    setMode("choose");
    setDraft({
      name: pickUniqueZoneName(ZONE_FALLBACK.name, null),
      icon: firstFreeIcon(),
      color: firstFreeColor(),
    });
    setMembers(new Set());
    setError("");
  }, [open, setMode]);

  // ===== Escape =====
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // ⭐ ของที่ใส่โซนได้ — ตัดกลุ่มโครงสร้าง/ม่าน & แอร์ (สอดคล้อง storage migration)
  const eligible = useMemo(
    () => placedItems.filter((i) => !isAutoZoneExcludedProduct(i.productId)),
    [placedItems],
  );

  const selected = eligible.filter((i) => members.has(i.uid));
  const fromOtherZone = selected.filter((i) => i.zoneUid).length;
  const allWallOrCeiling =
    selected.length > 0 && selected.every((i) => i.wallMount || i.ceilingMount);

  const liveError = validateZoneIdentity(draft, null, { live: true });
  const canCreate =
    members.size > 0 && !liveError && draft.name.trim().length > 0;

  // ===== Draft =====
  const applyDraft = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setError(validateZoneIdentity(next, null, { live: true }));
  };

  const toggleMember = (uid: string) => {
    setMembers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
    setError("");
  };

  // ===== Create =====
  const handleCreate = () => {
    const name = draft.name.trim();
    const message = validateZoneIdentity({ ...draft, name }, null);
    if (message) {
      setError(message);
      return;
    }
    if (members.size === 0) {
      setError("เลือกของเข้าโซนอย่างน้อย 1 ชิ้น");
      return;
    }

    const res = createCustomZoneFull({
      name,
      icon: draft.icon,
      color: draft.color,
      memberUids: [...members],
    });
    if (!res.zuid) {
      setError("สร้างโซนไม่สำเร็จ — ลองเลือกของใหม่");
      return;
    }

    // ⭐ 1 การสร้าง = 1 undo step (pattern เดียวกับ zone action อื่นใน RoomTree)
    saveState();
    close();
  };

  // ===== Catalog path (พฤติกรรมเดิมของปุ่ม "+ เพิ่มโซน") =====
  const goCatalog = () => {
    setSwapTarget(null);
    setActivePanel("build");
    setActiveCat("zone");
    expandDrawer();
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      overlayClass="zone-edit-overlay"
      boxClass="zone-edit-box"
    >
      {mode === "choose" ? (
        <>
          <div className="zone-edit-title">เพิ่มโซน</div>

          <button
            type="button"
            className="zone-add-choice"
            onClick={() => setMode("create")}
          >
            <span className="zone-add-choice-icon">🎨</span>
            <span className="zone-add-choice-body">
              <b>สร้างโซนเอง</b>
              <small>ตั้งชื่อ เลือกไอคอน/สี แล้วเลือกของที่จะอยู่ในโซน</small>
            </span>
          </button>

          <button type="button" className="zone-add-choice" onClick={goCatalog}>
            <span className="zone-add-choice-icon">🛒</span>
            <span className="zone-add-choice-body">
              <b>เลือกจากโซนสำเร็จรูปใน catalog</b>
              <small>โซนพร้อมเฟอร์นิเจอร์ เช่น โซนนอน โซนทำงาน</small>
            </span>
          </button>

          <div className="zone-edit-actions">
            <Button
              variant="secondary"
              size="md"
              style={{ flex: 1 }}
              onClick={close}
            >
              ยกเลิก
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="zone-edit-title">สร้างโซนเอง</div>

          <label className="zone-edit-label">ชื่อโซน</label>
          <input
            type="text"
            className={`zone-edit-input${error ? " error" : ""}`}
            value={draft.name}
            onChange={(e) => applyDraft({ name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            maxLength={30}
            placeholder="เช่น โซนอ่านหนังสือของฉัน"
          />
          <div className={`zone-edit-error${error ? " show" : ""}`}>
            {error}
          </div>
          {!error && draft.name.trim().length === 0 && (
            <div className="zone-add-hint">กรอกชื่อโซนก่อนสร้าง</div>
          )}

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

          <label className="zone-edit-label">
            ของในโซน ({members.size} ชิ้น)
          </label>

          {eligible.length === 0 ? (
            <div className="zone-add-hint">
              ยังไม่มีของที่ใส่โซนได้ — ไปวางของในแท็บ &quot;🛒 สร้างห้อง&quot;
              ก่อน หรือเลือกโซนสำเร็จรูปจาก catalog
            </div>
          ) : (
            <div className="zone-add-members">
              {eligible.map((it) => {
                const p = PRODUCT_BY_ID.get(it.productId);
                const name = it.displayName || p?.name || it.productId;
                const from = it.zoneUid
                  ? resolveZoneDisplay(it.zoneUid, { placedItems, zoneMeta })
                      .name
                  : null;

                return (
                  <label key={it.uid} className="zone-add-member">
                    <input
                      type="checkbox"
                      checked={members.has(it.uid)}
                      onChange={() => toggleMember(it.uid)}
                    />
                    <span className="zone-add-member-icon">
                      <ThumbIcon productId={it.productId} />
                    </span>
                    <span className="zone-add-member-name">{name}</span>
                    {from && (
                      <span className="zone-add-member-from">{from}</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          {eligible.length > 0 && members.size === 0 && (
            <div className="zone-add-hint">โซนต้องมีของอย่างน้อย 1 ชิ้น</div>
          )}
          {fromOtherZone > 0 && (
            <div className="zone-add-hint">
              ⚠️ มีของ {fromOtherZone} ชิ้นที่ถูกย้ายออกจากโซนเดิม —
              ถ้าโซนเดิมไม่เหลือของ โซนนั้นจะหายไป
            </div>
          )}
          {allWallOrCeiling && (
            <div className="zone-add-hint">
              ℹ️ ของที่เลือกแขวนผนัง/เพดานทั้งหมด — ขอบเขตโซนใน 3D จะยังไม่แสดง
            </div>
          )}

          <div className="zone-edit-actions">
            <Button
              variant="secondary"
              size="md"
              style={{ flex: 1 }}
              onClick={() => setMode("choose")}
            >
              ย้อนกลับ
            </Button>
            <Button
              variant="copper"
              size="md"
              style={{ flex: 1 }}
              disabled={!canCreate}
              onClick={handleCreate}
            >
              สร้างโซน
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
