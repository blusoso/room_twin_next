// components/Header.tsx
"use client";
import { useRoomTwin } from "@/lib/state/store";
import { Box, Eye, Sun, ShoppingCart } from "lucide-react";
import { WALL_COLORS } from "@/lib/data/constants";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { hexOf, priceStr } from "@/lib/utils/format";
import { applySurface } from "@/lib/three/roomShell";
import { useSaveState } from "@/hooks/useSaveState";
import { openConfirm, openSaveShareDialog } from "@/components/modals";
import { objectsByUid, roomGroup } from "@/lib/three/scene";

export default function Header() {
  const surface = useRoomTwin((s) => s.surface);
  const setSurface = useRoomTwin((s) => s.setSurface);
  const setCurrentWallIdx = useRoomTwin((s) => s.setCurrentWallIdx);
  const placedItems = useRoomTwin((s) => s.placedItems);
  const cartExcluded = useRoomTwin((s) => s.cartExcluded);
  const history = useRoomTwin((s) => s.history);
  const historyIndex = useRoomTwin((s) => s.historyIndex);
  const activeCloudRoomId = useRoomTwin((s) => s.activeCloudRoomId);

  const { saveState } = useSaveState();

  const activeItems = placedItems.filter((i) => !cartExcluded.has(i.productId));
  const activeCount = activeItems.length;
  const total = activeItems.reduce(
    (s, i) => s + (PRODUCT_BY_ID.get(i.productId)?.price || 0),
    0,
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleWallColor = (idx: number, color: number) => {
    setCurrentWallIdx(idx);
    setSurface({ wallAll: color, wallUniform: true });
    applySurface(); // ⭐ calls syncPartitionColors internally
    saveState();
  };

  const handleUndo = () => {
    const store = useRoomTwin.getState();
    const snapshot = store.undo();
    if (snapshot) {
      window.dispatchEvent(
        new CustomEvent("roomtwin:restore", { detail: snapshot }),
      );
    }
  };

  const handleRedo = () => {
    const store = useRoomTwin.getState();
    const snapshot = store.redo();
    if (snapshot) {
      window.dispatchEvent(
        new CustomEvent("roomtwin:restore", { detail: snapshot }),
      );
    }
  };

  const handleToggleCart = () => {
    window.dispatchEvent(new CustomEvent("roomtwin:toggleCart"));
  };

  const handleToggleRoomSize = () => {
    window.dispatchEvent(new CustomEvent("roomtwin:toggleRoomStructure"));
  };

  const handleReset = () => {
    openConfirm(
      "ลบเฟอร์นิเจอร์และของแต่งทั้งหมดออก? " +
        "(ขนาดห้อง สี และประตู/หน้าต่างจะคงอยู่)",
      async () => {
        const store = useRoomTwin.getState();

        const openings: typeof store.placedItems = [];
        const toRemove: typeof store.placedItems = [];

        store.placedItems.forEach((item) => {
          if (item.productId === "door" || item.productId === "window") {
            openings.push(item);
          } else {
            toRemove.push(item);
          }
        });

        toRemove.forEach((item) => {
          const obj = objectsByUid.get(item.uid);
          if (obj) {
            roomGroup.remove(obj);
            obj.traverse((child: any) => {
              child.geometry?.dispose?.();
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((m: any) => m?.dispose?.());
                } else {
                  child.material.dispose?.();
                }
              }
            });
          }
          objectsByUid.delete(item.uid);
        });

        const keptRoom = store.room;
        const keptSurface = store.surface;

        store.resetAll();

        useRoomTwin.setState({
          room: keptRoom,
          surface: keptSurface,
          placedItems: openings,
        });

        await new Promise((r) => setTimeout(r, 0));

        const {
          rebuildRoomShell,
          applySurface: apply,
          rebuildBaseboards,
        } = await import("@/lib/three/roomShell");
        rebuildRoomShell();
        apply();

        const { instantiate } = await import("@/lib/three/instantiate");
        const { objectsByUid: objMap } = await import("@/lib/three/scene");

        openings.forEach((item) => {
          if (!objMap.has(item.uid)) {
            instantiate(item);
          }
        });

        rebuildBaseboards();
        saveState();
      },
    );
  };

  const handleToggleView = () => {
    window.dispatchEvent(new CustomEvent("roomtwin:toggleView"));
  }

  const handleToggleLighting = () => {
    window.dispatchEvent(new CustomEvent("roomtwin:toggleLighting"));
  }

  return (
    <header className="relative w-full px-6 py-5 flex items-start justify-between z-50 select-none">
      <div className="brand flex items-center z-10">
        <img
          src="/assets/roomtwin_logo.png"
          alt="RoomTwin Logo"
          className="h-12 md:h-14 object-contain"
        />
        {/* <span>ลองแต่งก่อนซื้อจริง</span> */}
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex justify-between items-center -space-x-3 z-20">
        <button className="circle-btn--primary" onClick={handleToggleRoomSize}>
            <Box size="1.1rem" strokeWidth={2.5} />
        </button>
        <button className="circle-btn--primary" onClick={handleToggleView}>
            <Eye size="1.1rem" strokeWidth={2.5} />
        </button>
        <button className="circle-btn--primary" onClick={handleToggleLighting}>
            <Sun size="1.1rem" strokeWidth={2.5} />
        </button>
      </div>

      {/* <div className="history-controls">
        <button
          type="button"
          className="icon-header-btn"
          id="undoBtn"
          title="ย้อนกลับ (Ctrl+Z)"
          disabled={!canUndo}
          onClick={handleUndo}
        >
          ↩
        </button>
        <button
          type="button"
          className="icon-header-btn"
          id="redoBtn"
          title="ทำซ้ำ (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={handleRedo}
        >
          ↪
        </button>
      </div> */}
      <div className="flex items-center gap-3 z-10">
        <button
          type="button"
          className="cart-btn"
          id="cartBtn"
          onClick={handleToggleCart}
        >
          <span className="cart-icon">
            <ShoppingCart size="1.1rem" strokeWidth={2.5} />
            <span
              className="cart-count"
              id="cartCount"
              style={{ display: activeCount > 0 ? "flex" : "none" }}
            >
              {activeCount}
            </span>
          </span>
          <span className="cart-total" id="cartBtnTotal">
            {priceStr(total)}
          </span>
        </button>
      </div>

      {/* <button
        type="button"
        className="reset-btn"
        id="roomSizeBtn"
        title="ปรับขนาดห้อง"
        onClick={handleToggleRoomSize}
      >
        📐 <span className="rsp-btn-label">ขนาดห้อง</span>
      </button>

      <button
        type="button"
        className="reset-btn"
        id="saveShareBtn"
        title={
          activeCloudRoomId
            ? "บันทึกทับไฟล์เดิม หรือแชร์ลิงก์ให้เพื่อน"
            : "บันทึกขึ้นเซิร์ฟเวอร์ หรือแชร์ลิงก์ให้เพื่อน"
        }
        onClick={openSaveShareDialog}
      >
        💾 <span className="rsp-btn-label">บันทึก / แชร์</span>
      </button>

      <button
        type="button"
        className="reset-btn"
        id="resetBtn"
        onClick={handleReset}
      >
        รีเซ็ตห้อง
      </button> */}
    </header>
  );
}
