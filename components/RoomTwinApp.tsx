// components/RoomTwinApp.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import Header from "./Header";
import { Sidebar } from "./sidebar";
import { Viewport } from "./viewport";
import { CartDrawer } from "./cart";
import {
  ConfirmModal,
  ZoneEditModal,
  ZoneAddModal,
  SaveShareModal,
} from "./modals";
import SharedRoomLoader, { type BootStatus } from "./SharedRoomLoader";
import ShareBanner from "./ShareBanner";
import { LoadingOverlay } from "./LoadingScreen";
import { useRoomTwinInit } from "@/hooks/useRoomTwinInit";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePlacingHighlight } from "@/hooks/usePlacingHighlight";
import { useSaveState } from "@/hooks/useSaveState";
import { useRoomTwin } from "@/lib/state/store";
import { restoreSnapshot } from "@/lib/state/restore";
import { retrySharedRoom } from "@/lib/cloud/sharedRoomBoot";
import { returnToOwnRoom } from "@/lib/cloud/returnToMine";
import { showToast } from "@/lib/utils/toast";

export default function RoomTwinApp({ shareId }: { shareId?: string }) {
  useRoomTwinInit();
  useKeyboardShortcuts();
  usePlacingHighlight();

  // ⭐ สถานะ boot ของลิงก์แชร์ — แสดง overlay ทับแอปจนกว่าข้อมูลห้องจะเข้ามา
  const [boot, setBoot] = useState<BootStatus>(() =>
    shareId ? { phase: "loading" } : { phase: "ready" },
  );
  const [reloadToken, setReloadToken] = useState(0);

  const handleRetry = useCallback(() => {
    if (!shareId) return;
    retrySharedRoom(shareId); // ล้าง cache → loader จะยิง request ใหม่
    setBoot({ phase: "loading" });
    setReloadToken((n) => n + 1);
  }, [shareId]);

  const handleBackHome = useCallback(() => {
    returnToOwnRoom();
    setBoot({ phase: "ready" });
    showToast("กลับไปห้องของฉันแล้ว");
  }, []);

  return (
    <>
      <Header />
      <ShareBanner />
      <div className="layout">
        <Sidebar />
        <Viewport />
      </div>
      <CartDrawer />
      <ConfirmModal />
      <ZoneEditModal />
      <ZoneAddModal />
      <SaveShareModal />
      <div className="rotate-badge" id="rotateBadge">
        0°
      </div>
      <HistoryRestoreListener />
      <ClosePanelsListener />
      <SwapSlotListener />
      <SharedRoomLoader
        shareId={shareId}
        reloadToken={reloadToken}
        onStatus={setBoot}
      />
      {shareId ? (
        <LoadingOverlay
          show={boot.phase !== "ready"}
          error={boot.phase === "error" ? boot.message : undefined}
          message="กำลังเปิดห้องที่แชร์…"
          sub="ดึงข้อมูลห้องจากเซิร์ฟเวอร์"
          onRetry={handleRetry}
          onBackHome={handleBackHome}
        />
      ) : null}
    </>
  );
}

// ============================================================
// History restore listener (undo/redo)
// ============================================================

function HistoryRestoreListener() {
  useEffect(() => {
    const onRestore = (e: Event) => {
      const snapshot = (e as CustomEvent<string>).detail;
      if (!snapshot) return;
      restoreSnapshot(snapshot);
    };
    window.addEventListener("roomtwin:restore", onRestore);
    return () => {
      window.removeEventListener("roomtwin:restore", onRestore);
    };
  }, []);

  return null;
}

// ============================================================
// Close-panels listener (Escape)
// ============================================================

function ClosePanelsListener() {
  useEffect(() => {
    const onClose = () => {
      const store = useRoomTwin.getState();
      store.setCustomizeTarget(null);
      store.setSwapTarget(null);
      // Dispatch custom events for panels ที่เก็บ state เอง
      window.dispatchEvent(new CustomEvent("roomtwin:closeRoomStructure"));
      window.dispatchEvent(new CustomEvent("roomtwin:closeZoneTheme"));
      window.dispatchEvent(new CustomEvent("roomtwin:closeBlocksEditor"));
    };
    window.addEventListener("roomtwin:closePanels", onClose);
    return () => {
      window.removeEventListener("roomtwin:closePanels", onClose);
    };
  }, []);

  return null;
}

// ============================================================
// Swap slot listener
// ============================================================

function SwapSlotListener() {
  const { saveState } = useSaveState();

  useEffect(() => {
    const onSwap = (e: Event) => {
      const { uid, productId } = (
        e as CustomEvent<{
          uid: string;
          productId: string;
        }>
      ).detail;

      if (!uid || !productId) return;

      const store = useRoomTwin.getState();
      const item = store.placedItems.find((i) => i.uid === uid);
      if (!item) return;

      // ใช้ helper swap ครบชุด
      import("@/lib/three/zoneActions").then(({ swapZoneSlotFull }) => {
        swapZoneSlotFull(uid, productId);
        saveState();
      });
    };
    window.addEventListener("roomtwin:swapSlot", onSwap);
    return () => {
      window.removeEventListener("roomtwin:swapSlot", onSwap);
    };
  }, [saveState]);

  return null;
}
