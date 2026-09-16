// components/sidebar/ThumbIcon.tsx
"use client";
import { useEffect, useState } from "react";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { getProductIcon } from "@/lib/data/icons";
import { getProductThumbnail } from "@/lib/three/thumbnails";

/**
 * ⭐ Thumbnail ของสินค้า (lazy) — ใช้ร่วมกันระหว่าง RoomTree และ ZoneAddModal
 *    ถ้ายังสร้าง thumbnail ไม่เสร็จ ใช้ emoji จาก getProductIcon() แทน
 */
export default function ThumbIcon({ productId }: { productId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      const u = getProductThumbnail(productId);
      if (!cancelled) setUrl(u);
    };

    if (typeof (window as any).requestIdleCallback !== "undefined") {
      (window as any).requestIdleCallback(run, { timeout: 1200 });
    } else {
      setTimeout(run, 200);
    }

    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (url) return <img src={url} alt="" />;

  const p = PRODUCT_BY_ID.get(productId);
  return (
    <span className="icon-fallback">{p ? getProductIcon(p) : "📦"}</span>
  );
}
