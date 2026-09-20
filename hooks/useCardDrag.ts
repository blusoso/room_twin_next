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
const TOUCH_LONG_PRESS_MS = 260;
const TOUCH_CANCEL_PX = 10;

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
  pointerType: string;
}

export interface PlaceResult {
  uid: string | null;
  error?: string;
}

export interface DragCallbacks {
  onPressStart?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
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
      callbacks?: DragCallbacks,
    ) => {
      if ("button" in e && e.button !== undefined && e.button !== 0) return;

      const pointerType =
        "pointerType" in e ? (e as PointerEvent).pointerType : "mouse";
      const isTouch = pointerType === "touch";

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
        pointerType,
      };

      document.body.classList.add("rt-pressing");
      callbacks?.onPressStart?.();

      let longPressTimer: number | null = null;
      let longPressFired = false;

      const beginDrag = () => {
        if (state.moved) return;
        state.moved = true;

        document.body.classList.remove("rt-pressing");
        document.body.classList.add("rt-dragging");
        callbacks?.onDragStart?.();

        // ⭐ เพิ่ม class is-dragging ให้การ์ดต้นทาง
        if (state.cardEl) {
          state.cardEl.classList.add("is-dragging");
        }

        state.ghostEl = makeGhost(state);
        document.body.style.userSelect = "none";

        if (isTouch && "vibrate" in navigator) {
          try {
            navigator.vibrate?.(8);
          } catch {
            /* ignore */
          }
        }
      };

      if (isTouch) {
        longPressTimer = window.setTimeout(() => {
          longPressFired = true;
          beginDrag();
        }, TOUCH_LONG_PRESS_MS);
      }

      const onMove = (me: PointerEvent) => {
        const dx = me.clientX - state.startX;
        const dy = me.clientY - state.startY;
        const dist = Math.hypot(dx, dy);

        if (isTouch && !longPressFired && !state.moved) {
          if (dist > TOUCH_CANCEL_PX) {
            if (longPressTimer) {
              clearTimeout(longPressTimer);
              longPressTimer = null;
            }
            return;
          }
        }

        if (!isTouch && !state.moved && dist > DRAG_THRESHOLD) {
          beginDrag();
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

      const cleanup = () => {
        document.body.classList.remove("rt-pressing", "rt-dragging");
        document.body.style.userSelect = "";
        document
          .getElementById("viewportWrap")
          ?.classList.remove("drag-over");
        state.ghostEl?.remove();

        // ⭐ ลบ class is-dragging เสมอ (ทั้ง drop, cancel, tap)
        if (state.cardEl) {
          state.cardEl.classList.remove("is-dragging");
        }

        callbacks?.onDragEnd?.();
      };

      const onUp = (ue: PointerEvent) => {
        if (longPressTimer) clearTimeout(longPressTimer);

        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);

        const store = useRoomTwin.getState();

        if (state.moved) {
          const armedId = store.placingProductId;
          const armedTheme = store.placingThemeId;
          const draggingArmedCard =
            armedId === state.id && armedTheme === (state.themeId || null);

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
            if (typeof window !== "undefined" && window.innerWidth <= 820) {
              store.collapseDrawer();
            }
          }

          if (armedId && !draggingArmedCard) store.cancelPlacing();

          requestAnimationFrame(cleanup);
          return;
        }

        cleanup();

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

/* ============================================================
   Helpers
   ============================================================ */

function highlightCard(cardEl: HTMLElement) {
  document
    .querySelectorAll(".item-card")
    .forEach((c) => c.classList.remove("placing"));
  cardEl.classList.add("placing");
}

/* ============================================================
   ⭐ makeGhost — dispatch ตาม kind
   ============================================================ */

function makeGhost(state: DragState): HTMLElement {
  if (state.kind === "zone") return makeZoneGhost(state);
  return makeProductGhost(state);
}

/* ============================================================
   ⭐ Ghost ของ Product / Themed
   ============================================================ */

function makeProductGhost(state: DragState): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "drag-ghost gh-zone gh-product";
  wrap.setAttribute("aria-hidden", "true");

  const card = state.cardEl;
  const dataEmojis = card?.dataset?.emojis;
  const dataCount = card?.dataset?.count;
  const dataTile = card?.dataset?.tile;

  const product = PRODUCT_BY_ID.get(state.id);
  const theme = state.themeId ? THEME_BY_ID.get(state.themeId) : null;

  const fallbackEmoji = "📦";
  const emojis = (dataEmojis && dataEmojis.length ? dataEmojis : fallbackEmoji)
    .split("|")
    .filter(Boolean);

  const fallbackColor = state.themeId
    ? themedSwatchColor(state.id, state.themeId)
    : product?.color ?? 0xcccccc;
  const tile = dataTile || hexOf(fallbackColor);

  let badgeText = "";
  if (dataCount) {
    badgeText = `${dataCount} ขนาด`;
  } else if (state.kind === "themed" && theme) {
    badgeText = theme.name;
  }

  const gh = document.createElement("div");
  gh.className = "gh";
  gh.style.setProperty("--gh-tile", tile);

  const ge = document.createElement("span");
  ge.className = "ge";
  ge.innerHTML = emojis.map((e) => `<span>${e}</span>`).join("");
  gh.appendChild(ge);

  if (badgeText) {
    const badge = document.createElement("i");
    badge.textContent = badgeText;
    gh.appendChild(badge);
  }

  wrap.appendChild(gh);

  const name =
    (state.themeId && themeDisplayName(state.id, state.themeId)) ||
    product?.name ||
    "";
  if (name) wrap.title = name;

  document.body.appendChild(wrap);
  return wrap;
}

/* ============================================================
   ⭐ Ghost ของ Zone
   ============================================================ */

function makeZoneGhost(state: DragState): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "drag-ghost gh-zone";
  wrap.setAttribute("aria-hidden", "true");

  const card = state.cardEl;
  const dataEmojis = card?.dataset?.emojis;
  const dataCount = card?.dataset?.count;
  const dataTile = card?.dataset?.tile;

  const z = ZONE_BY_ID.get(state.id);
  const fallbackEmoji = z?.icon || "🏠";

  const emojis = (dataEmojis && dataEmojis.length ? dataEmojis : fallbackEmoji)
    .split("|")
    .filter(Boolean);

  const count = dataCount ?? String(z?.slots?.length ?? 0);
  const tile = dataTile || (z ? hexOf(z.color) : "#b8752e");

  const gh = document.createElement("div");
  gh.className = "gh";
  gh.style.setProperty("--gh-tile", tile);

  const ge = document.createElement("span");
  ge.className = "ge";
  ge.innerHTML = emojis.map((e) => `<span>${e}</span>`).join("");
  gh.appendChild(ge);

  const badge = document.createElement("i");
  badge.textContent = `${count} ชิ้น`;
  gh.appendChild(badge);

  wrap.appendChild(gh);

  if (z?.name) wrap.title = z.name;

  document.body.appendChild(wrap);
  return wrap;
}