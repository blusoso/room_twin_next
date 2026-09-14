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

  const { saveState } = useSaveState();

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

  // ============================================================
  // Reset — ลบ scene objects + reset store + seed default
  // ============================================================
  const handleReset = () => {
    openConfirm(
      "รีเซ็ตห้องกลับเป็นค่าเริ่มต้น? ของที่วางไว้ทั้งหมดจะถูกลบ (ขนาดห้องจะคงอยู่)",
      async () => {
        // ⭐ 1. ลบ Three.js objects ทั้งหมด
        const {
          objectsByUid,
          roomGroup,
          surfaceColliders,
          wallItemMaterials,
        } = await import("@/lib/three/scene");

        const uids = Array.from(objectsByUid.keys());
        uids.forEach((uid) => {
          const obj = objectsByUid.get(uid);
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
        });
        objectsByUid.clear();
        surfaceColliders.clear();
        wallItemMaterials.clear();

        // ⭐ 2. Reset store (คงขนาดห้องเดิมไว้)
        const store = useRoomTwin.getState();
        const keepRoom = store.room;

        store.resetAll();

        useRoomTwin.setState({
          room: keepRoom,
          surface: {
            floor: "wood",
            wallUniform: true,
            wallAll: WALL_COLORS[0],
            walls: {},
            ceiling: 0xf7f3ea,
          },
        });

        // ⭐ 3. รอ tick ให้ store propagate
        await new Promise((r) => setTimeout(r, 0));

        // ⭐ 4. Rebuild shell
        const {
          rebuildRoomShell,
          applySurface: apply,
          rebuildBaseboards,
        } = await import("@/lib/three/roomShell");
        rebuildRoomShell();
        apply();

        // ⭐ 5. Seed default door + window
        const { seedDefaultRoom } = await import("@/hooks/useRoomTwinInit");
        seedDefaultRoom();

        rebuildBaseboards();

        // ⭐ 6. Save
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

      <div className="wall-picker">
        <span className="lbl">สีผนัง</span>
        {WALL_COLORS.map((c, i) => (
          <div
            key={i}
            className={`swatch${
              surface.wallUniform && surface.wallAll === c ? " active" : ""
            }`}
            data-wall={i}
            style={{ background: hexOf(c) }}
            onClick={() => handleWallColor(i, c)}
          />
        ))}
      </div>

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

      <button
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
        id="resetBtn"
        onClick={handleReset}
      >
        รีเซ็ตห้อง
      </button>
    </header>
  );
}