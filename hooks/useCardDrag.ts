// hooks/useCardDrag.ts
"use client";
import { useCallback } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { ZONE_BY_ID } from "@/lib/data/zones";
import {
  THEME_BY_ID,
  themeDisplayName,
  themedSwatchColor,
} from "@/lib/data/themes";
import { isOverCanvas } from "@/lib/three/raycast";
import { hexOf } from "@/lib/utils/format";

const DRAG_THRESHOLD = 8;

type DragKind = "product" | "themed" | "zone";

interface DragState {
  id: string;
  kind: DragKind;
  themeId: string | null;
  cardEl: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  ghostEl: HTMLElement | null;
}

export interface PlaceResult {
  uid: string | null;
  error?: string;
}

export interface UseCardDragOptions {
  placeProduct: (pid: string, cx: number, cy: number) => PlaceResult;
  placeThemedProduct: (
    pid: string,
    tid: string,
    cx: number,
    cy: number,
  ) => PlaceResult;
  placeZone: (zid: string, cx: number, cy: number) => PlaceResult;
}

export function useCardDrag({
  placeProduct,
  placeThemedProduct,
  placeZone,
}: UseCardDragOptions) {
  const startDrag = useCallback(
    (
      e: React.PointerEvent | PointerEvent,
      id: string,
      cardEl: HTMLElement,
      kind: DragKind,
      themeId: string | null = null,
    ) => {
      if ("button" in e && e.button !== undefined && e.button !== 0) return;

      const state: DragState = {
        id,
        kind,
        themeId,
        cardEl,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        ghostEl: null,
      };

      const onMove = (me: PointerEvent) => {
        const dx = me.clientX - state.startX;
        const dy = me.clientY - state.startY;

        if (!state.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          state.moved = true;
          state.ghostEl = makeGhost(state);
          document.body.style.userSelect = "none";
        }

        if (state.moved && state.ghostEl) {
          me.preventDefault();
          state.ghostEl.style.left = me.clientX + "px";
          state.ghostEl.style.top = me.clientY + "px";

          const viewportWrap = document.getElementById("viewportWrap");
          viewportWrap?.classList.toggle(
            "drag-over",
            isOverCanvas(me.clientX, me.clientY),
          );
        }
      };

      const onUp = (ue: PointerEvent) => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);

        document.body.style.userSelect = "";
        document.getElementById("viewportWrap")?.classList.remove("drag-over");
        state.ghostEl?.remove();

        const store = useRoomTwin.getState();

        // ===== Moved → drop in canvas =====
        if (state.moved) {
          if (isOverCanvas(ue.clientX, ue.clientY)) {
            if (state.kind === "zone") {
              placeZone(state.id, ue.clientX, ue.clientY);
            } else if (state.kind === "themed") {
              placeThemedProduct(
                state.id,
                state.themeId!,
                ue.clientX,
                ue.clientY,
              );
            } else {
              placeProduct(state.id, ue.clientX, ue.clientY);
            }
            // ⭐ ไม่ selectItem อัตโนมัติ — ไม่ให้ toolbar ขึ้นทันที
            if (typeof window !== "undefined" && window.innerWidth <= 820) {
              store.collapseDrawer();
            }
          }
          return;
        }

        // ===== Not moved → tap = toggle placing mode =====
        if (state.kind === "zone") {
          if (store.placingZoneId === state.id) {
            store.cancelPlacing();
            document
              .querySelectorAll(".item-card")
              .forEach((c) => c.classList.remove("placing"));
          } else {
            store.startPlacingZone(state.id);
            store.closeItemPanel();
            highlightCard(cardEl);
          }
        } else if (state.kind === "themed") {
          if (
            store.placingProductId === state.id &&
            store.placingThemeId === state.themeId
          ) {
            store.cancelPlacing();
            document
              .querySelectorAll(".item-card")
              .forEach((c) => c.classList.remove("placing"));
          } else {
            store.startPlacing(state.id, state.themeId);
            store.closeItemPanel();
            highlightCard(cardEl);
          }
        } else {
          if (
            store.placingProductId === state.id &&
            !store.placingThemeId
          ) {
            store.cancelPlacing();
            document
              .querySelectorAll(".item-card")
              .forEach((c) => c.classList.remove("placing"));
          } else {
            store.startPlacing(state.id, null);
            store.closeItemPanel();
            highlightCard(cardEl);
          }
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, { once: true });
      document.addEventListener("pointercancel", onUp, { once: true });
    },
    [placeProduct, placeThemedProduct, placeZone],
  );

  return { startDrag };
}

// ============================================================
// Helpers
// ============================================================

function highlightCard(cardEl: HTMLElement) {
  document
    .querySelectorAll(".item-card")
    .forEach((c) => c.classList.remove("placing"));
  cardEl.classList.add("placing");
}

function makeGhost(state: DragState): HTMLElement {
  const el = document.createElement("div");
  el.className = "drag-ghost";

  if (state.kind === "zone") {
    const z = ZONE_BY_ID.get(state.id);
    if (z) {
      el.style.background = hexOf(z.color);
      el.style.color = "#fff";
      el.textContent = z.icon + " " + z.name;
    }
  } else if (state.kind === "themed") {
    const product = PRODUCT_BY_ID.get(state.id);
    const theme = state.themeId ? THEME_BY_ID.get(state.themeId) : null;
    const color = state.themeId
      ? themedSwatchColor(state.id, state.themeId)
      : product?.color ?? 0xcccccc;
    el.style.background = hexOf(color);
    el.textContent =
      (state.themeId && themeDisplayName(state.id, state.themeId)) ||
      product?.name ||
      "";
    if (theme) el.dataset.themeId = theme.id;
  } else {
    const p = PRODUCT_BY_ID.get(state.id);
    if (p) {
      el.style.background = hexOf(p.color);
      el.textContent = p.name;
    }
  }

  document.body.appendChild(el);
  return el;
}