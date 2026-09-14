// components/cart/CartHeader.tsx
"use client";

interface Props {
  date: string;
  receiptNumber: string;
}

export default function CartHeader({ date, receiptNumber }: Props) {
  return (
    <div className="cart-head">
      <div className="cart-brand">RoomTwin</div>
      <div className="cart-subtitle">ใบเสร็จของแต่งห้อง</div>
      <hr className="cart-rule" />
      <div className="cart-datetime">
        <span>{date}</span>
        <span>{receiptNumber}</span>
      </div>
    </div>
  );
}