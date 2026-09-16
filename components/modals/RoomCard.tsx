// components/modals/RoomCard.tsx
//
// ⭐ การ์ดห้องในรายการ "ห้องของฉัน" / "เทมเพลตสาธารณะ"
//    - แสดงภาพ preview + เวลาที่แก้ไขล่าสุด (อ่านง่ายในไม่กี่วินาที)
//    - ทั้งใบคลิกได้ = เปิดห้อง, เมนู ⋮ = คำสั่งของเจ้าของ
"use client";
import { useEffect, useRef, useState } from "react";
import { InlineSpinner } from "@/components/LoadingScreen";
import { absoluteTimeTh, relativeTimeTh } from "@/lib/utils/format";
import {
  MAX_ROOM_NAME,
  type CloudRoomSummary,
} from "@/lib/shared/roomShare";

/** ภาพ preview — ถ้าไม่มีภาพให้แสดงกล่อง placeholder แทน */
export function RoomThumb({ src }: { src: string }) {
  if (!src) {
    return (
      <span className="ss-thumb placeholder" aria-hidden="true">
        🛋
      </span>
    );
  }
  // ⭐ data URL จาก API — ใช้ <img> ธรรมดา (ไม่ใช้ next/image)
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="ss-thumb" src={src} alt="" loading="lazy" />;
}

export interface RoomCardProps {
  room: CloudRoomSummary;
  /** ไฟล์ที่ผูกกับห้องที่กำลังแก้ไขอยู่ */
  active?: boolean;
  /** true = แสดงคำสั่งของเจ้าของ (เปลี่ยนชื่อ / เทมเพลต / ลบ) */
  owned?: boolean;
  busy?: boolean;
  /** true = กำลังโหลดห้องใบนี้อยู่ (โชว์ spinner ที่ปุ่ม "เปิด") */
  opening?: boolean;
  onOpen: (room: CloudRoomSummary) => void;
  onCopyLink: (room: CloudRoomSummary) => void;
  onRename?: (room: CloudRoomSummary, name: string) => void;
  onToggleTemplate?: (room: CloudRoomSummary) => void;
  onDelete?: (room: CloudRoomSummary) => void;
}

export default function RoomCard({
  room,
  active = false,
  owned = false,
  busy = false,
  opening = false,
  onOpen,
  onCopyLink,
  onRename,
  onToggleTemplate,
  onDelete,
}: RoomCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(room.name);
  const rootRef = useRef<HTMLDivElement>(null);

  // ปิดเมนูเมื่อคลิกนอกการ์ด
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpen]);

  const submitRename = () => {
    const value = draft.trim();
    setRenaming(false);
    if (value && value !== room.name) onRename?.(room, value);
    else setDraft(room.name);
  };

  const time = relativeTimeTh(room.updatedAt);

  return (
    <div
      ref={rootRef}
      className={`ss-card${active ? " active" : ""}${opening ? " opening" : ""}`}
      role="button"
      tabIndex={0}
      aria-busy={opening}
      aria-label={`เปิดห้อง ${room.name}`}
      onClick={() => {
        if (!renaming && !menuOpen && !opening) onOpen(room);
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!renaming && !menuOpen && !opening) onOpen(room);
        }
      }}
    >
      <div className="ss-card-thumb-wrap">
        <RoomThumb src={room.preview} />
        {active && <span className="ss-badge">กำลังแก้ไขอยู่</span>}
        {room.isTemplate && (
          <span className="ss-badge star" title="เผยแพร่เป็นเทมเพลตสาธารณะ">
            ★ เทมเพลต
          </span>
        )}
      </div>

      <div className="ss-card-body">
        {renaming ? (
          <input
            className="ss-input small"
            value={draft}
            maxLength={MAX_ROOM_NAME}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") {
                setDraft(room.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <span className="ss-card-name" title={room.name}>
            {room.name}
          </span>
        )}

        <span className="ss-card-meta" title={absoluteTimeTh(room.updatedAt)}>
          🕒 {time || "ยังไม่ทราบเวลา"} · {room.itemCount} ชิ้น
        </span>

        <div className="ss-card-actions">
          <button
            type="button"
            className="ss-mini"
            disabled={busy || opening}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(room);
            }}
          >
            {opening ? <InlineSpinner size={12} /> : "เปิด"}
          </button>
          <button
            type="button"
            className="ss-mini"
            title="คัดลอกลิงก์แชร์"
            onClick={(e) => {
              e.stopPropagation();
              onCopyLink(room);
            }}
          >
            🔗 แชร์
          </button>
          {owned && (
            <button
              type="button"
              className={`ss-mini menu${menuOpen ? " on" : ""}`}
              title="คำสั่งเพิ่มเติม"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              ⋮
            </button>
          )}
        </div>

        {owned && menuOpen && (
          <div
            className="ss-menu"
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="ss-menu-item"
              onClick={() => {
                setMenuOpen(false);
                setDraft(room.name);
                setRenaming(true);
              }}
            >
              ✏️ เปลี่ยนชื่อ
            </button>
            <button
              type="button"
              className={`ss-menu-item${room.isTemplate ? " on" : ""}`}
              disabled={busy}
              onClick={() => {
                setMenuOpen(false);
                onToggleTemplate?.(room);
              }}
            >
              ★ {room.isTemplate ? "ยกเลิกเทมเพลต" : "ตั้งเป็นเทมเพลต"}
            </button>
            <button
              type="button"
              className="ss-menu-item danger"
              disabled={busy}
              onClick={() => {
                setMenuOpen(false);
                onDelete?.(room);
              }}
            >
              🗑 ลบไฟล์นี้
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ⭐ การ์ดโครง (skeleton) ระหว่างโหลดรายการห้อง
 *    รูปทรงเดียวกับ .ss-card → พอข้อมูลมาจริงภาพไม่กระโดด
 */
export function RoomCardSkeleton() {
  return (
    <div className="ss-skel-card" aria-hidden="true">
      <div className="ss-skel-thumb rt-shimmer" />
      <div className="ss-skel-body">
        <div className="ss-skel-bar rt-shimmer" />
        <div className="ss-skel-bar short rt-shimmer" />
      </div>
    </div>
  );
}
