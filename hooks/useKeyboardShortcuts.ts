// hooks/useKeyboardShortcuts.ts
"use client";
import { useEffect } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { loadFromStorage } from "@/lib/state/storage";
import { CATALOG_SEARCH_INPUT_ID } from "@/lib/data/constants";
import { useSaveState } from "./useSaveState";

export function useKeyboardShortcuts() {
  const { saveState } = useSaveState();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const code = e.code;

      // ===== Escape: floating filter panel ปิดก่อนเสมอ =====
      //   (คำค้น/ตัวกรองยังอยู่ — ต่างจาก Escape ในช่องค้นหาที่ล้างค่า)
      if (
        (key === "escape" || code === "Escape") &&
        useRoomTwin.getState().catalogFiltersOpen
      ) {
        e.preventDefault();
        useRoomTwin.getState().setCatalogFiltersOpen(false);
        return;
      }

      // ===== ช่องค้นหาสินค้า: ปล่อยให้เป็นหน้าที่ของ input =====
      //   Escape → ล้างคำค้น/ตัวกรอง + เลิกโฟกัส (ไม่ไปสั่ง cancelPlacing/closeItemPanel)
      //   Ctrl/⌘+Z|Y → ให้ browser ทำ undo/redo ของข้อความเอง
      const target = e.target as HTMLElement | null;
      if (target && target.id === CATALOG_SEARCH_INPUT_ID) {
        if (key === "escape" || code === "Escape") {
          e.preventDefault();
          useRoomTwin.getState().clearCatalogSearch();
          target.blur();
          return;
        }
        if (
          ctrl &&
          (key === "z" || key === "y" || code === "KeyZ" || code === "KeyY")
        ) {
          return;
        }
      }

      // ===== Undo / Redo =====
      if (
        ctrl &&
        (key === "z" || key === "y" || code === "KeyZ" || code === "KeyY")
      ) {
        // ⭐ ขณะ Blocks Editor เปิดอยู่ → ให้ editor จัดการ draft history ของตัวเอง
        //    (global undo/redo ต้องไม่ทำงาน เพราะ draft ยังไม่ถูก apply)
        if (useRoomTwin.getState().blocksEditorOpen) return;

        e.preventDefault();
        e.stopPropagation();
        const isShift = e.shiftKey;
        const store = useRoomTwin.getState();

        const isRedo =
          (key === "z" && isShift) ||
          (key === "y" && !isShift) ||
          (code === "KeyZ" && isShift);

        const snapshot = isRedo ? store.redo() : store.undo();
        if (snapshot) {
          // restore logic อยู่ใน component ที่ subscribe history
          window.dispatchEvent(
            new CustomEvent("roomtwin:restore", { detail: snapshot }),
          );
        }
        return;
      }

      // ===== Escape =====
      if (key === "escape" || code === "Escape") {
        e.preventDefault();
        const store = useRoomTwin.getState();

        // ⭐ Blocks Editor เปิดอยู่ → ปิด editor ก่อน (ไม่ apply draft)
        if (store.blocksEditorOpen) {
          store.setBlocksEditorOpen(false);
          return;
        }
        if (store.placingProductId || store.placingZoneId) {
          store.cancelPlacing();
          return;
        }
        if (store.pendingZoneChooserUid) {
          store.setPendingZoneChooser(null);
          return;
        }
        if (store.selectedZoneUid) {
          store.deselectZone();
          return;
        }
        if (store.selectedUid) {
          store.closeItemPanel();
          return;
        }
        if (store.customizeTargetUid) {
          store.setCustomizeTarget(null);
          return;
        }
        if (store.swapTargetUid) {
          store.setSwapTarget(null);
          return;
        }
        // ปิด panels ที่เป็น local state
        window.dispatchEvent(new CustomEvent("roomtwin:closePanels"));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}