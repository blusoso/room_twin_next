// hooks/useKeyboardShortcuts.ts
"use client";
import { useEffect } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { loadFromStorage } from "@/lib/state/storage";
import { useSaveState } from "./useSaveState";

export function useKeyboardShortcuts() {
  const { saveState } = useSaveState();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const code = e.code;

      // ===== Undo / Redo =====
      if (
        ctrl &&
        (key === "z" || key === "y" || code === "KeyZ" || code === "KeyY")
      ) {
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