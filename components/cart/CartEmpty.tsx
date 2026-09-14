// components/cart/CartEmpty.tsx
"use client";

export default function CartEmpty() {
  return (
    <div className="cart-empty">
      <span className="empty-icon">🛒</span>
      ยังไม่มีของในห้อง
      <br />
      <small>ลองลากไอเทมจากด้านซ้ายมาวางดูสิ</small>
    </div>
  );
}