// components/sidebar/ProductCard.tsx
"use client";
import type { ProductDef } from "@/lib/data/types";
import { themeDisplayName, themedSwatchColor } from "@/lib/data/themes";
import { hexOf, priceStr } from "@/lib/utils/format";

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
}

export default function ProductCard({
  product,
  startDrag,
  themeId,
  isSwapping,
  isCurrent,
  onSwapClick,
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
    <div
      className={`item-card${isCurrent ? " swap-current" : ""}`}
      data-id={product.id}
      data-theme-id={themeId || undefined}
      style={isSwapping ? { cursor: "pointer" } : undefined}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <div
        className="item-swatch"
        style={{ background: hexOf(swatchColor) }}
      />

      <div className="item-name">
        {displayName}
        {isCurrent && isSwapping && " ✓"}
      </div>

      <div className="item-price">{priceStr(product.price)}</div>

      <div className="item-dims">
        {product.dims.w}×{product.dims.d}×{product.dims.h} ซม.
      </div>
    </div>
  );
}