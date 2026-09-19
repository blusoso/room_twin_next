// components/sidebar/ProductCard.tsx
"use client";
import type { ProductDef } from "@/lib/data/types";
import { sizePresetGroup } from "@/lib/data/sizePresets";
import { themeDisplayName, themedSwatchColor } from "@/lib/data/themes";
import { hexOf, priceStr } from "@/lib/utils/format";
import HighlightedText from "./HighlightedText";

interface Props {
  product: ProductDef;
  startDrag: (
    e: React.PointerEvent,
    id: string,
    cardEl: HTMLElement,
    kind: "product" | "themed" | "zone",
    themeId?: string | null,
  ) => void;
  themeId: string | null;
  isSwapping: boolean;
  isCurrent: boolean;
  onSwapClick?: () => void;
  // ⭐ ใช้เฉพาะตอนแสดงผลการค้นหา (ข้ามหมวด/ข้ามธีม)
  catBadge?: string;
  themeName?: string;
  query?: string;
}

/**
 * ⭐ แมพ emoji ตาม category
 *    ใช้เป็น "ไอคอน" บน tile แทนสีทึบ monotone
 */
const CAT_EMOJI: Record<string, string> = {
  structure: "🧱",
  bed: "🛏️",
  seating: "🛋️",
  table: "🖥️",
  cabinet: "🗄️",
  shelf: "📚",
  lamp: "💡",
  decor: "🖼️",
  curtain: "🪟",
  air: "❄️",
  fan: "🌀",
  rug: "🧶",
  misc: "📦",
  ceiling: "⬜",
};

export default function ProductCard({
  product,
  startDrag,
  themeId,
  isSwapping,
  isCurrent,
  onSwapClick,
  catBadge,
  themeName,
  query,
}: Props) {
  const isThemed = !!themeId;
  const displayName =
    isThemed && themeId
      ? themeDisplayName(product.id, themeId) || product.name
      : product.name;
  const swatchColor =
    isThemed && themeId
      ? themedSwatchColor(product.id, themeId)
      : product.color;

  // ⭐ สินค้านี้มีขนาดสำเร็จรูปให้เลือก (📐 บน toolbar / chip ในแผงปรับแต่ง) ไหม
  const presetCount = sizePresetGroup(product.id)?.presets.length || 0;

  // ⭐ emoji ของการ์ด — ใช้จาก cat
  const emoji = CAT_EMOJI[product.cat] || "📦";

  // ⭐ sub-list: ขนาด + badge ต่าง ๆ (ค้นหา / ธีม)
  const subParts: string[] = [
    `${product.dims.w}×${product.dims.d}×${product.dims.h} ซม.`,
  ];
  if (catBadge) subParts.push(catBadge);
  if (isThemed && themeName) subParts.push(themeName);
  const subText = subParts.join(" • ");

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isSwapping) return;
    startDrag(
      e,
      product.id,
      e.currentTarget,
      isThemed ? "themed" : "product",
      themeId,
    );
  };

  const handleClick = () => {
    if (isSwapping && onSwapClick) onSwapClick();
  };

  return (
    <article
      className={[
        "item-card product-card card-b",
        isThemed ? "is-themed" : "",
        isCurrent ? "swap-current" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-id={product.id}
      data-theme-id={themeId || undefined}
      data-kind="product"
      data-key={product.id}
      data-emojis={emoji}
      data-tile={hexOf(swatchColor)}
      data-count={presetCount > 0 ? presetCount : undefined}
      role="button"
      tabIndex={0}
      aria-label={`${displayName} ${priceStr(product.price)}`}
      style={
        {
          "--tile": hexOf(swatchColor),
          cursor: isSwapping ? "pointer" : undefined,
        } as React.CSSProperties
      }
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {/* tile: emoji + grip + size preset badge */}
      <div className="tile">
        <i className="grip" aria-hidden="true">
          ⠿
        </i>

        {presetCount > 0 && <span className="cnt">{presetCount} ขนาด</span>}

        <span className="ems">
          <span>{emoji}</span>
        </span>
      </div>

      {/* content: name / sub / price */}
      <div className="cb">
        <h3>
          <HighlightedText text={displayName} query={query} />
          {isCurrent && isSwapping && " ✓"}
        </h3>

        {subText && <p className="sub">{subText}</p>}

        <div className="row">
          <span className="price">{priceStr(product.price)}</span>
        </div>
      </div>
    </article>
  );
}
