// components/sidebar/ProductCard.tsx
"use client";
import type { ProductDef } from "@/lib/data/types";
import { sizePresetGroup } from "@/lib/data/sizePresets";
import { themeDisplayName, themedSwatchColor } from "@/lib/data/themes";
import { hexOf, priceStr, affiliateUrl } from "@/lib/utils/format";
import { trackAffiliateClick } from "@/lib/state/storage";
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
  catBadge?: string;
  themeName?: string;
  query?: string;
}

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

  const presetCount = sizePresetGroup(product.id)?.presets.length || 0;
  const emoji = CAT_EMOJI[product.cat] || "📦";

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

  const handleOpenStore = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    trackAffiliateClick();
    const url = affiliateUrl(product);
    const win = window.open(url, "_blank", "noopener");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
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

        {subText && (
          <p className="sub">
            <span className="sub-icon" aria-hidden="true">
              <svg
                viewBox="0 0 12 12"
                width="8"
                height="8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2.5" y="2.5" width="7" height="7" rx="1.5" />
                <path d="M1 3 L1 1 L3 1" />
                <path d="M9 1 L11 1 L11 3" />
                <path d="M11 9 L11 11 L9 11" />
                <path d="M3 11 L1 11 L1 9" />
              </svg>
            </span>
            {subText}
          </p>
        )}

        <div className="row">
          <span className="price">{priceStr(product.price)}</span>
        </div>
      </div>

      {/* ⭐ ปุ่มลิงก์ + tooltip "ไปที่ร้านค้า" (โผล่ข้างล่างตอน hover) */}
      <button
        type="button"
        className="card-link"
        aria-label={`เปิดดู ${displayName} ที่ร้านค้า`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleOpenStore}
      >
        <svg
          viewBox="0 0 16 16"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 11 L11 5" />
          <path d="M6 5 H11 V10" />
        </svg>

        {/* ⭐ tooltip — span นี้ต้องมี ไม่งั้น CSS ไม่ทำงาน */}
        <span className="card-link-tip" aria-hidden="true">
          ไปที่ร้านค้า
        </span>
      </button>
    </article>
  );
}