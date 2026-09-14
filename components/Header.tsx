// components/Header.tsx
"use client";
import { useRoomTwin } from "@/lib/state/store";
import { WALL_COLORS } from "@/lib/data/constants";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { hexOf, priceStr } from "@/lib/utils/format";
import { applySurface } from "@/lib/three/roomShell";
import { useSaveState } from "@/hooks/useSaveState";
import { openConfirm } from "@/components/modals";

export default function Header() {
  const surface = useRoomTwin((s) => s.surface);
  const setSurface = useRoomTwin((s) => s.setSurface);
  const setCurrentWallIdx = useRoomTwin((s) => s.setCurrentWallIdx);
  const placedItems = useRoomTwin((s) => s.placedItems);
  const cartExcluded = useRoomTwin((s) => s.cartExcluded);
  const history = useRoomTwin((s) => s.history);
  const historyIndex = useRoomTwin((s) => s.historyIndex);
  const resetAll = useRoomTwin((s) => s.resetAll);

  const { saveState } = useSaveState();

  // ===== Cart counts / total =====
  const activeItems = placedItems.filter(
    (i) => !cartExcluded.has(i.productId),
  );
  const activeCount = activeItems.length;
  const total = activeItems.reduce(
    (s, i) => s + (PRODUCT_BY_ID.get(i.productId)?.price || 0),
    0,
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // ===== Handlers =====
  const handleWallColor = (idx: number, color: number) => {
    setCurrentWallIdx(idx);
    setSurface({ wallAll: color, wallUniform: true });
    applySurface();
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
    window.dispatchEvent(
      new CustomEvent("roomtwin:toggleRoomStructure"),
    );
  };

  const handleReset = () => {
    openConfirm(
      "รีเซ็ตห้องกลับเป็นค่าเริ่มต้น? ของที่วางไว้ทั้งหมดจะถูกลบ (ขนาดห้องจะคงอยู่)",
      () => {
        resetAll();
        rebuildAfterReset();
        saveState();
      },
    );
  };

  return (
    <header>
      <div className="brand">
        <h1>RoomTwin</h1>
        <span>ลองแต่งก่อนซื้อจริง</span>
      </div>

      {/* ===== Wall color picker ===== */}
      <div className="wall-picker">
        <span className="lbl">สีผนัง</span>
        {WALL_COLORS.map((c, i) => (
          <div
            key={i}
            className={`swatch${
              surface.wallUniform && surface.wallAll === c
                ? " active"
                : ""
            }`}
            data-wall={i}
            style={{ background: hexOf(c) }}
            onClick={() => handleWallColor(i, c)}
          />
        ))}
      </div>

      {/* ===== Undo / Redo ===== */}
      <div className="history-controls">
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
      </div>

      {/* ===== Cart ===== */}
      <button
        type="button"
        className="cart-btn"
        id="cartBtn"
        title="ของที่อยู่ในห้อง"
        onClick={handleToggleCart}
      >
        <span className="cart-icon">
          🛒
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

      {/* ===== Room size ===== */}
      <button
        type="button"
        className="reset-btn"
        id="roomSizeBtn"
        title="ปรับขนาดห้อง"
        onClick={handleToggleRoomSize}
      >
        📐 <span className="rsp-btn-label">ขนาดห้อง</span>
      </button>

      {/* ===== Reset ===== */}
      <button
        type="button"
        className="reset-btn"
        id="resetBtn"
        onClick={handleReset}
      >
        รีเซ็ตห้อง
      </button>
    </header>
  );
}

// ============================================================
// Rebuild after reset
// ============================================================

function rebuildAfterReset() {
  // ลบ Three.js objects ทั้งหมด + rebuild shell + seed default
  Promise.all([
    import("@/lib/three/instantiate"),
    import("@/lib/three/roomShell"),
  ]).then(([{ removeInstantiated, instantiate }, { rebuildRoomShell, applySurface, rebuildBaseboards }]) => {
    const store = useRoomTwin.getState();

    // 1. Remove all objects
    store.placedItems.forEach((item) => {
      removeInstantiated(item.uid);
    });

    // 2. Rebuild shell
    rebuildRoomShell();
    applySurface();

    // 3. Seed default door + window
    const room = store.room;
    if (room.shape === "rect") {
      // Door on front wall
      const doorUid = "i" + Math.random().toString(36).slice(2, 10);
      const doorItem = {
        uid: doorUid,
        productId: "door",
        params: {
          w: 95,
          d: 6,
          h: 205,
          color: 0xc9a776,
          frameColor: 0xf7f3ea,
        },
        wallMount: true,
        wallId: "front",
        u: -1.35,
        v: 0.03,
        rotY: Math.PI,
        rotZ: 0,
      };
      store.addItem(doorItem as any);
      instantiate(doorItem);

      // Window on back wall
      const winUid = "i" + Math.random().toString(36).slice(2, 10);
      const winItem = {
        uid: winUid,
        productId: "window",
        params: {
          w: 110,
          d: 6,
          h: 130,
          color: 0xcfe0e8,
          frameColor: 0xf7f3ea,
          glassColor: 0xcfe0e8,
          hasCurtains: false,
          curtainColor: 0xd8b7ae,
        },
        wallMount: true,
        wallId: "back",
        u: 1.15,
        v: 1.55,
        rotY: 0,
        rotZ: 0,
      };
      store.addItem(winItem as any);
      instantiate(winItem);
    }

    rebuildBaseboards();
  });
}