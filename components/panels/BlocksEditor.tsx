// components/panels/BlocksEditor.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { ROOM_DEFAULT } from "@/lib/data/constants";
import { rebuildRoomShell } from "@/lib/three/roomShell";
import { reclampAllToRoom } from "@/lib/three/reclamp";
import { useSaveState } from "@/hooks/useSaveState";

const CELL_PX_BASE = 22;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

function cellKey(i: number, j: number) {
  return `${i},${j}`;
}

function computeExtent(roomW: number, roomD: number, cellSize: number) {
  const maxDim = Math.max(roomW, roomD, 6);
  const half = Math.ceil(maxDim / 2 / cellSize) + 4;
  return Math.max(10, Math.min(20, half));
}

function initBlocksFromRect(w: number, d: number, cellSize: number) {
  const cellsW = Math.max(1, Math.round(w / cellSize));
  const cellsD = Math.max(1, Math.round(d / cellSize));
  const halfW = Math.floor(cellsW / 2);
  const halfD = Math.floor(cellsD / 2);
  const blocks = new Set<string>();
  for (let i = -halfW; i < cellsW - halfW; i++) {
    for (let j = -halfD; j < cellsD - halfD; j++) {
      blocks.add(cellKey(i, j));
    }
  }
  return blocks;
}

function computeBBox(blocks: Set<string>, cellSize: number) {
  if (blocks.size === 0) return null;
  let minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity;
  blocks.forEach((k) => {
    const [i, j] = k.split(",").map(Number);
    minI = Math.min(minI, i);
    maxI = Math.max(maxI, i);
    minJ = Math.min(minJ, j);
    maxJ = Math.max(maxJ, j);
  });
  return {
    minI, maxI, minJ, maxJ,
    w: (maxI - minI + 1) * cellSize,
    d: (maxJ - minJ + 1) * cellSize,
  };
}

export default function BlocksEditor() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [extent, setExtent] = useState(12);
  const [zoom, setZoom] = useState(1);
  const [paintMode, setPaintMode] = useState<"add" | "remove" | null>(null);

  const room = useRoomTwin((s) => s.room);
  const setRoom = useRoomTwin((s) => s.setRoom);
  const { saveState } = useSaveState();

  const canvasRef = useRef<HTMLDivElement>(null);

  // ===== Open from event =====
  useEffect(() => {
    const onOpen = () => {
      const r = useRoomTwin.getState().room;
      if (r.shape === "blocks" && r.blocks && r.blocks.size > 0) {
        setDraft(new Set(r.blocks));
        let m = 0;
        r.blocks.forEach((k) => {
          const [i, j] = k.split(",").map(Number);
          m = Math.max(m, Math.abs(i), Math.abs(j));
        });
        setExtent(Math.max(10, m + 4));
      } else {
        setDraft(initBlocksFromRect(r.w, r.d, r.cellSize));
        setExtent(computeExtent(r.w, r.d, r.cellSize));
      }
      setZoom(1);
      setOpen(true);
    };
    window.addEventListener("roomtwin:openBlocksEditor", onOpen);
    return () =>
      window.removeEventListener("roomtwin:openBlocksEditor", onOpen);
  }, []);

  // ===== Painting =====
  useEffect(() => {
    if (!open) return;

    const applyCell = (el: HTMLElement) => {
      const i = +el.dataset.i!;
      const j = +el.dataset.j!;
      const key = cellKey(i, j);
      setDraft((prev) => {
        const next = new Set(prev);
        if (paintMode === "add") next.add(key);
        else if (paintMode === "remove") next.delete(key);
        return next;
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!paintMode) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el?.closest?.(".blocks-cell") as HTMLElement | null;
      if (cell) applyCell(cell);
    };

    const onPointerUp = () => setPaintMode(null);

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [open, paintMode]);

  const handleCellDown = (i: number, j: number) => {
    const key = cellKey(i, j);
    const has = draft.has(key);
    setPaintMode(has ? "remove" : "add");
    setDraft((prev) => {
      const next = new Set(prev);
      if (has) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApply = () => {
    if (draft.size === 0) return;
    const store = useRoomTwin.getState();

    // remove wall items
    const hadWallItems = store.placedItems.some((i) => i.wallMount);
    if (hadWallItems) {
      store.replaceItems(store.placedItems.filter((i) => !i.wallMount));
    }

    const bb = computeBBox(draft, room.cellSize);
    if (!bb) return;

    setRoom({
      shape: "blocks",
      blocks: new Set(draft),
      w: bb.w,
      d: bb.d,
    });

    // Wait a tick for store to update
    setTimeout(() => {
      rebuildRoomShell();
      reclampAllToRoom();
      saveState();
      setOpen(false);
    }, 0);
  };

  const handleClear = () => {
    setDraft(new Set());
  };

  const handleReset = () => {
    const r = useRoomTwin.getState().room;
    setDraft(initBlocksFromRect(r.w, r.d, r.cellSize));
    setExtent(computeExtent(r.w, r.d, r.cellSize));
    setZoom(1);
  };

  const handleRect = () => {
    const r = useRoomTwin.getState().room;
    setDraft(initBlocksFromRect(r.w, r.d, r.cellSize));
  };

  const handleZoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + 0.15));
  const handleZoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - 0.15));
  const handleZoomFit = () => setZoom(1);

  const cellPx = useMemo(() => Math.round(CELL_PX_BASE * zoom), [zoom]);
  const N = extent * 2 + 1;

  const bbox = useMemo(
    () => computeBBox(draft, room.cellSize),
    [draft, room.cellSize],
  );

  return (
    <div
      className={`blocks-overlay${open ? " show" : ""}`}
      aria-hidden={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="blocks-box">
        <div className="blocks-head">
          <div className="blocks-title">
            <span>▦ วาดผนังห้อง</span>
            <span className="bt-sub">
              คลิก/ลากช่องเพื่อเพิ่ม-ลบ • 1 ช่อง = {room.cellSize} ม.
            </span>
          </div>
          <div className="blocks-head-actions">
            <button
              type="button"
              className="blocks-icon-btn"
              onClick={handleZoomOut}
            >
              −
            </button>
            <button
              type="button"
              className="blocks-icon-btn"
              onClick={handleZoomFit}
            >
              ⛶
            </button>
            <button
              type="button"
              className="blocks-icon-btn"
              onClick={handleZoomIn}
            >
              +
            </button>
            <button
              type="button"
              className="blocks-close"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="blocks-body">
          <div className="blocks-toolbar">
            <div className="blocks-tool">
              ขนาด:{" "}
              <span className="val">
                {bbox
                  ? `${bbox.w.toFixed(1)} × ${bbox.d.toFixed(1)} ม.`
                  : "0.0 × 0.0 ม."}
              </span>
            </div>
            <div className="blocks-tool-sep" />
            <div className="blocks-tool">
              บล็อก: <span className="val">{draft.size}</span>
            </div>
            <div className="blocks-tool-sep" />
            <button type="button" onClick={handleRect}>
              ⬜ เติมสี่เหลี่ยม
            </button>
            <button type="button" onClick={handleClear}>
              🗑 ล้าง
            </button>
          </div>

          <div className="blocks-canvas" ref={canvasRef}>
            <div className="blocks-grid-wrap">
              <div className="blocks-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${N}, ${cellPx}px)`, gridAutoRows: `${cellPx}px`, background: "#e6dfce", gap: 1, padding: 1, borderRadius: 4 }}>
                {Array.from({ length: N * N }).map((_, idx) => {
                  const j = Math.floor(idx / N) - extent;
                  const i = (idx % N) - extent;
                  const key = cellKey(i, j);
                  const on = draft.has(key);
                  return (
                    <div
                      key={idx}
                      data-i={i}
                      data-j={j}
                      className={`blocks-cell${on ? " on" : ""}${
                        i === 0 && j === 0 ? " origin" : ""
                      }`}
                      style={{
                        background: on ? "var(--ochre)" : "#fff",
                        cursor: "pointer",
                        position: "relative",
                        userSelect: "none",
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        handleCellDown(i, j);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="blocks-foot">
          <div className="blocks-foot-left">
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: "8px 14px",
                border: "1px solid var(--panel-line)",
                background: "#fbf8f2",
                borderRadius: 9,
                fontFamily: "inherit",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                color: "var(--ink)",
              }}
            >
              ↺ เริ่มใหม่
            </button>
            <span className="blocks-size-info">
              พื้นที่ใช้สอย:{" "}
              <b>{bbox ? (bbox.w * bbox.d).toFixed(1) : "0"}</b> ตร.ม.
            </span>
          </div>
          <button
            type="button"
            className="blocks-apply"
            disabled={draft.size === 0}
            onClick={handleApply}
          >
            ✓ ใช้รูปทรงนี้
          </button>
        </div>
      </div>
    </div>
  );
}