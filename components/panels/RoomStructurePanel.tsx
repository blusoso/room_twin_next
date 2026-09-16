// components/panels/RoomStructurePanel.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import {
  FLOOR_STYLES,
  WALL_COLOR_PALETTE,
  WALL_LABEL_FULL,
  ROOM_LIMITS,
  ROOM_DEFAULT,
} from "@/lib/data/constants";
import { hexOf, numOf } from "@/lib/utils/format";
import { makeFloorCanvas } from "@/lib/three/surfaceTextures";
import {
  applySurface as applySurfaceToThree,
  rebuildRoomShell,
  rebuildBaseboards,
  getWallRotY,
  wallSpan,
  getWallGeom,
} from "@/lib/three/roomShell";
import { reclampAllToRoom, reclampAttachmentsOf } from "@/lib/three/reclamp";
import { instantiate } from "@/lib/three/instantiate";
import { deleteItemTree } from "@/lib/three/itemTree";
import {
  resolveWallPlacement,
  wallFootprint,
} from "@/lib/three/wallPlacement";
import { PRODUCT_BY_ID, defaultParamsFor } from "@/lib/data/products";
import { useSaveState } from "@/hooks/useSaveState";
import { objectsByUid, roomGroup } from "@/lib/three/scene";
import {
  structurePlanItems,
  blocksOrigin,
} from "@/lib/three/structurePlan";
import type { PlacedItem } from "@/lib/state/types";

type Tab = "size" | "surfaces" | "openings";
type RectSize = { w: number; d: number; h: number };

// ============================================================
// Last Rect Size
// ============================================================

const LAST_RECT_KEY = "roomtwin_last_rect_size_v1";

function saveLastRectSize(size: RectSize) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_RECT_KEY, JSON.stringify(size));
  } catch {}
}

function loadLastRectSize(): RectSize {
  if (typeof window === "undefined") {
    return { w: ROOM_DEFAULT.w, d: ROOM_DEFAULT.d, h: ROOM_DEFAULT.h };
  }
  try {
    const raw = localStorage.getItem(LAST_RECT_KEY);
    if (!raw) {
      return { w: ROOM_DEFAULT.w, d: ROOM_DEFAULT.d, h: ROOM_DEFAULT.h };
    }
    const parsed = JSON.parse(raw) as Partial<RectSize>;
    return {
      w: parsed.w ?? ROOM_DEFAULT.w,
      d: parsed.d ?? ROOM_DEFAULT.d,
      h: parsed.h ?? ROOM_DEFAULT.h,
    };
  } catch {
    return { w: ROOM_DEFAULT.w, d: ROOM_DEFAULT.d, h: ROOM_DEFAULT.h };
  }
}

// ============================================================
// switchToRectShape
// ============================================================

async function switchToRectShape() {
  const store = useRoomTwin.getState();
  const last = loadLastRectSize();
  const currentH = store.room.h;

  store.setRoom({
    shape: "rect",
    blocks: null,
    w: last.w,
    d: last.d,
    h: currentH,
  });
}

// ============================================================
// Helpers
// ============================================================

function pickVisibleWall(): string {
  const { room } = useRoomTwin.getState();
  if (room.shape !== "rect") return "back";
  return "front";
}

function addOpeningOfType(pid: string) {
  const store = useRoomTwin.getState();
  const p = PRODUCT_BY_ID.get(pid);
  if (!p) return;

  const wallId = pickVisibleWall();
  const params = defaultParamsFor(p);
  const { halfU, halfV } = wallFootprint(params, 0);
  const v = p.groundAnchor ? 0 : Math.round(store.room.h * 60) / 100;

  const c = resolveWallPlacement(
    null,
    { kind: "wall", wallId },
    0,
    v,
    halfU,
    halfV,
    p.groundAnchor || false,
  );

  const uid = "i" + Math.random().toString(36).slice(2, 10);
  const item: PlacedItem = {
    uid,
    productId: pid,
    params,
    wallMount: true,
    wallId,
    u: c.u,
    v: c.v,
    rotY: getWallRotY(wallId),
    rotZ: 0,
  };

  store.addItem(item);
  instantiate(item);

  if (p.groundAnchor) rebuildBaseboards();
}

function updateWallItemPosition(
  uid: string,
  patch: { u?: number; v?: number; wallId?: string },
) {
  const store = useRoomTwin.getState();
  const item = store.placedItems.find((i) => i.uid === uid);
  if (!item) return;
  const product = PRODUCT_BY_ID.get(item.productId);
  if (!product) return;

  const wallId = patch.wallId ?? item.wallId!;
  const rotY = getWallRotY(wallId);
  const { halfU, halfV } = wallFootprint(item.params, item.rotZ || 0);

  const c = resolveWallPlacement(
    uid,
    { kind: "wall", wallId },
    patch.u ?? item.u!,
    patch.v ?? item.v!,
    halfU,
    halfV,
    product.groundAnchor || false,
  );

  store.updateItem(uid, {
    wallId,
    u: c.u,
    v: c.v,
    rotY,
  });

  const obj = objectsByUid.get(uid);
  if (obj) {
    const g = getWallGeom(wallId);
    if (g) {
      const outward = 0.012;
      obj.position.set(
        g.cx + g.dx * c.u - g.nx * outward,
        c.v,
        g.cz + g.dz * c.u - g.nz * outward,
      );
      obj.rotation.y = rotY;
    }
  }

  if (product.groundAnchor) rebuildBaseboards();

  // ⭐ ประตู/หน้าต่างถูกย้าย → ของที่แขวนอยู่บนพื้ นผิวขยับตาม
  reclampAttachmentsOf(uid);
}

// ============================================================
// Preview SVG
// ============================================================

const PREVIEW_MAX_W = 200;
const PREVIEW_MAX_D = 128;

function RoomPreviewSvg() {
  const room = useRoomTwin((s) => s.room);
  const placedItems = useRoomTwin((s) => s.placedItems);

  const structPlan = useMemo(
    () => structurePlanItems(placedItems),
    [placedItems],
  );

  const handleOpenBlocks = useCallback(() => {
    if (room.shape === "rect") {
      saveLastRectSize({ w: room.w, d: room.d, h: room.h });
    }
    window.dispatchEvent(new CustomEvent("roomtwin:openBlocksEditor"));
  }, [room]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleOpenBlocks();
      }
    },
    [handleOpenBlocks],
  );

  let rects: Array<{ x0: number; z0: number; x1: number; z1: number }> = [];

  if (room.shape === "blocks" && room.blocks && room.blocks.size > 0) {
    room.blocks.forEach((k) => {
      const [i, j] = k.split(",").map(Number);
      const cs = room.cellSize;
      rects.push({
        x0: i * cs - cs / 2,
        z0: j * cs - cs / 2,
        x1: i * cs + cs / 2,
        z1: j * cs + cs / 2,
      });
    });
  } else {
    rects = [
      { x0: -room.w / 2, z0: -room.d / 2, x1: room.w / 2, z1: room.d / 2 },
    ];
  }

  if (rects.length === 0) return null;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  rects.forEach((r) => {
    minX = Math.min(minX, r.x0);
    maxX = Math.max(maxX, r.x1);
    minZ = Math.min(minZ, r.z0);
    maxZ = Math.max(maxZ, r.z1);
  });

  const rw = maxX - minX;
  const rd = maxZ - minZ;
  if (rw <= 0 || rd <= 0) return null;

  const scale = Math.min(PREVIEW_MAX_W / rw, PREVIEW_MAX_D / rd);
  const ox = 120 - ((minX + maxX) / 2) * scale;
  const oy = 79 - ((minZ + maxZ) / 2) * scale;
  const sx = (x: number) => x * scale + ox;
  const sy = (z: number) => z * scale + oy;

  const isBlocksMode = room.shape === "blocks";

  return (
    <div
      className="rsp-preview"
      onClick={handleOpenBlocks}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      title={
        isBlocksMode
          ? "คลิกเพื่อแก้ไขผังบล็อก"
          : "คลิกเพื่อวาดบล็อกผนังห้อง"
      }
    >
      <svg viewBox="0 0 240 158" width="100%" height="132">
        {isBlocksMode ? (
          <>
            <g fill="#fbf8f2">
              {rects.map((r, i) => (
                <polygon
                  key={i}
                  points={`${sx(r.x0)},${sy(r.z0)} ${sx(r.x1)},${sy(r.z0)} ${sx(r.x1)},${sy(r.z1)} ${sx(r.x0)},${sy(r.z1)}`}
                />
              ))}
            </g>
            <g fill="none" stroke="#b8752e" strokeWidth="0.8" opacity="0.5">
              {rects.map((r, i) => (
                <polygon
                  key={i}
                  points={`${sx(r.x0)},${sy(r.z0)} ${sx(r.x1)},${sy(r.z0)} ${sx(r.x1)},${sy(r.z1)} ${sx(r.x0)},${sy(r.z1)}`}
                />
              ))}
            </g>
          </>
        ) : (
          <>
            <polygon
              points={`${sx(minX)},${sy(minZ)} ${sx(maxX)},${sy(minZ)} ${sx(maxX)},${sy(maxZ)} ${sx(minX)},${sy(maxZ)}`}
              fill="#fbf8f2"
            />
            <polygon
              points={`${sx(minX)},${sy(minZ)} ${sx(maxX)},${sy(minZ)} ${sx(maxX)},${sy(maxZ)} ${sx(minX)},${sy(maxZ)}`}
              fill="none"
              stroke="#b8752e"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
          </>
        )}
        {(() => {
          const { oi, oj } = blocksOrigin(room.blocks);
          const cs = room.cellSize;
          return structPlan.map((s) => {
            const pxc = sx(s.cx + oi * cs);
            const pyc = sy(s.cz + oj * cs);
            const pw = s.hw * 2 * scale;
            const ph = s.hd * 2 * scale;
            if (pw < 0.4 && ph < 0.4) return null;
            const labelY = pyc - Math.max(ph / 2, 3) - 3;
            return (
              <g key={s.uid}>
                <g transform={`rotate(${s.deg} ${pxc} ${pyc})`}>
                  <rect
                    x={pxc - pw / 2}
                    y={pyc - ph / 2}
                    width={Math.max(pw, 1)}
                    height={Math.max(ph, 1)}
                    rx="1"
                    className={`rsp-structure rsp-structure--${s.productId}`}
                  />
                </g>
                {pw >= 12 && (
                  <text
                    className="rsp-structure-label"
                    textAnchor="middle"
                    x={pxc}
                    y={labelY}
                  >
                    {s.label}
                  </text>
                )}
              </g>
            );
          });
        })()}
        <text
          className="rsp-preview-label"
          textAnchor="middle"
          x="120"
          y={sy(minZ) - 9}
        >
          {rw.toFixed(1)} ม.
        </text>
        <text
          className="rsp-preview-label"
          textAnchor="middle"
          x={sx(minX) - 16}
          y="79"
          transform={`rotate(-90 ${sx(minX) - 16} 79)`}
        >
          {rd.toFixed(1)} ม.
        </text>
        <text
          className="rsp-preview-label"
          textAnchor="middle"
          x="120"
          y="150"
          style={{ fontSize: 9, fill: "#8a8275", opacity: 0.8 }}
        >
          {isBlocksMode ? "▦ คลิกเพื่อแก้ไขผัง" : "▦ คลิกเพื่อวาดบล็อก"}
        </text>
      </svg>
    </div>
  );
}

// ============================================================
// Tab 1: Size
// ============================================================

function SizeTab() {
  const room = useRoomTwin((s) => s.room);
  const setRoom = useRoomTwin((s) => s.setRoom);
  const { saveState, saveStateDebounced } = useSaveState();

  useEffect(() => {
    if (room.shape === "rect") {
      saveLastRectSize({ w: room.w, d: room.d, h: room.h });
    } else {
      const last = loadLastRectSize();
      saveLastRectSize({
        w: last.w,
        d: last.d,
        h: room.h,
      });
    }
  }, [room.shape, room.w, room.d, room.h]);

  const handleDimChange = (key: "w" | "d" | "h", value: number) => {
    const lim = ROOM_LIMITS[key];
    const v = Math.max(lim.min, Math.min(lim.max, value));
    setRoom({ [key]: v } as any);
    saveStateDebounced();
  };

  const handlePresetClick = (w: number, d: number, h: number) => {
    setRoom({ w, d, h, shape: "rect", blocks: null });
    saveLastRectSize({ w, d, h });
    rebuildRoomShell();
    reclampAllToRoom();
    saveState();
  };

  const handleOpenBlocks = () => {
    saveLastRectSize({ w: room.w, d: room.d, h: room.h });
    window.dispatchEvent(new CustomEvent("roomtwin:openBlocksEditor"));
  };

  const handleSwitchToRect = async () => {
    if (room.shape === "rect") return;
    await switchToRectShape();
    saveState();
  };

  return (
    <div className="rsp-tab-panel active">
      <div className="rsp-dim">
        <span className="rsp-dim-label">🏠 รูปทรงห้อง</span>
        <div className="rsp-shape-row">
          <button
            type="button"
            className={`rsp-shape-btn${
              room.shape === "rect" ? " active" : ""
            }`}
            onClick={handleSwitchToRect}
          >
            <span className="sc-icon">▭</span>
            <span className="sc-text">
              <span className="sc-name">สี่เหลี่ยม</span>
              <span className="sc-desc">ปรับด้วยสไลเดอร์</span>
            </span>
          </button>
          <button
            type="button"
            className={`rsp-shape-btn${
              room.shape === "blocks" ? " active" : ""
            }`}
            onClick={handleOpenBlocks}
          >
            <span className="sc-icon">▦</span>
            <span className="sc-text">
              <span className="sc-name">วาดบล็อก</span>
              <span className="sc-desc">อิสระ เพิ่ม-ลบช่อง</span>
            </span>
          </button>
        </div>
      </div>

      <RoomPreviewSvg />

      {(["w", "d", "h"] as const).map((key) => {
        const lim = ROOM_LIMITS[key];
        const label =
          key === "w"
            ? "📏 กว้าง (ซ้าย–ขวา)"
            : key === "d"
              ? "📏 ลึก (หน้า–หลัง)"
              : "📏 สูงฝ้าเพดาน";
        const disabled = room.shape === "blocks" && key !== "h";
        const value = room[key];
        const decimals = key === "h" ? 2 : 1;

        return (
          <div
            key={key}
            className={`rsp-dim${disabled ? " in-blocks" : ""}`}
          >
            <span className="rsp-dim-label">{label}</span>
            <div className="rsp-stepper">
              <button
                type="button"
                className="rsp-step-btn"
                onClick={() => handleDimChange(key, value - lim.step)}
              >
                −
              </button>
              <div className="rsp-input-wrap">
                <input
                  type="number"
                  inputMode="decimal"
                  min={lim.min}
                  max={lim.max}
                  step={lim.step}
                  value={value.toFixed(decimals)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) handleDimChange(key, v);
                  }}
                />
                <span className="rsp-unit">ม.</span>
              </div>
              <button
                type="button"
                className="rsp-step-btn"
                onClick={() => handleDimChange(key, value + lim.step)}
              >
                +
              </button>
            </div>
            <input
              type="range"
              className="rsp-slider"
              min={lim.min}
              max={lim.max}
              step={lim.step}
              value={value}
              onChange={(e) =>
                handleDimChange(key, parseFloat(e.target.value))
              }
              onMouseUp={saveState}
              onTouchEnd={saveState}
            />
          </div>
        );
      })}

      {room.shape !== "blocks" && (
        <div className="rsp-presets">
          {[
            { w: 3.4, d: 3.0, h: 2.5, icon: "🔹", name: "ห้องเล็ก", dims: "3.4×3.0 ม." },
            { w: 4.2, d: 3.6, h: 2.6, icon: "🔷", name: "ห้องกลาง", dims: "4.2×3.6 ม." },
            { w: 5.6, d: 4.6, h: 2.8, icon: "🔶", name: "ห้องใหญ่", dims: "5.6×4.6 ม." },
          ].map((p, i) => (
            <div
              key={i}
              className={`rsp-preset-card${
                Math.abs(room.w - p.w) < 0.01 &&
                Math.abs(room.d - p.d) < 0.01 &&
                Math.abs(room.h - p.h) < 0.01
                  ? " active"
                  : ""
              }`}
              onClick={() => handlePresetClick(p.w, p.d, p.h)}
            >
              <div className="pc-icon">{p.icon}</div>
              <div className="pc-name">{p.name}</div>
              <div className="pc-dims">{p.dims}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rsp-note">
        {room.shape === "blocks"
          ? "▦ โหมดวาดบล็อก — ขนาดถูกกำหนดจากบล็อกโดยอัตโนมัติ • กดปุ่ม ▦ ด้านบนเพื่อแก้ไข"
          : "💡 พิมพ์ตัวเลข ลากแถบ หรือกด −/+ — เห็นผลในห้อง 3D ทันที"}
      </div>
    </div>
  );
}

// ============================================================
// Tab 2: Surfaces
// ============================================================

function SurfacesTab() {
  const surface = useRoomTwin((s) => s.surface);
  const setSurface = useRoomTwin((s) => s.setSurface);
  const { saveState } = useSaveState();

  const commit = (patch: Partial<typeof surface>) => {
    setSurface(patch);
    applySurfaceToThree();
    saveState();
  };

  return (
    <div className="rsp-tab-panel active">
      <div className="rsp-subsec">
        <div className="rsp-subsec-title">🟫 วัสดุพื้น</div>
        <div className="floor-grid">
          {FLOOR_STYLES.map((st) => (
            <div
              key={st.id}
              className={`floor-swatch${
                surface.floor === st.id ? " active" : ""
              }`}
              style={{
                backgroundImage: `url(${makeFloorCanvas(st.id, 96).toDataURL()})`,
              }}
              onClick={() => commit({ floor: st.id })}
            >
              <div className="fl-name">{st.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rsp-subsec">
        <div className="rsp-subsec-title">🧱 สีผนัง</div>
        <div className="wall-uniform-toggle">
          <div>
            <span className="wut-label">🎨 ใช้สีเดียวกันทุกผนัง</span>
            <span className="wut-sub">ปิดเพื่อกำหนดสีแยกแต่ละด้าน</span>
          </div>
          <label className="cz-toggle">
            <input
              type="checkbox"
              checked={surface.wallUniform}
              onChange={(e) => {
                const uniform = e.target.checked;
                if (!uniform) {
                  const walls: Record<string, number> = {};
                  ["back", "front", "side", "right"].forEach((id) => {
                    walls[id] = surface.wallAll;
                  });
                  commit({ wallUniform: false, walls });
                } else {
                  commit({ wallUniform: true });
                }
              }}
            />
            <span className="cz-toggle-track" />
          </label>
        </div>

        {surface.wallUniform ? (
          <>
            <div className="wall-color-grid">
              {WALL_COLOR_PALETTE.map((c) => (
                <div
                  key={c}
                  className={`wall-color-chip${
                    surface.wallAll === c ? " active" : ""
                  }`}
                  style={{ background: hexOf(c) }}
                  onClick={() => commit({ wallAll: c })}
                />
              ))}
            </div>
            <div className="cz-row">
              <label className="cz-row-label">เลือกเอง</label>
              <div className="cz-row-control">
                <input
                  type="color"
                  className="cz-color-input"
                  value={hexOf(surface.wallAll)}
                  onChange={(e) =>
                    commit({ wallAll: numOf(e.target.value) })
                  }
                />
                <span className="cz-color-hex">
                  {hexOf(surface.wallAll).toUpperCase()}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="wall-per-wall-list">
            {([
              "back",
              "front",
              "side",
              "right",
            ] as const).map((id) => {
              const cur =
                surface.walls[id] !== undefined
                  ? surface.walls[id]
                  : surface.wallAll;
              return (
                <div key={id} className="wall-per-wall-row">
                  <span className="wp-label">{WALL_LABEL_FULL[id]}</span>
                  <div className="wall-per-wall-chips">
                    {WALL_COLOR_PALETTE.map((c) => (
                      <div
                        key={c}
                        className={`wall-color-chip wall-color-chip-sm${
                          cur === c ? " active" : ""
                        }`}
                        style={{ background: hexOf(c) }}
                        onClick={() =>
                          commit({
                            walls: { ...surface.walls, [id]: c },
                          })
                        }
                      />
                    ))}
                  </div>
                  <div className="cz-row wall-per-wall-custom">
                    <span className="cz-row-label">เลือกเอง</span>
                    <div className="cz-row-control">
                      <input
                        type="color"
                        className="cz-color-input"
                        value={hexOf(cur)}
                        onChange={(e) =>
                          commit({
                            walls: {
                              ...surface.walls,
                              [id]: numOf(e.target.value),
                            },
                          })
                        }
                      />
                      <span className="cz-color-hex">
                        {hexOf(cur).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rsp-subsec">
        <div className="rsp-subsec-title">⬜ เพดาน</div>
        <div className="cz-row">
          <label className="cz-row-label">สีเพดาน</label>
          <div className="cz-row-control">
            <input
              type="color"
              className="cz-color-input"
              value={hexOf(surface.ceiling)}
              onChange={(e) => commit({ ceiling: numOf(e.target.value) })}
            />
            <span className="cz-color-hex">
              {hexOf(surface.ceiling).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Tab 3: Openings
// ============================================================

function OpeningsTab() {
  const room = useRoomTwin((s) => s.room);
  const placedItems = useRoomTwin((s) => s.placedItems);
  const { saveState } = useSaveState();
  const [openUid, setOpenUid] = useState<string | null>(null);

  // ⭐ รองรับ door, slidingdoor, window
  const openings = placedItems.filter(
    (i) =>
      i.wallMount &&
      (i.productId === "door" ||
        i.productId === "window" ||
        i.productId === "slidingdoor"),
  );

  return (
    <div className="rsp-tab-panel active">
      <div className="opening-actions">
        <button
          type="button"
          className="opening-add-btn"
          onClick={() => {
            addOpeningOfType("door");
            saveState();
          }}
        >
          🚪 + ประตู
        </button>
        <button
          type="button"
          className="opening-add-btn"
          onClick={() => {
            addOpeningOfType("slidingdoor");
            saveState();
          }}
        >
          🚪 + ประตูระเบียง
        </button>
        <button
          type="button"
          className="opening-add-btn"
          onClick={() => {
            addOpeningOfType("window");
            saveState();
          }}
        >
          🪟 + หน้าต่าง
        </button>
      </div>

      <div className="opening-list">
        {openings.length === 0 ? (
          <div className="opening-empty">
            ยังไม่มีประตู/หน้าต่าง
            <br />
            <small>กดปุ่มด้านบนเพื่อเพิ่ม</small>
          </div>
        ) : (
          openings.map((o) => (
            <OpeningItem
              key={o.uid}
              item={o}
              isOpen={openUid === o.uid}
              onToggle={() =>
                setOpenUid((cur) => (cur === o.uid ? null : o.uid))
              }
              roomShape={room.shape}
              onDelete={() => {
                // ⭐ ลบ object ใน 3D + state (รวมของที่แขวนอยู่กับพื้ นผิวนี้)
                deleteItemTree(o.uid);
                setOpenUid(null);
                saveState();
              }}
              onUpdate={saveState}
            />
          ))
        )}
      </div>
    </div>
  );
}

function OpeningItem({
  item,
  isOpen,
  onToggle,
  roomShape,
  onDelete,
  onUpdate,
}: {
  item: PlacedItem;
  isOpen: boolean;
  onToggle: () => void;
  roomShape: "rect" | "blocks";
  onDelete: () => void;
  onUpdate: () => void;
}) {
  const product = PRODUCT_BY_ID.get(item.productId);
  if (!product) return null;

  const wallLabel = WALL_LABEL_FULL[item.wallId!] || "ผนัง";
  const offsetCm = Math.round((item.u || 0) * 100);
  const heightCm = Math.round((item.v || 0) * 100);

  const isGroundAnchor = !!product.groundAnchor;
  const subLine = isGroundAnchor
    ? `${wallLabel} • ${offsetCm >= 0 ? "+" : ""}${offsetCm} ซม.`
    : `${wallLabel} • ${offsetCm >= 0 ? "+" : ""}${offsetCm} ซม. • สูง ${heightCm} ซม.`;

  const half = wallFootprint(item.params, item.rotZ || 0);
  const span = wallSpan(item.wallId!);
  const minU = Math.round((-span / 2 + 0.05 + half.halfU) * 100);
  const maxU = Math.round((span / 2 - 0.05 - half.halfU) * 100);
  const minV = Math.round((0.55 + half.halfV) * 100);
  const maxV = Math.round(
    (useRoomTwin.getState().room.h - 0.15 - half.halfV) * 100,
  );

  const icon =
    item.productId === "door"
      ? "🚪"
      : item.productId === "slidingdoor"
        ? "🚪"
        : "🪟";

  return (
    <div className={`opening-item${isOpen ? " open" : ""}`}>
      <div className="opening-head" onClick={onToggle}>
        <div className="oi-icon">{icon}</div>
        <div className="oi-main">
          <div className="oi-name">
            {item.displayName || product.name}
          </div>
          <div className="oi-sub">{subLine}</div>
        </div>
        <div className="oi-chev">▼</div>
      </div>

      {isOpen && (
        <div className="opening-body">
          {roomShape === "rect" && (
            <div className="opening-field">
              <div className="opening-field-label">
                <span>ผนัง</span>
              </div>
              <div className="wall-side-row">
                {(["back", "front", "side", "right"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`wall-side-btn${
                      item.wallId === id ? " active" : ""
                    }`}
                    onClick={() => {
                      updateWallItemPosition(item.uid, {
                        wallId: id,
                        u: 0,
                      });
                      onUpdate();
                    }}
                  >
                    {WALL_LABEL_FULL[id].replace("ผนัง", "")}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="opening-field">
            <div className="opening-field-label">
              <span>ตำแหน่งตามแนวผนัง</span>
              <span className="val">{Math.round(item.u! * 100)} ซม.</span>
            </div>
            <input
              type="range"
              className="opening-slider"
              min={minU}
              max={maxU}
              step={1}
              value={Math.round(item.u! * 100)}
              onChange={(e) => {
                updateWallItemPosition(item.uid, {
                  u: parseFloat(e.target.value) / 100,
                });
              }}
              onMouseUp={onUpdate}
              onTouchEnd={onUpdate}
            />
          </div>

          {!isGroundAnchor && (
            <div className="opening-field">
              <div className="opening-field-label">
                <span>สูงจากพื้น</span>
                <span className="val">{Math.round(item.v! * 100)} ซม.</span>
              </div>
              <input
                type="range"
                className="opening-slider"
                min={minV}
                max={maxV}
                step={1}
                value={Math.round(item.v! * 100)}
                onChange={(e) => {
                  updateWallItemPosition(item.uid, {
                    v: parseFloat(e.target.value) / 100,
                  });
                }}
                onMouseUp={onUpdate}
                onTouchEnd={onUpdate}
              />
            </div>
          )}

          <button
            type="button"
            className="opening-remove"
            onClick={onDelete}
          >
            🗑 ลบช่องเปิดนี้
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Root Panel
// ============================================================

export default function RoomStructurePanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("size");
  const panelRef = useRef<HTMLDivElement>(null);

  const closePanel = useCallback(() => {
    setOpen(false);
  }, []);

  const positionPanel = useCallback(() => {
    if (!panelRef.current) return;
    const btn = document.getElementById("roomSizeBtn");
    if (!btn) return;

    const r = btn.getBoundingClientRect();
    const w = panelRef.current.offsetWidth || 380;
    const margin = 8;

    let left = r.right - w;
    left = Math.max(
      margin,
      Math.min(left, window.innerWidth - w - margin),
    );
    const top = r.bottom + 6;

    panelRef.current.style.left = left + "px";
    panelRef.current.style.top = top + "px";
  }, []);

  useEffect(() => {
    if (!open) return;
    positionPanel();
    window.addEventListener("resize", positionPanel);
    return () => window.removeEventListener("resize", positionPanel);
  }, [open, positionPanel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener("roomtwin:openRoomStructure", onOpen);
    window.addEventListener("roomtwin:closeRoomStructure", onClose);
    window.addEventListener("roomtwin:toggleRoomStructure", onToggle);
    return () => {
      window.removeEventListener("roomtwin:openRoomStructure", onOpen);
      window.removeEventListener("roomtwin:closeRoomStructure", onClose);
      window.removeEventListener("roomtwin:toggleRoomStructure", onToggle);
    };
  }, []);

  return (
    <>
      {open && (
        <div
          className="panel-backdrop z-29 show"
          onClick={closePanel}
          aria-hidden="true"
        />
      )}

      <div
        ref={panelRef}
        className={`room-size-panel${open ? " show" : ""}`}
        aria-hidden={!open}
        style={{
          position: "fixed",
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
        inert={!open}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rsp-header">
          <b>🏗️ ปรับแต่งโครงสร้างห้อง</b>
          <button
            type="button"
            className="rsp-close"
            onClick={closePanel}
          >
            ✕
          </button>
        </div>

        <div className="rsp-tabs">
          <button
            type="button"
            className={`rsp-tab${tab === "size" ? " active" : ""}`}
            onClick={() => setTab("size")}
          >
            📐 ขนาด
          </button>
          <button
            type="button"
            className={`rsp-tab${tab === "surfaces" ? " active" : ""}`}
            onClick={() => setTab("surfaces")}
          >
            🎨 พื้นผิว
          </button>
          <button
            type="button"
            className={`rsp-tab${tab === "openings" ? " active" : ""}`}
            onClick={() => setTab("openings")}
          >
            🚪 ช่องเปิด
          </button>
        </div>

        <div className="rsp-body">
          {tab === "size" && <SizeTab />}
          {tab === "surfaces" && <SurfacesTab />}
          {tab === "openings" && <OpeningsTab />}
        </div>
      </div>
    </>
  );
}