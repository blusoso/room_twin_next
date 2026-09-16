// hooks/useCatalogSearchShortcut.ts
// ⭐ ทางลัดโฟกัสช่องค้นหาสินค้า: "/" หรือ Ctrl/⌘+K (ใช้ได้จากทุกแท็บ)
"use client";
import { useEffect } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { CATALOG_SEARCH_INPUT_ID } from "@/lib/data/constants";

const MOBILE_MAX_WIDTH = 820;

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable === true
  );
}

export function useCatalogSearchShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const isSlash = !ctrl && (key === "/" || e.code === "Slash");
      const isCtrlK = ctrl && (key === "k" || e.code === "KeyK");

      if (!isSlash && !isCtrlK) return;
      if (isTypingTarget(e.target)) return;

      e.preventDefault();

      const store = useRoomTwin.getState();

      // ต้องอยู่แท็บ "สร้างห้อง" ก่อน ไม่งั้น BuildPanel (และช่องค้นหา) ไม่ถูก mount
      if (store.activePanel !== "build") store.setActivePanel("build");

      if (
        typeof window !== "undefined" &&
        window.innerWidth <= MOBILE_MAX_WIDTH &&
        !store.drawerExpanded
      ) {
        store.expandDrawer();
      }

      store.requestCatalogSearchFocus();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
