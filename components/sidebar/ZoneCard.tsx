// components/sidebar/ZoneCard.tsx
"use client";
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
  /** ⭐ ไฮไลต์คำค้น (ใช้ตอนแสดงผลการค้นหา) */
  query?: string;
}

export default function ZoneCard({ zone, startDrag, disabled, query }: Props) {
  const total = zone.slots.reduce(
    (s, sl) => s + (PRODUCT_BY_ID.get(sl.productId)?.price || 0),
    0,
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    startDrag(e, zone.id, e.currentTarget, "zone", null);
  };

  return (
    <div
      className="item-card zone-card"
      data-id={zone.id}
      style={disabled ? { opacity: 0.4, cursor: "default" } : undefined}
      onPointerDown={handlePointerDown}
    >
      <div
        className="item-swatch"
        style={{ background: hexOf(zone.color), color: "#fff" }}
      >
        <span
          style={{
            fontSize: 30,
            textShadow: "0 2px 6px rgba(0,0,0,.2)",
          }}
        >
          {zone.icon}
        </span>
        <span className="zone-count-badge">{zone.slots.length} ชิ้น</span>
      </div>

      <div className="item-name">
        <HighlightedText text={zone.name} query={query} />
      </div>

      <div className="item-price">เริ่มต้น {priceStr(total)}</div>

      <div className="item-dims">
        {zone.slots.map((s) => s.label).join(" • ")}
      </div>
    </div>
  );
}