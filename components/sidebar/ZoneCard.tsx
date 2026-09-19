// components/sidebar/ZoneCard.tsx
"use client";
import { useEffect, useState } from "react";
import type { ZoneDef } from "@/lib/data/types";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { hexOf, priceStr } from "@/lib/utils/format";
import HighlightedText from "./HighlightedText";

interface Props {
  zone: ZoneDef;
  startDrag: (
    e: React.PointerEvent,
    id: string,
    cardEl: HTMLElement,
    kind: "product" | "themed" | "zone",
    themeId?: string | null,
  ) => void;
  disabled?: boolean;
  query?: string;
  onQuickAdd?: (zoneId: string) => void;
}

const PlusIcon = (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export default function ZoneCard({
  zone,
  startDrag,
  disabled,
  query,
  onQuickAdd,
}: Props) {
  // ⭐ local state — จางการ์ดต้นทางตอนลาก
  const [isDragging, setIsDragging] = useState(false);

  // ⭐ ปลอดภัย: ถ้า unmount ระหว่างลาก → เคลียร์
  useEffect(() => {
    if (!isDragging) return;
    return () => setIsDragging(false);
  }, [isDragging]);

  const total = zone.slots.reduce(
    (s, sl) => s + (PRODUCT_BY_ID.get(sl.productId)?.price || 0),
    0,
  );

  // ⭐ emoji ของสินค้าในโซน (unique, สูงสุด 3)
  const emojis = Array.from(
    new Set(
      zone.slots
        .map((sl) => {
          const p = PRODUCT_BY_ID.get(sl.productId) as
            | { icon?: string; emoji?: string }
            | undefined;
          return p?.icon || p?.emoji || "";
        })
        .filter(Boolean),
    ),
  ).slice(0, 3);

  const shownEmojis = emojis.length > 0 ? emojis : [zone.icon];

  // ⭐ sub-list ชื่อสินค้า
  const subList = zone.slots
    .map((sl) => sl.label || PRODUCT_BY_ID.get(sl.productId)?.name || "")
    .filter(Boolean)
    .join(" • ");

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (disabled) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;

    setIsDragging(true);
    try {
      startDrag(e, zone.id, e.currentTarget, "zone", null);
    } catch {
      setIsDragging(false);
    }
  };

  // ⭐ หยุด state ตอนปล่อยนิ้ว/เมาส์ — ฟังที่ window เพราะ pointerup อาจเกิดนอกการ์ด
  useEffect(() => {
    if (!isDragging) return;
    const clear = () => setIsDragging(false);
    window.addEventListener("pointerup", clear);
    window.addEventListener("pointercancel", clear);
    return () => {
      window.removeEventListener("pointerup", clear);
      window.removeEventListener("pointercancel", clear);
    };
  }, [isDragging]);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled) return;
    onQuickAdd?.(zone.id);
  };

  return (
    <article
      className={[
        "item-card zone-card card-b",
        disabled ? "is-disabled" : "",
        isDragging ? "is-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-id={zone.id}
      data-kind="zone"
      data-key={zone.id}
      // ⭐ ส่งข้อมูลให้ ghost ผ่าน dataset (useCardDrag จะอ่านได้)
      data-emojis={shownEmojis.join("|")}
      data-count={zone.slots.length}
      data-tile={hexOf(zone.color)}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${zone.name} ${zone.slots.length} ชิ้น เริ่มต้น ${priceStr(total)}`}
      style={{ "--tile": hexOf(zone.color) } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onQuickAdd?.(zone.id);
        }
      }}
    >
      {/* tile: emoji หลายตัว + grip + count */}
      <div className="tile">
        <i className="grip" aria-hidden="true">⠿</i>
        <span className="cnt">{zone.slots.length} ชิ้น</span>
        <span className="ems">
          {shownEmojis.map((em, i) => (
            <span key={i}>{em}</span>
          ))}
        </span>
      </div>

      {/* content */}
      <div className="cb">
        <h3>
          <HighlightedText text={zone.name} query={query} />
        </h3>

        {subList && <p className="sub">{subList}</p>}

        <div className="row">
          <span className="price">
            <small>เริ่มต้น</small> {priceStr(total)}
          </span>
          {onQuickAdd && (
            <button
              type="button"
              className="add"
              data-no-drag
              aria-label={`วาง ${zone.name} ในห้อง`}
              onClick={handleAdd}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {PlusIcon}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}