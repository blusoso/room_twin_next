// components/panels/BlocksEditor.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { useSaveState } from "@/hooks/useSaveState";
import { rebuildRoomShell } from "@/lib/three/roomShell";
import { reclampAllToRoom } from "@/lib/three/reclamp";
import {
  captureWallItems,
  remapOrphanedWallItems,
} from "@/hooks/useRoomTwinInit";
import { LEVEL_PRESETS, LEVEL_STEP } from "@/lib/data/constants";
import {
  structurePlanItems,
  blocksOrigin,
} from "@/lib/three/structurePlan";

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
  const [draftLevels, setDraftLevels] = useState<Record<string, number>>({});
  const [extent, setExtent] = useState(12);
  const [zoom, setZoom] = useState(1);
  const [paintMode, setPaintMode] = useState<"add" | "remove" | null>(null);
  const [paintLevel, setPaintLevel] = useState(0);

  const room = useRoomTwin((s) => s.room);
  const placedItems = useRoomTwin((s) => s.placedItems);
  const { saveState } = useSaveState();
  const canvasRef = useRef<HTMLDivElement>(null);

  // ⭐ โครงสร้างห้องตามตำแหน่งจริง (ประตู/หน้าต่าง/เสา/ฉากกั้น) — overlay บนผัง
  const structPlan = useMemo(
    () => structurePlanItems(placedItems),
    [placedItems],
  );
  const structOrigin = useMemo(
    () => {
      if (room.shape === "blocks" && room.blocks && room.blocks.size > 0)
        return blocksOrigin(room.blocks);
      return blocksOrigin(draft);
    },
    [room.shape, room.blocks, draft],
  );

  // ===== Open =====
  useEffect(() => {
    const onOpen = () => {
      const r = useRoomTwin.getState().room;
      if (r.shape === "blocks" && r.blocks && r.blocks.size > 0) {
        setDraft(new Set(r.blocks));
        setDraftLevels({ ...r.cellLevels });
        let m = 0;
        r.blocks.forEach((k) => {
          const [i, j] = k.split(",").map(Number);
          m = Math.max(m, Math.abs(i), Math.abs(j));
        });
        setExtent(Math.max(10, m + 4));
      } else {
        setDraft(initBlocksFromRect(r.w, r.d, r.cellSize));
        setDraftLevels({});
        setExtent(computeExtent(r.w, r.d, r.cellSize));
      }
      setZoom(1);
      setPaintLevel(0);
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

      if (paintMode === "add") {
        // ⭐ If exists at different level → update level
        setDraft((prev) => {
          if (prev.has(key)) return prev;
          const next = new Set(prev);
          next.add(key);
          return next;
        });
        setDraftLevels((prev) => {
          if (paintLevel === 0) {
            if (prev[key] === 0 || prev[key] === undefined) return prev;
            const n = { ...prev };
            delete n[key];
            return n;
          }
          if (prev[key] === paintLevel) return prev;
          return { ...prev, [key]: paintLevel };
        });
      } else if (paintMode === "remove") {
        setDraft((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setDraftLevels((prev) => {
          if (prev[key] === undefined) return prev;
          const n = { ...prev };
          delete n[key];
          return n;
        });
      }
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
  }, [open, paintMode, paintLevel]);

  const handleCellDown = (i: number, j: number) => {
    const key = cellKey(i, j);
    const has = draft.has(key);
    const curLevel = draftLevels[key] ?? 0;

    // ⭐ If cell exists AND level matches paintLevel → toggle remove
    //    If cell exists at DIFFERENT level → repaint with new level
    //    If cell doesn't exist → add at paintLevel
    if (has && curLevel === paintLevel) {
      setPaintMode("remove");
      setDraft((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setDraftLevels((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
    } else {
      setPaintMode("add");
      setDraft((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setDraftLevels((prev) => {
        if (paintLevel === 0) {
          if (prev[key] === undefined) return prev;
          const n = { ...prev };
          delete n[key];
          return n;
        }
        if (prev[key] === paintLevel) return prev;
        return { ...prev, [key]: paintLevel };
      });
    }
  };

  // ===== Apply =====
  const handleApply = () => {
    if (draft.size === 0) return;
    const store = useRoomTwin.getState();

    // ⭐ capture wall items ก่อนปรับโครงสร้าง — ไม่อนุญาตให้ประตู/หน้าต่างหาย
    const wallSnapshots = captureWallItems();

    const bb = computeBBox(draft, room.cellSize);
    if (!bb) return;

    store.setRoom({
      shape: "blocks",
      blocks: new Set(draft),
      cellLevels: { ...draftLevels },
      w: bb.w,
      d: bb.d,
    });

    rebuildRoomShell();
    reclampAllToRoom();
    remapOrphanedWallItems(wallSnapshots);
    setOpen(false);
    saveState();
  };

  const handleClear = () => {
    setDraft(new Set());
    setDraftLevels({});
  };

  const handleReset = () => {
    const r = useRoomTwin.getState().room;
    setDraft(initBlocksFromRect(r.w, r.d, r.cellSize));
    setDraftLevels({});
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

  // ⭐ Cell color from level
  const getCellColor = (i: number, j: number) => {
    const key = cellKey(i, j);
    const on = draft.has(key);
    if (!on) return "#fff";
    const y = draftLevels[key] ?? 0;
    const t = Math.min(1, y / 1.5);
    // HSL: lightest (cream) → darkest (brown)
    const lightness = 82 - t * 32;
    return `hsl(35, 45%, ${lightness}%)`;
  };

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
            <span>▦ วาดผนังห้อง + พื้นต่างระดับ</span>
            <span className="bt-sub">
              เลือกระดับ → วาดช่อง • 1 ช่อง = {room.cellSize} ม.
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
          {/* ⭐ Level picker */}
          <div className="blocks-level-picker">
            <span className="blp-label">ระดับพื้น:</span>
            <div className="blp-chips">
              {LEVEL_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`blp-chip${
                    paintLevel === p.value ? " active" : ""
                  }`}
                  style={{ background: p.color }}
                  onClick={() => setPaintLevel(p.value)}
                  title={`${(p.value * 100).toFixed(0)} ซม.`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="blp-custom">
              <input
                type="range"
                min="0"
                max="1.5"
                step={LEVEL_STEP}
                value={paintLevel}
                onChange={(e) =>
                  setPaintLevel(parseFloat(e.target.value))
                }
              />
              <span className="blp-value">
                {(paintLevel * 100).toFixed(0)} ซม.
              </span>
            </div>
          </div>

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
              <div
                className="blocks-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${N}, ${cellPx}px)`,
                  gridAutoRows: `${cellPx}px`,
                  background: "#e6dfce",
                  gap: 1,
                  padding: 1,
                  borderRadius: 4,
                }}
              >
                {Array.from({ length: N * N }).map((_, idx) => {
                  const j = Math.floor(idx / N) - extent;
                  const i = (idx % N) - extent;
                  const key = cellKey(i, j);
                  const on = draft.has(key);
                  const y = draftLevels[key] ?? 0;
                  const bgColor = getCellColor(i, j);
                  return (
                    <div
                      key={idx}
                      data-i={i}
                      data-j={j}
                      className={`blocks-cell${on ? " on" : ""}${
                        i === 0 && j === 0 ? " origin" : ""
                      }`}
                      style={{
                        background: bgColor,
                        cursor: "pointer",
                        position: "relative",
                        userSelect: "none",
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        handleCellDown(i, j);
                      }}
                    >
                      {on && y > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 1,
                            right: 2,
                            fontSize: 8,
                            color: "#5a4a30",
                            fontFamily: "monospace",
                            fontWeight: 700,
                            pointerEvents: "none",
                          }}
                        >
                          {(y * 100).toFixed(0)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="blocks-structures">
                {structPlan.map((s) => {
                  const cs = room.cellSize;
                  const fi = s.cx / cs + structOrigin.oi;
                  const fj = s.cz / cs + structOrigin.oj;
                  const pitch = cellPx + 1; // cell + gap
                  const pad = 1;
                  const left = pad + (fi + extent) * pitch;
                  const top = pad + (fj + extent) * pitch;
                  const wPx = ((s.hw * 2) / cs) * pitch;
                  const hPx = ((s.hd * 2) / cs) * pitch;
                  if (wPx < 0.5 && hPx < 0.5) return null;
                  return (
                    <div
                      key={s.uid}
                      className={`blocks-structure blocks-structure--${s.productId}`}
                      style={{ left, top, width: wPx, height: hPx }}
                    >
                      <div
                        className="blocks-structure-rect"
                        style={{ transform: `rotate(${s.deg}deg)` }}
                      />
                      {wPx >= 12 && (
                        <span className="blocks-structure-label">
                          {s.label}
                        </span>
                      )}
                    </div>
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