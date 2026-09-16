// hooks/useTreeItemDrag.ts
//
// ⭐ ลาก item ใน RoomTree (แท็บ "ห้องของฉัน") เพื่อย้ายโซน / จัดลำดับภายในโซน
//    - pointer events + ghost (เหมือน hooks/useCardDrag.ts) ไม่ใช้ library
//    - commit ผ่าน moveItemIntoZoneFull() เท่านั้น (store เป็น source of truth)
//    - tap (ไม่ลาก) = select item บน pointerup แบบเดียวกับโปรโตไทป์
//      (ไม่พึ่ง click event หลังลาก — กัน select ผิดแถวหลัง state เปลี่ยน)
"use client";
import { useCallback, useEffect, useRef } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { getProductIcon } from "@/lib/data/icons";
import { getProductThumbnail } from "@/lib/three/thumbnails";
import { moveItemIntoZoneFull } from "@/lib/three/zoneActions";
import { useSaveState } from "./useSaveState";

const DRAG_THRESHOLD = 6;

/** ⭐ ลากได้ทีละ pointer เท่านั้น (กัน multi-touch ลากซ้อน/ทิ้ง listener ค้าง) */
let activeCleanup: (() => void) | null = null;

/** zoneUid: null = กลุ่ม "ของลอย", undefined = ไม่มีกลุ่มเป้าหมาย */
interface DropTarget {
  zoneUid: string | null | undefined;
  insertBeforeUid: string | null;
}

export function useTreeItemDrag() {
  const { saveState } = useSaveState();
  const cleanupRef = useRef<(() => void) | null>(null);

  // ⭐ กัน ghost/cursor/คลาส ค้างถ้า component ถูก unmount ระหว่างลาก
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const startDrag = useCallback(
    (
      e: React.PointerEvent,
      uid: string,
      rowEl: HTMLElement,
      onTap?: () => void,
    ) => {
      if (e.button !== 0) return;
      // ปุ่มในแถว (↗ / 🗑) ต้องไม่เริ่มลาก
      if ((e.target as HTMLElement).closest(".tree-action-btn")) return;

      activeCleanup?.();

      const startX = e.clientX;
      const startY = e.clientY;
      let moved = false;
      let ghostEl: HTMLElement | null = null;
      let target: DropTarget = { zoneUid: undefined, insertBeforeUid: null };

      function clearIndicators() {
        document
          .querySelectorAll(".tree-item.drop-before")
          .forEach((el) => el.classList.remove("drop-before"));
        document
          .querySelectorAll(".tree-group-head.drop-target")
          .forEach((el) => el.classList.remove("drop-target"));
      }

      function cleanup() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (ghostEl) {
          ghostEl.remove();
          ghostEl = null;
        }
        rowEl.classList.remove("dragging");
        clearIndicators();
        if (cleanupRef.current === cleanup) cleanupRef.current = null;
        if (activeCleanup === cleanup) activeCleanup = null;
      }

      /** สร้าง ghost — ใช้ DOM API + textContent (displayName เป็นข้อความจาก user) */
      function makeGhost(): HTMLElement | null {
        const item = useRoomTwin
          .getState()
          .placedItems.find((i) => i.uid === uid);
        if (!item) return null;
        const product = PRODUCT_BY_ID.get(item.productId);
        if (!product) return null;

        const el = document.createElement("div");
        el.className = "tree-drag-ghost";

        const icon = document.createElement("span");
        icon.className = "ghost-icon";
        const thumb = getProductThumbnail(item.productId);
        if (thumb) {
          const img = document.createElement("img");
          img.src = thumb;
          img.alt = "";
          icon.appendChild(img);
        } else {
          icon.textContent = getProductIcon(product);
        }

        const name = document.createElement("span");
        name.textContent = item.displayName || product.name;

        el.appendChild(icon);
        el.appendChild(name);
        document.body.appendChild(el);
        return el;
      }

      function detectTarget(x: number, y: number): DropTarget {
        const el = document.elementFromPoint(x, y);
        if (!el) return { zoneUid: undefined, insertBeforeUid: null };
        const group = el.closest(".tree-group") as HTMLElement | null;
        if (!group) return { zoneUid: undefined, insertBeforeUid: null };

        const isStandalone = group.dataset.standalone === "1";
        const zUid = group.dataset.zoneUid;
        if (!isStandalone && !zUid)
          return { zoneUid: undefined, insertBeforeUid: null };

        let insertBeforeUid: string | null = null;
        // กลุ่มที่ย่ออยู่ → ไม่มีแถวให้เทียบ → ต่อท้ายโซน
        if (!group.classList.contains("collapsed")) {
          const rows =
            group.querySelectorAll<HTMLElement>(".tree-items .tree-item");
          for (const row of Array.from(rows)) {
            const r = row.getBoundingClientRect();
            if (y < r.top + r.height / 2) {
              const iu = row.dataset.uid;
              if (iu && iu !== uid) insertBeforeUid = iu;
              break;
            }
          }
        }

        return {
          zoneUid: isStandalone ? null : zUid!,
          insertBeforeUid,
        };
      }

      function updateIndicator() {
        clearIndicators();
        const targetZone = target.zoneUid;
        if (targetZone === undefined) return;

        const group =
          targetZone === null
            ? document.querySelector<HTMLElement>(
                '.tree-group[data-standalone="1"]',
              )
            : document.querySelector<HTMLElement>(
                `.tree-group[data-zone-uid="${CSS.escape(targetZone)}"]`,
              );
        if (!group) return;

        group
          .querySelector(".tree-group-head")
          ?.classList.add("drop-target");

        const dragged = useRoomTwin
          .getState()
          .placedItems.find((i) => i.uid === uid);
        const currentZone = dragged ? dragged.zoneUid ?? null : null;

        // ⭐ เส้นบอกตำแหน่งแทรกเฉพาะตอนจัดลำดับในโซนเดิม
        if (currentZone === targetZone && target.insertBeforeUid) {
          document
            .querySelector<HTMLElement>(
              `.tree-item[data-uid="${CSS.escape(target.insertBeforeUid)}"]`,
            )
            ?.classList.add("drop-before");
        }
      }

      function onMove(me: PointerEvent) {
        if (!moved) {
          if (
            Math.hypot(me.clientX - startX, me.clientY - startY) <=
            DRAG_THRESHOLD
          )
            return;
          moved = true;
          ghostEl = makeGhost();
          if (!ghostEl) {
            // ไม่มี ghost = ลากไม่ได้ (ข้อมูลสินค้าหาย) → ยกเลิก
            moved = false;
            cleanup();
            return;
          }
          rowEl.classList.add("dragging");
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
        }

        me.preventDefault();
        if (ghostEl) {
          ghostEl.style.left = me.clientX + "px";
          ghostEl.style.top = me.clientY + "px";
        }

        target = detectTarget(me.clientX, me.clientY);
        updateIndicator();
      }

      function onUp() {
        const wasMoved = moved;
        const dropTarget = target;
        cleanup();

        // tap → select item (pointerup ทำงานทั้ง mouse และ touch)
        if (!wasMoved) {
          onTap?.();
          return;
        }

        const targetZone = dropTarget.zoneUid;
        if (targetZone === undefined) return;
        const store = useRoomTwin.getState();
        const dragged = store.placedItems.find((i) => i.uid === uid);
        if (!dragged) return;

        const currentZone = dragged.zoneUid ?? null;
        const insertBefore = dropTarget.insertBeforeUid;
        // same zone + ไม่มีจุดแทรก = ไม่มีอะไรเปลี่ยน (ไม่กิน history)
        if (currentZone === targetZone && !insertBefore) return;
        if (insertBefore === uid) return;

        moveItemIntoZoneFull(uid, targetZone, insertBefore ?? undefined);
        saveState();

        // ⭐ ขยายกลุ่มปลายทางที่ย่ออยู่ ให้เห็นของที่ย้ายเข้า
        if (targetZone) {
          window.dispatchEvent(
            new CustomEvent("roomtwin:treeExpandZone", {
              detail: { zuid: targetZone },
            }),
          );
        }
      }

      function onCancel() {
        cleanup();
      }

      cleanupRef.current = cleanup;
      activeCleanup = cleanup;
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
    },
    [saveState],
  );

  return { startDrag };
}
