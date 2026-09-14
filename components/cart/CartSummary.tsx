// components/cart/CartSummary.tsx
"use client";
import { priceStr } from "@/lib/utils/format";

interface Props {
  activeCount: number;
  excludedCount: number;
  total: number;
  barcodeString: string;
  hasAnyItem: boolean;
  allSelected: boolean;
  onSelectAll: () => void;
  onBuyAll: () => void;
}

export default function CartSummary({
  activeCount,
  excludedCount,
  total,
  barcodeString,
  hasAnyItem,
  allSelected,
  onSelectAll,
  onBuyAll,
}: Props) {
  return (
    <div className="cart-foot">
      <div className="cart-dashes" />

      <div className="cart-count-row">
        <span>จำนวนสินค้า: {activeCount} ชิ้น</span>
        <span>THB</span>
      </div>

      <div className="cart-total-row">
        <span>Total</span>
        <span className="cart-total-amount">{priceStr(total)}</span>
      </div>

      <div className="cart-actions">
        <button
          type="button"
          className={`cart-action-btn select-all-btn${
            allSelected && hasAnyItem ? " selected" : ""
          }`}
          disabled={!hasAnyItem}
          onClick={onSelectAll}
        >
          {allSelected && hasAnyItem
            ? "❌ ยกเลิกเลือกทั้งหมด"
            : "✅ เลือกทั้งหมด"}
        </button>

        <button
          type="button"
          className="cart-action-btn buy-all-btn"
          onClick={onBuyAll}
        >
          🛒 สั่งซื้อทั้งหมด
        </button>
      </div>

      <div className="cart-hint">
        แตะชื่อสินค้าเพื่อไปหน้าร้าน ↗ • แตะช่องสี่เหลี่ยมเพื่อปิด/เปิดรายการนั้นจากยอดรวม
      </div>

      <div className="cart-excluded-note">
        {excludedCount > 0
          ? `(ไม่รวม ${excludedCount} ชิ้นที่ปิดไว้ในยอดรวม)`
          : ""}
      </div>

      <div className="cart-barcode" />
      <div className="cart-code">{barcodeString}</div>
      <div className="cart-thanks">ขอบคุณที่แวะชม 🌿</div>
    </div>
  );
}