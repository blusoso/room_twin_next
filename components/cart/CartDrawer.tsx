// components/cart/CartDrawer.tsx
"use client";
import { useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { affiliateUrl } from "@/lib/utils/format";
import { trackAffiliateClick } from "@/lib/state/storage";
import { useCartData } from "./useCartData";
import CartHeader from "./CartHeader";
import CartItemRow from "./CartItemRow";
import CartEmpty from "./CartEmpty";
import CartSummary from "./CartSummary";
import ConfirmDialog from "./ConfirmDialog";
import { IconButton, EmptyState  } from "@/components/ui";

export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const {
    lines,
    excludedProductIds,
    activeCount,
    excludedCount,
    total,
    isEmpty,
    receiptNumber,
    dateString,
    barcodeString,
  } = useCartData();

  const placedItems = useRoomTwin((s) => s.placedItems);
  const toggleCartLine = useRoomTwin((s) => s.toggleCartLine);
  const clearCartExcluded = useRoomTwin((s) => s.clearCartExcluded);

  // ===== toggle open/close =====
  const close = () => setOpen(false);

  // ===== select-all toggle =====
  const handleSelectAll = () => {
    if (excludedProductIds.size === 0) {
      // ยกเลิกทั้งหมด → set ทุก productId เข้า excluded
      const all = new Set<string>();
      placedItems.forEach((i) => all.add(i.productId));
      useRoomTwin.setState({ cartExcluded: all });
    } else {
      clearCartExcluded();
    }
  };

  // ===== buy-all =====
  const handleBuyAll = () => {
    const activeItems = placedItems.filter(
      (i) => !excludedProductIds.has(i.productId),
    );
    if (activeItems.length === 0) {
      alert("⚠️ ไม่มีสินค้าที่เลือกเพื่อสั่งซื้อ");
      return;
    }
    setConfirmMessage(
      `🛒 กำลังจะเปิดลิงก์สินค้า <strong>${activeItems.length}</strong> รายการในแท็บใหม่` +
        `<br><br>⚠️ เบราว์เซอร์อาจขออนุญาต Pop-up (ป๊อปอัป) กรุณากด "อนุญาต" หรือ "Allow" หากถูกถาม` +
        `<br><br>คุณต้องการดำเนินการต่อหรือไม่?`,
    );
    setConfirmAction(() => () => {
      activeItems.forEach((item, index) => {
        const p = { id: item.productId };
        setTimeout(() => {
          trackAffiliateClick();
          window.open(affiliateUrl(p), "_blank", "noopener");
        }, index * 150);
      });
    });
    setConfirmOpen(true);
  };

  // ===== เปิด-ปิดด้วยคลิก backdrop =====
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) close();
  };

  // ===== expose open() ให้ component อื่นเรียกได้ผ่าน window event =====
  // (Header จะ dispatch "roomtwin:openCart")
  useState(() => {
    if (typeof window === "undefined") return null;
    const onOpen = () => setOpen(true);
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener("roomtwin:openCart", onOpen);
    window.addEventListener("roomtwin:toggleCart", onToggle);
    return () => {
      window.removeEventListener("roomtwin:openCart", onOpen);
      window.removeEventListener("roomtwin:toggleCart", onToggle);
    };
  });

  return (
    <>
      <div
        className={`cart-overlay${open ? " show" : ""}`}
        onClick={handleBackdropClick}
      >
        <div className="cart-panel">
          <IconButton
            label="ปิด"
            size="sm"
            style={{ position: "absolute", top: 14, right: 14, zIndex: 2 }}
            onClick={close}
          >
            ✕
          </IconButton>

          <div className="cart-paper-body">
            <CartHeader date={dateString} receiptNumber={receiptNumber} />

            <div className="cart-list">
              {lines.length === 0 ? (
                <CartEmpty />
              ) : (
                lines.map((line) => (
                  <CartItemRow
                    key={line.productId}
                    line={line}
                    excluded={excludedProductIds.has(line.productId)}
                    onToggle={toggleCartLine}
                  />
                ))
              )}
            </div>

            <CartSummary
              activeCount={activeCount}
              excludedCount={excludedCount}
              total={total}
              barcodeString={barcodeString}
              hasAnyItem={!isEmpty}
              allSelected={excludedProductIds.size === 0}
              onSelectAll={handleSelectAll}
              onBuyAll={handleBuyAll}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        message={confirmMessage}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          confirmAction?.();
          setConfirmOpen(false);
        }}
      />
    </>
  );
}
