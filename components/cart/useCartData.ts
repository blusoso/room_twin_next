// components/cart/useCartData.ts
"use client";
import { useMemo } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import type { PlacedItem } from "@/lib/state/types";

export interface CartLine {
  productId: string;
  name: string;
  price: number;
  qty: number;
  subtotal: number;
  dims: { w: number; d: number; h: number };
}

export interface CartData {
  lines: CartLine[];
  activeLines: CartLine[];
  excludedProductIds: Set<string>;
  activeCount: number;
  excludedCount: number;
  total: number;
  isEmpty: boolean;
  receiptNumber: string;
  dateString: string;
  barcodeString: string;
}

export function useCartData(): CartData {
  const placedItems = useRoomTwin((s) => s.placedItems);
  const cartExcluded = useRoomTwin((s) => s.cartExcluded);

  return useMemo(() => {
    // ===== group by productId =====
    const byProduct = new Map<string, { qty: number; items: PlacedItem[] }>();
    placedItems.forEach((item) => {
      const cur = byProduct.get(item.productId) || { qty: 0, items: [] };
      cur.qty += 1;
      cur.items.push(item);
      byProduct.set(item.productId, cur);
    });

    const lines: CartLine[] = [];
    byProduct.forEach(({ qty }, pid) => {
      const p = PRODUCT_BY_ID.get(pid);
      if (!p) return;
      lines.push({
        productId: pid,
        name: p.name,
        price: p.price,
        qty,
        subtotal: p.price * qty,
        dims: p.dims,
      });
    });

    // ===== active / excluded =====
    const activeLines = lines.filter(
      (l) => !cartExcluded.has(l.productId),
    );
    const activeCount = activeLines.reduce((s, l) => s + l.qty, 0);
    const excludedCount = placedItems.length - activeCount;
    const total = activeLines.reduce((s, l) => s + l.subtotal, 0);

    // ===== receipt number =====
    const sorted = [...placedItems]
      .sort((a, b) => a.productId.localeCompare(b.productId))
      .map((i) => i.productId)
      .join("");
    let h = 0;
    for (let i = 0; i < sorted.length; i++) {
      h = (h << 5) - h + sorted.charCodeAt(i);
      h = h & h;
    }
    const receiptNumber =
      "NO. " + String(Math.abs(h) % 100000).padStart(5, "0");

    // ===== date =====
    const now = new Date();
    const dateString = now.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // ===== barcode string =====
    const barcodeString =
      "ROOMTWIN-" +
      String(Math.abs(total + activeCount) % 1000000).padStart(6, "0");

    return {
      lines,
      activeLines,
      excludedProductIds: cartExcluded,
      activeCount,
      excludedCount,
      total,
      isEmpty: placedItems.length === 0,
      receiptNumber,
      dateString,
      barcodeString,
    };
  }, [placedItems, cartExcluded]);
}