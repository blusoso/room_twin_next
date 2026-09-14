// components/cart/CartItemRow.tsx
"use client";
import { priceStr, affiliateUrl } from "@/lib/utils/format";
import { trackAffiliateClick } from "@/lib/state/storage";
import type { CartLine } from "./useCartData";

interface Props {
  line: CartLine;
  excluded: boolean;
  onToggle: (productId: string) => void;
}

export default function CartItemRow({ line, excluded, onToggle }: Props) {
  const handleOpenStore = () => {
    trackAffiliateClick();
    const url = affiliateUrl({ id: line.productId });
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
    <div
      className={`cart-item${excluded ? " excluded" : ""}`}
      title={"ไปหน้าร้าน: " + line.name}
      onClick={handleOpenStore}
    >
      <div className="cart-item-top">
        <button
          type="button"
          className="cart-toggle"
          aria-pressed={!excluded}
          title={
            excluded
              ? "รวมรายการนี้ในยอดรวมอีกครั้ง"
              : "ไม่รวมรายการนี้ในยอดรวม"
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggle(line.productId);
          }}
        >
          {excluded ? "" : "✓"}
        </button>

        <div className="cart-item-name-wrap">
          <span className="cart-item-name">
            {line.name}
            <span className="ext-link">↗</span>
          </span>
          <span className="cart-item-click-hint">ไปหน้าร้าน</span>
        </div>
      </div>

      <div className="cart-item-detail">
        <span className="cart-item-dims">
          {line.dims.w}×{line.dims.d}×{line.dims.h} ซม.
        </span>
        <span className="sep">·</span>
        <span className="cart-item-price-unit">{priceStr(line.price)}</span>
        <span className="spacer" />
        <span className="cart-item-qty">×{line.qty}</span>
        <span className="cart-item-subtotal">{priceStr(line.subtotal)}</span>
      </div>
    </div>
  );
}