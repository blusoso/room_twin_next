// components/panels/BlocksEditor.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { useSaveState } from "@/hooks/useSaveState";
import { rebuildRoomShell } from "@/lib/three/roomShell";
import { reclampAllToRoom } from "@/lib/three/reclamp";
import {
  captureWallItems,
  remapOrphanedWallItems,
} from "@/hooks/useRoomTwinInit";
import { LEVEL_PRESETS, LEVEL_STEP } from "@/lib/data/constants";
import { structurePlanItems, blocksOrigin } from "@/lib/three/structurePlan";
import {
  Button,
  Chip,
  IconButton,
  Modal,
  SectionLabel,
  SegmentedControl,
} from "@/components/ui";

const CELL_PX_BASE = 22;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

// ⭐ ค่าคงที่ของ .blocks-grid — ใช้ทั้ง inline style และการคำนวณตำแหน่ง overlay (ห้ามให้ drift)
const GRID_GAP = 1;
const GRID_PAD = 1;

// ⭐ จำนวน snapshot สูงสุดของ undo/redo ในหน้า editor (ไม่ใช่ global history)
const DRAFT_HISTORY_MAX = 50;

type Tool = "paint" | "erase";

interface DraftSnap {
  blocks: Set<string>;
  levels: Record<string, number>;
}

function cellKey(i: number, j: number) {
  return `${i},${j}`;
}

function snapshotOf(
  blocks: Set<string>,
  levels: Record<string, number>,
): DraftSnap {
  return { blocks: new Set(blocks), levels: { ...levels } };
}

function sameSnap(a: DraftSnap, b: DraftSnap) {
  if (a.blocks.size !== b.blocks.size) return false;
  let same = true;
  a.blocks.forEach((k) => {
    if (!b.blocks.has(k)) same = false;
  });
  if (!same) return false;
  const ka = Object.keys(a.levels);
  const kb = Object.keys(b.levels);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a.levels[k] === b.levels[k]);
}

// ⭐ ตัดระดับพื้นของช่องที่ไม่มีอยู่ในชุดบล็อกแล้ว (กัน cellLevels ค้าง)
function pruneLevels(blocks: Set<string>, levels: Record<string, number>) {
  let changed = false;
  const next: Record<string, number> = {};
  Object.keys(levels).forEach((k) => {
    if (blocks.has(k)) next[k] = levels[k];
    else changed = true;
  });
  return changed ? next : levels;
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
  let minI = Infinity,
    maxI = -Infinity,
    minJ = Infinity,
    maxJ = -Infinity;
  blocks.forEach((k) => {
    const [i, j] = k.split(",").map(Number);
    minI = Math.min(minI, i);
    maxI = Math.max(maxI, i);
    minJ = Math.min(minJ, j);
    maxJ = Math.max(maxJ, j);
  });
  return {
    minI,
    maxI,
    minJ,
    maxJ,
    w: (maxI - minI + 1) * cellSize,
    d: (maxJ - minJ + 1) * cellSize,
  };
}

export default function BlocksEditor() {
  const open = useRoomTwin((s) => s.blocksEditorOpen);
  const setBlocksEditorOpen = useRoomTwin((s) => s.setBlocksEditorOpen);

  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [draftLevels, setDraftLevels] = useState<Record<string, number>>({});
  const [extent, setExtent] = useState(12);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>("paint");
  const [strokeTool, setStrokeTool] = useState<Tool | null>(null);
  const [paintLevel, setPaintLevel] = useState(0);
  const [hoverUid, setHoverUid] = useState<string | null>(null);
  // ⭐ UI disclosure (ไม่เกี่ยวกับ draft/history)
  const [tipsOpen, setTipsOpen] = useState(false);
  const [fineOpen, setFineOpen] = useState(false);

  // ⭐ draft undo/redo (เฉพาะผังในหน้านี้)
  const [past, setPast] = useState<DraftSnap[]>([]);
  const [future, setFuture] = useState<DraftSnap[]>([]);

  const room = useRoomTwin((s) => s.room);
  const placedItems = useRoomTwin((s) => s.placedItems);
  const { saveState } = useSaveState();
  const canvasRef = useRef<HTMLDivElement>(null);

  // ⭐ mirror ล่าสุดของ draft — ใช้ตอนลาก (pointermove) ที่ closure อาจเก่า
  const draftRef = useRef(draft);
  const levelsRef = useRef(draftLevels);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    levelsRef.current = draftLevels;
  }, [draftLevels]);

  // ⭐ push history ได้ครั้งเดียวต่อ stroke
  const strokePushedRef = useRef(false);
  // ⭐ snapshot ล่าสุดที่ push แล้ว — กัน entry ซ้ำ
  const lastSnapRef = useRef<DraftSnap | null>(null);

  // ⭐ โครงสร้างห้องตามตำแหน่งจริง (ประตู/หน้าต่าง/เสา/ฉากกั้น) — overlay บนผัง
  const structPlan = useMemo(
    () => structurePlanItems(placedItems),
    [placedItems],
  );
  const structOrigin = useMemo(() => {
    if (room.shape === "blocks" && room.blocks && room.blocks.size > 0)
      return blocksOrigin(room.blocks);
    return blocksOrigin(draft);
  }, [room.shape, room.blocks, draft]);

  // ===== Draft history =====
  const resetDraftHistory = useCallback(() => {
    strokePushedRef.current = false;
    lastSnapRef.current = null;
    setPast([]);
    setFuture([]);
  }, []);

  const pushDraftHistory = useCallback(() => {
    const snap = snapshotOf(draftRef.current, levelsRef.current);
    if (lastSnapRef.current && sameSnap(snap, lastSnapRef.current)) return;
    lastSnapRef.current = snap;
    setPast((p) => [...p, snap].slice(-DRAFT_HISTORY_MAX));
    setFuture([]);
  }, []);

  const undoDraft = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const cur = snapshotOf(draftRef.current, levelsRef.current);
    strokePushedRef.current = false;
    lastSnapRef.current = null;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [cur, ...f].slice(0, DRAFT_HISTORY_MAX));
    setDraft(new Set(prev.blocks));
    setDraftLevels({ ...prev.levels });
  }, [past]);

  const redoDraft = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const cur = snapshotOf(draftRef.current, levelsRef.current);
    strokePushedRef.current = false;
    lastSnapRef.current = null;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, cur].slice(-DRAFT_HISTORY_MAX));
    setDraft(new Set(next.blocks));
    setDraftLevels({ ...next.levels });
  }, [future]);

  // ===== Cell mutation =====
  const addCell = useCallback(
    (i: number, j: number) => {
      const key = cellKey(i, j);
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
    },
    [paintLevel],
  );

  const eraseCell = useCallback((i: number, j: number) => {
    const key = cellKey(i, j);
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
  }, []);

  // ⭐ เปลี่ยนช่องจริงหรือไม่ — ใช้ตัดสินว่าจะ push history
  const willChange = useCallback(
    (i: number, j: number, activeTool: Tool) => {
      const key = cellKey(i, j);
      const has = draftRef.current.has(key);
      if (activeTool === "erase") return has;
      return !(has && (levelsRef.current[key] ?? 0) === paintLevel);
    },
    [paintLevel],
  );

  const applyStrokeCell = useCallback(
    (i: number, j: number, activeTool: Tool) => {
      if (!willChange(i, j, activeTool)) return;
      if (!strokePushedRef.current) {
        pushDraftHistory();
        strokePushedRef.current = true;
      }
      if (activeTool === "erase") eraseCell(i, j);
      else addCell(i, j);
    },
    [addCell, eraseCell, pushDraftHistory, willChange],
  );

  // ===== Open / Close =====
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
      setTool("paint");
      setStrokeTool(null);
      setHoverUid(null);
      setTipsOpen(false);
      setFineOpen(false);
      resetDraftHistory();
      setBlocksEditorOpen(true);
    };
    const onClose = () => setBlocksEditorOpen(false);
    window.addEventListener("roomtwin:openBlocksEditor", onOpen);
    window.addEventListener("roomtwin:closeBlocksEditor", onClose);
    return () => {
      window.removeEventListener("roomtwin:openBlocksEditor", onOpen);
      window.removeEventListener("roomtwin:closeBlocksEditor", onClose);
    };
  }, [resetDraftHistory, setBlocksEditorOpen]);

  // ===== Painting / Erasing (drag) =====
  useEffect(() => {
    if (!open) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!strokeTool) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el?.closest?.(".blocks-cell") as HTMLElement | null;
      if (!cell) return;
      applyStrokeCell(+cell.dataset.i!, +cell.dataset.j!, strokeTool);
    };

    const onPointerUp = () => {
      setStrokeTool(null);
      strokePushedRef.current = false;
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [open, strokeTool, applyStrokeCell]);

  // ===== Keyboard (undo/redo + เลือกเครื่องมือ) =====
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const isZ = key === "z" || e.code === "KeyZ";
      const isY = key === "y" || e.code === "KeyY";

      if (ctrl && (isZ || isY)) {
        e.preventDefault();
        e.stopPropagation();
        const isRedo = (isZ && e.shiftKey) || (isY && !e.shiftKey);
        if (isRedo) redoDraft();
        else undoDraft();
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (ctrl || e.altKey) return;

      if (key === "e") {
        e.preventDefault();
        setTool("erase");
      } else if (key === "b") {
        e.preventDefault();
        setTool("paint");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, undoDraft, redoDraft]);

  // ⭐ เริ่ม stroke ใหม่ — push history ตอนช่องแรกเปลี่ยนจริง
  const handleCellDown = (i: number, j: number) => {
    strokePushedRef.current = false;
    setStrokeTool(tool);
    applyStrokeCell(i, j, tool);
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
    setBlocksEditorOpen(false);
    saveState();
  };

  const handleClear = () => {
    if (draft.size === 0 && Object.keys(draftLevels).length === 0) return;
    pushDraftHistory();
    setDraft(new Set());
    setDraftLevels({});
  };

  const handleReset = () => {
    const r = useRoomTwin.getState().room;
    const next = initBlocksFromRect(r.w, r.d, r.cellSize);
    // ⭐ ไม่เปลี่ยนอะไรในผัง → ไม่ต้อง push history (แต่ยังคืน zoom/extent)
    if (
      !sameSnap(snapshotOf(draft, draftLevels), {
        blocks: next,
        levels: {},
      })
    ) {
      pushDraftHistory();
    }
    setDraft(next);
    setDraftLevels({});
    setExtent(computeExtent(r.w, r.d, r.cellSize));
    setZoom(1);
  };

  const handleRect = () => {
    const r = useRoomTwin.getState().room;
    const next = initBlocksFromRect(r.w, r.d, r.cellSize);
    const nextLevels = pruneLevels(next, draftLevels);
    if (
      sameSnap(snapshotOf(draft, draftLevels), {
        blocks: next,
        levels: nextLevels,
      })
    ) {
      return;
    }
    pushDraftHistory();
    setDraft(next);
    // ⭐ ตัดระดับพื้นของช่องที่ถูกแทนที่ออก (กัน cellLevels ค้าง)
    setDraftLevels(nextLevels);
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

  // ⭐ mapping world (เมตร) → px ของผังบล็อก
  //    cell k อยู่ที่ [GRID_PAD + k*pitch, + cellPx] ⇒ center = GRID_PAD + k*pitch + cellPx/2
  //    world x → index i = x / cellSize + origin  (cell (i,j) render ที่ ((i-oi)*cs, (j-oj)*cs))
  const cs = room.cellSize;
  const pitch = cellPx + GRID_GAP;
  const pxPerMeter = cs > 0 ? cellPx / cs : 1;
  const worldToPx = (world: number, origin: number) =>
    GRID_PAD + (world / cs + origin + extent) * pitch + cellPx / 2;

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
    <Modal
      open={open}
      onClose={() => setBlocksEditorOpen(false)}
      overlayClass="blocks-overlay"
      boxClass="blocks-box"
    >
      <div className="blocks-box">
        <div className="blocks-head">
          <div className="blocks-title">
            <span>▦ ผังพื้นห้อง</span>
            <span className="blocks-hint">
              {tool === "erase"
                ? "🧽 คลิกหรือลากบนช่องเพื่อลบ • กด B เพื่อกลับมาโหมดวาด"
                : `🖌 คลิกหรือลากบนผังเพื่อเพิ่มช่อง • 1 ช่อง = ${room.cellSize} ม.`}
            </span>
          </div>
          <div className="blocks-head-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTipsOpen((v) => !v)}
              aria-expanded={tipsOpen}
              title="วิธีใช้ + คีย์ลัด"
            >
              ? วิธีใช้
            </Button>
            <IconButton
              label="ย้อนกลับ"
              size="md"
              onClick={undoDraft}
              disabled={past.length === 0}
              title="ย้อนกลับ (Ctrl+Z)"
            >
              ↩
            </IconButton>
            <IconButton
              label="ทำซ้ำ"
              size="md"
              onClick={redoDraft}
              disabled={future.length === 0}
              title="ทำซ้ำ (Ctrl+Shift+Z)"
            >
              ↪
            </IconButton>
            <IconButton
              label="ปิด"
              size="md"
              onClick={() => setBlocksEditorOpen(false)}
              title="ปิด (Esc)"
            >
              ✕
            </IconButton>
          </div>
        </div>

        {/* ⭐ วิธีใช้ — แสดงเมื่อกด ไม่กินพื้นที่โดยค่าเริ่มต้น */}
        {tipsOpen && (
          <div className="blocks-tips">
            <ul>
              <li>
                เลือกระดับพื้น (ซม.) แล้ววาดช่องบนผัง —
                ช่องที่วาดจะยกพื้นสูงตามระดับ
              </li>
              <li>ลบด้วย 🧽 ยางลบ หรือกด E • กลับมาโหมดวาดด้วย B</li>
              <li>ย้อน/ทำซ้ำได้ด้วย ↩ ↪ หรือ Ctrl+Z / Ctrl+Shift+Z</li>
              <li>
                เสร็จแล้วกด ✓ ใช้รูปทรงนี้ —
                ประตู/หน้าต่างเดิมจะถูกจัดตำแหน่งให้อัตโนมัติ
              </li>
            </ul>
            <div className="blocks-tips-keys">
              B = วาด · E = ยางลบ · Ctrl+Z = ย้อนกลับ · Ctrl+Shift+Z = ทำซ้ำ ·
              Esc = ปิด
            </div>
          </div>
        )}

        <div className="blocks-body">
          {/* ⭐ แถบเครื่องมือเดียว: เครื่องมือ · ระดับพื้น · ซูม */}
          <div className="blocks-bar">
            <SegmentedControl
              containerClass="blocks-seg"
              optionClass="blocks-seg-btn"
              ariaLabel="เครื่องมือ"
              value={tool}
              onChange={setTool}
              options={[
                { value: "paint", label: "🖌 วาด" },
                { value: "erase", label: "🧽 ยางลบ" },
              ]}
            />

            <div className="blocks-tool-sep" />

            <div
              className={`blocks-levels${tool === "erase" ? " is-dim" : ""}`}
            >
              <SectionLabel icon="📏">ระดับพื้น (ซม.)</SectionLabel>
              <div className="blocks-chip-row">
                {LEVEL_PRESETS.map((p) => (
                  <Chip
                    key={p.id}
                    className="blocks-chip"
                    active={paintLevel === p.value}
                    style={{ background: p.color }}
                    onClick={() => setPaintLevel(p.value)}
                    title={`สูง ${(p.value * 100).toFixed(0)} ซม.`}
                  >
                    {p.label}
                  </Chip>
                ))}
                {/* fine-toggle — คงไว้เดิม */}
              </div>
              {paintLevel > 0 && tool !== "erase" && (
                <span className="blocks-badge">
                  +{Math.round(paintLevel * 100)} ซม.
                </span>
              )}
              {fineOpen && (
                <div className="blocks-fine">
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step={LEVEL_STEP}
                    value={paintLevel}
                    aria-label="ระดับพื้นละเอียด"
                    onChange={(e) => setPaintLevel(parseFloat(e.target.value))}
                  />
                  <span className="blocks-badge">
                    {Math.round(paintLevel * 100)} ซม.
                  </span>
                </div>
              )}
            </div>

            <div className="blocks-tool-sep" />

            <div className="blocks-zoom">
              <IconButton label="ย่อ" size="md" onClick={handleZoomOut}>
                −
              </IconButton>
              <IconButton label="พอดีจอ" size="md" onClick={handleZoomFit}>
                ⛶
              </IconButton>
              <IconButton label="ขยาย" size="md" onClick={handleZoomIn}>
                +
              </IconButton>
            </div>
          </div>

          <div className="blocks-canvas" ref={canvasRef}>
            <div className="blocks-stage">
              <div className="blocks-grid-wrap">
                <div
                  className={`blocks-grid tool-${tool}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${N}, ${cellPx}px)`,
                    gridAutoRows: `${cellPx}px`,
                    background: "#e6dfce",
                    gap: GRID_GAP,
                    padding: GRID_PAD,
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
                    const wPx = s.hw * 2 * pxPerMeter;
                    const hPx = s.hd * 2 * pxPerMeter;
                    if (wPx < 0.5 && hPx < 0.5) return null;
                    // ⭐ ศูนย์กลางรูปต้องตรงกับ cell center ของ world position นั้น
                    const left = worldToPx(s.cx, structOrigin.oi) - wPx / 2;
                    const top = worldToPx(s.cz, structOrigin.oj) - hPx / 2;
                    return (
                      <div
                        key={s.uid}
                        className={`blocks-structure blocks-structure--${
                          s.productId
                        }${hoverUid === s.uid ? " is-hover" : ""}`}
                        style={{ left, top, width: wPx, height: hPx }}
                      >
                        <div
                          className="blocks-structure-rect"
                          style={{ transform: `rotate(${s.deg}deg)` }}
                        />
                        {wPx >= 30 ? (
                          <span className="blocks-structure-label">
                            <span className="bsl-name">{s.shortName}</span>
                            <span className="bsl-dim">{s.label}</span>
                          </span>
                        ) : wPx >= 10 ? (
                          <span className="blocks-structure-label">
                            <span className="bsl-name">{s.shortName}</span>
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ⭐ legend โครงสร้าง — ติดท้ายผัง ซ่อนเมื่อไม่มีโครงสร้าง */}
            {structPlan.length > 0 && (
              <div className="blocks-legend">
                <span className="blocks-legend-label">โครงสร้าง:</span>
                {structPlan.map((s) => (
                  <button
                    key={s.uid}
                    type="button"
                    className={`blocks-legend-item blocks-structure--${
                      s.productId
                    }${hoverUid === s.uid ? " is-hover" : ""}`}
                    title={`${s.name} • ${s.label} • ${
                      s.wallMount ? "ติดผนัง" : "วางพื้น"
                    }`}
                    onMouseEnter={() => setHoverUid(s.uid)}
                    onMouseLeave={() =>
                      setHoverUid((cur) => (cur === s.uid ? null : cur))
                    }
                    onFocus={() => setHoverUid(s.uid)}
                    onBlur={() =>
                      setHoverUid((cur) => (cur === s.uid ? null : cur))
                    }
                  >
                    <span className="blocks-legend-dot" />
                    <span className="blocks-legend-name">{s.shortName}</span>
                    <b className="blocks-legend-dim">{s.label}</b>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="blocks-foot">
          <div className="blocks-stats">
            <span className="blocks-stat">
              ขนาด{" "}
              <b>
                {bbox ? `${bbox.w.toFixed(1)}×${bbox.d.toFixed(1)}` : "0×0"}
              </b>{" "}
              ม.
            </span>
            <span className="blocks-stat">
              <b>{draft.size}</b> ช่อง
            </span>
            <span className="blocks-stat">
              ใช้สอย <b>{bbox ? (bbox.w * bbox.d).toFixed(1) : "0"}</b> ตร.ม.
            </span>
          </div>
          <div className="blocks-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRect}
              title="เติมช่องเป็นสี่เหลี่ยมเท่าขนาดห้องปัจจุบัน"
            >
              ⬜ เติมทั้งห้อง
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              title="ลบทุกช่อง (ย้อนกลับได้)"
            >
              🗑 ล้าง
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              title="เริ่มจากสี่เหลี่ยมขนาดห้อง + ล้างระดับพื้น + คืนซูม"
            >
              ↺ เริ่มใหม่
            </Button>
            <Button
              variant="copper"
              size="md"
              disabled={draft.size === 0}
              onClick={handleApply}
            >
              ✓ ใช้รูปทรงนี้
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
