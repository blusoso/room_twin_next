// components/cart/CartEmpty.tsx
"use client";
import { EmptyState } from "@/components/ui";

export default function CartEmpty() {
  return (
    <EmptyState
      icon="🛒"
      title="ตะกร้าว่างเปล่า"
      sub="เลือกของในห้องก่อน — รายการที่เลือกไว้จะมาโผล่ที่นี่"
    />
  );
}