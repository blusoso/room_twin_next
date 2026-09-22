// components/panels/RoomStructurePanel.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRoomTwin } from "@/lib/state/store";

import { Button, IconButton } from "@/components/ui";

import {
  FLOOR_STYLES,
  FLOOR_TINT_PALETTE,
  WALL_COLOR_PALETTE,
  CEILING_COLOR_PALETTE,
  BASEBOARD_COLOR_PALETTE, // ⭐ เพิ่ม
  WALL_LABEL_FULL,
  ROOM_LIMITS,
  ROOM_DEFAULT,
  ROOM_SETUP_STEPS,
  ROOM_SETUP_STEP_META,
  ROOM_SETUP_CTA_LABEL,
  MAIN_CATEGORIES,
  type RoomSetupTab,
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

import { resolveWallPlacement, wallFootprint } from "@/lib/three/wallPlacement";

import { PRODUCT_BY_ID, defaultParamsFor, PRODUCTS } from "@/lib/data/products";

import { getProductIcon } from "@/lib/data/icons";

import type { ProductDef } from "@/lib/data/types";

import { useSaveState } from "@/hooks/useSaveState";

import { objectsByUid } from "@/lib/three/scene";

import { structurePlanItems, blocksOrigin } from "@/lib/three/structurePlan";

import type { PlacedItem } from "@/lib/state/types";

import { usePlacement } from "@/hooks/usePlacement";
import { useCardDrag } from "@/hooks/useCardDrag";

type Tab = RoomSetupTab;

type RectSize = {
  w: number;
  d: number;
  h: number;
};

/** ⭐ คีย์ผนังทั้ง 4 ด้าน ใช้ทั้ง SurfacesTab + Wall Picker */
const WALL_KEYS = ["back", "front", "side", "right"] as const;
type WallKey = (typeof WALL_KEYS)[number];

/** ⭐ ป้ายชื่อผนังแบบสั้น */
const WALL_SHORT: Record<WallKey, string> = {
  back: "หลัง",
  front: "หน้า",
  side: "ซ้าย",
  right: "ขวา",
};

const LAST_RECT_KEY = "roomtwin_last_rect_size_v1";

/* ⭐ ลำดับการ์ดที่แสดง (ตาม product data) */
const STRUCTURE_IDS = [
  "door",
  "slidingdoor",
  "window",
  "curtain",
  "ac",
  "ceilingfan",
  "pendantlamp",
  "downlight",
  "column",
  "partition",
] as const;

/* ============================================================
   Slider progress
   ============================================================ */

function sliderProgressPct(value: number, min: number, max: number): string {
  if (max <= min) return "0%";
  const pct = ((value - min) / (max - min)) * 100;
  return `${Math.max(0, Math.min(100, pct))}%`;
}

/* ============================================================
   Last Rect Size
   ============================================================ */

function saveLastRectSize(size: RectSize) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(LAST_RECT_KEY, JSON.stringify(size));
  } catch {}
}

function loadLastRectSize(): RectSize {
  if (typeof window === "undefined") {
    return {
      w: ROOM_DEFAULT.w,
      d: ROOM_DEFAULT.d,
      h: ROOM_DEFAULT.h,
    };
  }

  try {
    const raw = localStorage.getItem(LAST_RECT_KEY);

    if (!raw) {
      return {
        w: ROOM_DEFAULT.w,
        d: ROOM_DEFAULT.d,
        h: ROOM_DEFAULT.h,
      };
    }

    const parsed = JSON.parse(raw) as Partial<RectSize>;

    return {
      w: parsed.w ?? ROOM_DEFAULT.w,
      d: parsed.d ?? ROOM_DEFAULT.d,
      h: parsed.h ?? ROOM_DEFAULT.h,
    };
  } catch {
    return {
      w: ROOM_DEFAULT.w,
      d: ROOM_DEFAULT.d,
      h: ROOM_DEFAULT.h,
    };
  }
}

/* ============================================================
   Switch Shape
   ============================================================ */

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

/* ============================================================
   Helpers
   ============================================================ */

function pickVisibleWall(): string {
  const { room } = useRoomTwin.getState();

  if (room.shape !== "rect") {
    return "back";
  }

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
    {
      kind: "wall",
      wallId,
    },
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

  if (p.groundAnchor) {
    rebuildBaseboards();
  }
}

function updateWallItemPosition(
  uid: string,
  patch: {
    u?: number;
    v?: number;
    wallId?: string;
  },
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
    {
      kind: "wall",
      wallId,
    },
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

  if (product.groundAnchor) {
    rebuildBaseboards();
  }

  reclampAttachmentsOf(uid);
}

/* ============================================================
   Room Preview
   ============================================================ */

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
      saveLastRectSize({
        w: room.w,
        d: room.d,
        h: room.h,
      });
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

  let rects: Array<{
    x0: number;
    z0: number;
    x1: number;
    z1: number;
  }> = [];

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
      {
        x0: -room.w / 2,
        z0: -room.d / 2,
        x1: room.w / 2,
        z1: room.d / 2,
      },
    ];
  }

  if (rects.length === 0) {
    return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  rects.forEach((r) => {
    minX = Math.min(minX, r.x0);
    maxX = Math.max(maxX, r.x1);
    minZ = Math.min(minZ, r.z0);
    maxZ = Math.max(maxZ, r.z1);
  });

  const rw = maxX - minX;
  const rd = maxZ - minZ;

  if (rw <= 0 || rd <= 0) {
    return null;
  }

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
        isBlocksMode ? "คลิกเพื่อแก้ไขผังบล็อก" : "คลิกเพื่อวาดบล็อกผนังห้อง"
      }
    >
      <svg viewBox="0 0 240 158" width="100%" height="132">
        {isBlocksMode ? (
          <>
            <g fill="#fbf8f2">
              {rects.map((r, i) => (
                <polygon
                  key={i}
                  points={`
                      ${sx(r.x0)},${sy(r.z0)}
                      ${sx(r.x1)},${sy(r.z0)}
                      ${sx(r.x1)},${sy(r.z1)}
                      ${sx(r.x0)},${sy(r.z1)}
                    `}
                />
              ))}
            </g>

            <g fill="none" stroke="#b8752e" strokeWidth="0.8" opacity="0.5">
              {rects.map((r, i) => (
                <polygon
                  key={i}
                  points={`
                      ${sx(r.x0)},${sy(r.z0)}
                      ${sx(r.x1)},${sy(r.z0)}
                      ${sx(r.x1)},${sy(r.z1)}
                      ${sx(r.x0)},${sy(r.z1)}
                    `}
                />
              ))}
            </g>
          </>
        ) : (
          <>
            <polygon
              points={`
                ${sx(minX)},${sy(minZ)}
                ${sx(maxX)},${sy(minZ)}
                ${sx(maxX)},${sy(maxZ)}
                ${sx(minX)},${sy(maxZ)}
              `}
              fill="#fbf8f2"
            />

            <polygon
              points={`
                ${sx(minX)},${sy(minZ)}
                ${sx(maxX)},${sy(minZ)}
                ${sx(maxX)},${sy(maxZ)}
                ${sx(minX)},${sy(maxZ)}
              `}
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

            if (pw < 0.4 && ph < 0.4) {
              return null;
            }

            const labelY = pyc - Math.max(ph / 2, 3) - 3;

            return (
              <g key={s.uid}>
                <g
                  transform={`
                      rotate(
                        ${s.deg}
                        ${pxc}
                        ${pyc}
                      )
                    `}
                >
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
          transform={`
            rotate(
              -90
              ${sx(minX) - 16}
              79
            )
          `}
        >
          {rd.toFixed(1)} ม.
        </text>

        <text
          className="rsp-preview-label"
          textAnchor="middle"
          x="120"
          y="150"
          style={{
            fontSize: 9,
            fill: "#8a8275",
            opacity: 0.8,
          }}
        >
          {isBlocksMode ? "▦ คลิกเพื่อแก้ไขผัง" : "▦ คลิกเพื่อวาดบล็อก"}
        </text>
      </svg>
    </div>
  );
}

/* ============================================================
   Tab 1 : Size
   ============================================================ */

function SizeTab() {
  const room = useRoomTwin((s) => s.room);

  const setRoom = useRoomTwin((s) => s.setRoom);

  const { saveState, saveStateDebounced } = useSaveState();

  useEffect(() => {
    if (room.shape === "rect") {
      saveLastRectSize({
        w: room.w,
        d: room.d,
        h: room.h,
      });
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

    setRoom({
      [key]: v,
    } as any);

    saveStateDebounced();
  };

  const handlePresetClick = (w: number, d: number, h: number) => {
    setRoom({
      w,
      d,
      h,
      shape: "rect",
      blocks: null,
    });

    saveLastRectSize({
      w,
      d,
      h,
    });

    rebuildRoomShell();
    reclampAllToRoom();
    saveState();
  };

  const handleOpenBlocks = () => {
    saveLastRectSize({
      w: room.w,
      d: room.d,
      h: room.h,
    });

    window.dispatchEvent(new CustomEvent("roomtwin:openBlocksEditor"));
  };

  const handleSwitchToRect = async () => {
    if (room.shape === "rect") {
      return;
    }

    await switchToRectShape();

    saveState();
  };

  return (
    <div className="rsp-tab-panel active">
      <div className="rsp-dim">
        {/* ===== Shape Picker ===== */}
        <div className="rsp-shps" role="group" aria-label="รูปทรงห้อง">
          <button
            type="button"
            className={`rsp-shp${room.shape === "rect" ? " active" : ""}`}
            onClick={handleSwitchToRect}
            aria-pressed={room.shape === "rect"}
          >
            <span className="rsp-shi" aria-hidden="true">
              <i className="rsp-rct" />
            </span>
            <span className="rsp-shx">
              <b>สี่เหลี่ยม</b>
              <small>ปรับด้วยสไลเดอร์</small>
            </span>
          </button>

          <button
            type="button"
            className={`rsp-shp${room.shape === "blocks" ? " active" : ""}`}
            onClick={handleOpenBlocks}
            aria-pressed={room.shape === "blocks"}
          >
            <span className="rsp-shi" aria-hidden="true">
              <svg
                viewBox="0 0 20 20"
                width="22"
                height="22"
                aria-hidden="true"
              >
                <rect
                  x="1.5"
                  y="1.5"
                  width="17"
                  height="17"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M7.2 1.5v17M12.8 1.5v17M1.5 7.2h17M1.5 12.8h17"
                  stroke="currentColor"
                  strokeWidth="1"
                  opacity=".55"
                />
                <rect x="7.6" y="7.6" width="4.8" height="4.8" fill="#b4702b" />
                <rect
                  x="13.2"
                  y="7.6"
                  width="4.8"
                  height="4.8"
                  fill="#b4702b"
                />
                <rect
                  x="7.6"
                  y="13.2"
                  width="4.8"
                  height="4.8"
                  fill="#b4702b"
                />
              </svg>
            </span>
            <span className="rsp-shx">
              <b>วาดบล็อก</b>
              <small>อิสระ เพิ่ม-ลบช่อง</small>
            </span>
          </button>
        </div>
      </div>

      <RoomPreviewSvg />

      {room.shape !== "blocks" && (
        <div className="rsp-presets">
          {[
            { w: 3.4, d: 3.0, h: 2.5, name: "ห้องเล็ก" },
            { w: 4.2, d: 3.6, h: 2.6, name: "ห้องกลาง" },
            { w: 5.6, d: 4.6, h: 2.8, name: "ห้องใหญ่" },
          ].map((p, i) => {
            const isActive =
              Math.abs(room.w - p.w) < 0.01 &&
              Math.abs(room.d - p.d) < 0.01 &&
              Math.abs(room.h - p.h) < 0.01;

            return (
              <button
                key={i}
                type="button"
                className={`rsp-preset-card${isActive ? " active" : ""}`}
                onClick={() => handlePresetClick(p.w, p.d, p.h)}
                aria-pressed={isActive}
              >
                <span className="rsp-pvw" aria-hidden="true">
                  <i style={{ width: p.w * 8, height: p.d * 8 }} />
                </span>

                <span className="rsp-ps-name">{p.name}</span>
                <span className="rsp-ps-dims">
                  {p.w.toFixed(1)}×{p.d.toFixed(1)} ม.
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="rsp-card">
        <div className="rsp-size-head">
          <h2>📏 ปรับเอง</h2>
          <span className="area">
            พื้นที่ {(room.w * room.d).toFixed(1)} ตร.ม.
          </span>
        </div>

        {(["w", "d", "h"] as const).map((key) => {
          const lim = ROOM_LIMITS[key];

          const label =
            key === "w"
              ? "กว้าง (ซ้าย–ขวา)"
              : key === "d"
                ? "ลึก (หน้า–หลัง)"
                : "สูง";

          const disabled = room.shape === "blocks" && key !== "h";

          const value = room[key];

          const decimals = key === "h" ? 2 : 1;

          const atMin = value <= lim.min + 1e-9;
          const atMax = value >= lim.max - 1e-9;

          return (
            <div key={key} className={`rsp-dim${disabled ? " in-blocks" : ""}`}>
              <span className="rsp-dim-sub-label">{label}</span>

              <div className="rsp-stepper">
                <button
                  type="button"
                  className="rsp-step-btn"
                  onClick={() => handleDimChange(key, value - lim.step)}
                  disabled={atMin}
                  aria-label={`ลด${label}`}
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

                      if (!isNaN(v)) {
                        handleDimChange(key, v);
                      }
                    }}
                    aria-label={label}
                  />

                  <span className="rsp-unit">ม.</span>
                </div>

                <button
                  type="button"
                  className="rsp-step-btn"
                  onClick={() => handleDimChange(key, value + lim.step)}
                  disabled={atMax}
                  aria-label={`เพิ่ม${label}`}
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
                style={
                  {
                    "--p": sliderProgressPct(value, lim.min, lim.max),
                  } as React.CSSProperties
                }
                aria-label={`สไลเดอร์${label}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Tab: Surfaces (Floor + Wall + Ceiling + Baseboard)
   ============================================================ */

function SurfacesTab({ section }: { section: "floor" | "wall" }) {
  const surface = useRoomTwin((s) => s.surface);

  const setSurface = useRoomTwin((s) => s.setSurface);

  const { saveState } = useSaveState();

  /* ⭐ state: ผนังที่กำลังเลือกอยู่ */
  const [wallSel, setWallSel] = useState<WallKey>("back");

  const commit = (patch: Partial<typeof surface>) => {
    setSurface(patch);

    // ⭐ เปลี่ยนบัว → rebuild mesh ใหม่พร้อมสีใหม่ (applySurface จะเรียก rebuild อยู่แล้วด้วย)
    applySurfaceToThree();

    saveState();
  };

  const showFloor = section === "floor";
  const showWall = section === "wall";

  /* ⭐ ค่าสีปัจจุบันของผนังที่เลือก */
  const currentWallColor =
    surface.walls[wallSel] !== undefined
      ? surface.walls[wallSel]
      : surface.wallAll;

  /* ⭐ ค่าสีบัวปัจจุบัน */
  const currentBaseboard = surface.baseboard ?? 0xfbf6ec;

  const currentFloorTint = surface.floorTint ?? 0xffffff;

  return (
    <div className="rsp-tab-panel active">
      {showFloor && (
        <>
          {/* ═══════════ วัสดุพื้น ═══════════ */}
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
                    backgroundImage: `url(${makeFloorCanvas(
                      st.id,
                      96,
                    ).toDataURL()})`,
                    backgroundColor: hexOf(currentFloorTint),
                    backgroundBlendMode: "multiply",
                  }}
                  onClick={() =>
                    commit({
                      floor: st.id,
                    })
                  }
                >
                  <div className="fl-name">{st.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══════════ ⭐ สีพื้น ═══════════ */}
          <div className="rsp-subsec">
            <div className="rsp-subsec-title">🎨 สีพื้น</div>

            <div className="wall-color-grid">
              {FLOOR_TINT_PALETTE.map((c) => (
                <div
                  key={c}
                  className={`wall-color-chip${
                    currentFloorTint === c ? " active" : ""
                  }`}
                  style={{ background: hexOf(c) }}
                  onClick={() => commit({ floorTint: c })}
                  role="button"
                  tabIndex={0}
                  aria-pressed={currentFloorTint === c}
                />
              ))}
            </div>

            <label className="cz-row">
              <input
                type="color"
                className="cz-color-input"
                value={hexOf(currentFloorTint)}
                onChange={(e) => commit({ floorTint: numOf(e.target.value) })}
                aria-label="เลือกสีพื้นเอง"
              />
              <span className="cz-row-label">เลือกสีเอง</span>
              <span className="cz-color-hex">
                {hexOf(currentFloorTint).toUpperCase()}
              </span>
            </label>
          </div>
        </>
      )}

      {showWall && (
        <>
          {/* ═══════════ สีผนัง ═══════════ */}
          <div className="rsp-subsec">
            <div
              className="wall-uniform-seg"
              role="group"
              aria-label="โหมดทาสีผนัง"
            >
              <button
                type="button"
                className={surface.wallUniform ? "on" : ""}
                onClick={() => {
                  if (!surface.wallUniform) {
                    commit({ wallUniform: true });
                  }
                }}
                aria-pressed={surface.wallUniform}
              >
                🏠 ทุกผนังสีเดียว
              </button>

              <button
                type="button"
                className={!surface.wallUniform ? "on" : ""}
                onClick={() => {
                  if (surface.wallUniform) {
                    const walls: Record<string, number> = {};

                    WALL_KEYS.forEach((id) => {
                      walls[id] = surface.wallAll;
                    });

                    commit({ wallUniform: false, walls });
                  }
                }}
                aria-pressed={!surface.wallUniform}
              >
                🧱 แยกทีละผนัง
              </button>
            </div>

            {!surface.wallUniform && (
              <div
                className="wall-picker-row"
                role="tablist"
                aria-label="เลือกผนัง"
              >
                {WALL_KEYS.map((id) => {
                  const c =
                    surface.walls[id] !== undefined
                      ? surface.walls[id]
                      : surface.wallAll;

                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={wallSel === id}
                      className={`wall-pick${wallSel === id ? " on" : ""}`}
                      onClick={() => setWallSel(id)}
                    >
                      <i
                        className="wpv"
                        style={{ background: hexOf(c) }}
                        aria-hidden="true"
                      />
                      <span>{WALL_SHORT[id]}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="rsp-subsec-title">
              {surface.wallUniform
                ? "🎨 สีทุกผนัง"
                : `🎨 สีผนัง${WALL_SHORT[wallSel]}`}
            </div>

            <div className="wall-color-grid">
              {WALL_COLOR_PALETTE.map((c) => {
                const isActive = surface.wallUniform
                  ? surface.wallAll === c
                  : currentWallColor === c;

                return (
                  <div
                    key={c}
                    className={`wall-color-chip${isActive ? " active" : ""}`}
                    style={{ background: hexOf(c) }}
                    onClick={() => {
                      if (surface.wallUniform) {
                        commit({ wallAll: c });
                      } else {
                        commit({
                          walls: { ...surface.walls, [wallSel]: c },
                        });
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                  />
                );
              })}
            </div>

            <label className="cz-row">
              <input
                type="color"
                className="cz-color-input"
                value={hexOf(
                  surface.wallUniform ? surface.wallAll : currentWallColor,
                )}
                onChange={(e) => {
                  const v = numOf(e.target.value);

                  if (surface.wallUniform) {
                    commit({ wallAll: v });
                  } else {
                    commit({
                      walls: { ...surface.walls, [wallSel]: v },
                    });
                  }
                }}
                aria-label="เลือกสีเอง"
              />
              <span className="cz-row-label">เลือกสีเอง</span>
              <span className="cz-color-hex">
                {hexOf(
                  surface.wallUniform ? surface.wallAll : currentWallColor,
                ).toUpperCase()}
              </span>
            </label>
          </div>

          {/* ═══════════ สีเพดาน ═══════════ */}
          <div className="rsp-subsec">
            <div className="rsp-subsec-title">⬜ สีเพดาน</div>

            <div className="wall-color-grid">
              {CEILING_COLOR_PALETTE.map((c) => (
                <div
                  key={c}
                  className={`wall-color-chip${
                    surface.ceiling === c ? " active" : ""
                  }`}
                  style={{ background: hexOf(c) }}
                  onClick={() => commit({ ceiling: c })}
                  role="button"
                  tabIndex={0}
                  aria-pressed={surface.ceiling === c}
                />
              ))}
            </div>

            <label className="cz-row">
              <input
                type="color"
                className="cz-color-input"
                value={hexOf(surface.ceiling)}
                onChange={(e) => commit({ ceiling: numOf(e.target.value) })}
                aria-label="เลือกสีเพดานเอง"
              />
              <span className="cz-row-label">เลือกสีเอง</span>
              <span className="cz-color-hex">
                {hexOf(surface.ceiling).toUpperCase()}
              </span>
            </label>
          </div>

          {/* ═══════════ ⭐ สีบัว ═══════════ */}
          <div className="rsp-subsec">
            <div className="rsp-subsec-title">📏 สีบัว</div>

            <div className="wall-color-grid is-4">
              {BASEBOARD_COLOR_PALETTE.map((c) => (
                <div
                  key={c}
                  className={`wall-color-chip${
                    currentBaseboard === c ? " active" : ""
                  }`}
                  style={{ background: hexOf(c) }}
                  onClick={() => commit({ baseboard: c })}
                  role="button"
                  tabIndex={0}
                  aria-pressed={currentBaseboard === c}
                />
              ))}
            </div>

            <label className="cz-row">
              <input
                type="color"
                className="cz-color-input"
                value={hexOf(currentBaseboard)}
                onChange={(e) => commit({ baseboard: numOf(e.target.value) })}
                aria-label="เลือกสีบัวเอง"
              />
              <span className="cz-row-label">เลือกสีเอง</span>
              <span className="cz-color-hex">
                {hexOf(currentBaseboard).toUpperCase()}
              </span>
            </label>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Structure Step
   ============================================================ */

function OpeningsTab() {
  const placedItems = useRoomTwin((s) => s.placedItems);

  const { placeProduct, placeThemedProduct, placeZone } = usePlacement();
  const { startDrag } = useCardDrag({
    placeProduct,
    placeThemedProduct,
    placeZone,
  });

  const structureProducts = useMemo<ProductDef[]>(
    () =>
      STRUCTURE_IDS.map((id) => PRODUCT_BY_ID.get(id)).filter(
        (p): p is ProductDef => !!p,
      ),
    [],
  );

  const countByProduct = useMemo(() => {
    const map = new Map<string, number>();

    placedItems.forEach((i) => {
      if (!i.wallMount) return;
      map.set(i.productId, (map.get(i.productId) ?? 0) + 1);
    });

    return map;
  }, [placedItems]);

  const placedStructure = useMemo(
    () => placedItems.filter((i) => i.wallMount),
    [placedItems],
  );

  return (
    <div className="rsp-tab-panel active">
      <div className="rsp-tip">
        <span aria-hidden="true">✋</span>
        <span>
          <b>ลาก</b>การ์ดไปวางบนผนังในห้อง
        </span>
      </div>

      <div className="rsp-pcs">
        {structureProducts.map((p) => {
          const count = countByProduct.get(p.id) ?? 0;

          const icon = getProductIcon(p);

          return (
            <div
              key={p.id}
              className="rsp-pc"
              role="button"
              tabIndex={0}
              aria-label={`${p.name} — ลากไปวางบนผนัง`}
              data-id={p.id}
              data-kind="product"
              data-key={p.id}
              data-emojis={icon}
              data-tile={hexOf(p.color)}
              data-count={count > 0 ? count : undefined}
              style={
                {
                  "--tile": hexOf(p.color),
                } as React.CSSProperties
              }
              onPointerDown={(e) =>
                startDrag(e, p.id, e.currentTarget, "product", null)
              }
            >
              {count > 0 && <i className="rsp-n">×{count}</i>}

              <span className="rsp-ic2">{icon}</span>
              <span>{p.name}</span>
              <small>
                {p.dims.w}×{p.dims.h} ซม.
              </small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Root Panel
   ============================================================ */

export default function RoomStructurePanel({
  embedded = false,
  onDone,
}: {
  embedded?: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const [tab, setTab] = useState<Tab>("size");

  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(["size"]));

  const handleTabClick = useCallback((t: Tab) => {
    setTab(t);

    setVisited((prev) => {
      if (prev.has(t)) return prev;

      const next = new Set(prev);

      next.add(t);

      return next;
    });
  }, []);

  const stepIdx = ROOM_SETUP_STEPS.findIndex((s) => s.id === tab);

  const handlePrev = useCallback(() => {
    if (stepIdx > 0) handleTabClick(ROOM_SETUP_STEPS[stepIdx - 1].id);
  }, [stepIdx, handleTabClick]);

  const handleNext = useCallback(() => {
    if (stepIdx < ROOM_SETUP_STEPS.length - 1) {
      handleTabClick(ROOM_SETUP_STEPS[stepIdx + 1].id);
    } else {
      onDone?.();
    }
  }, [stepIdx, handleTabClick, onDone]);

  const panelRef = useRef<HTMLDivElement>(null);

  const closePanel = useCallback(() => {
    setOpen(false);
  }, []);

  const positionPanel = useCallback(() => {
    if (!panelRef.current) {
      return;
    }

    const btn = document.getElementById("roomSizeBtn");

    if (!btn) {
      return;
    }

    const r = btn.getBoundingClientRect();

    const w = panelRef.current.offsetWidth || 380;

    const margin = 8;

    let left = r.right - w;

    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));

    const top = r.bottom + 6;

    panelRef.current.style.left = left + "px";

    panelRef.current.style.top = top + "px";
  }, []);

  useEffect(() => {
    if (embedded || !open) {
      return;
    }

    positionPanel();

    window.addEventListener("resize", positionPanel);

    return () => window.removeEventListener("resize", positionPanel);
  }, [embedded, open, positionPanel]);

  useEffect(() => {
    if (embedded || !open) {
      return;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();

        closePanel();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [embedded, open, closePanel]);

  useEffect(() => {
    if (embedded) {
      return;
    }

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
  }, [embedded]);

  /* ==========================================================
     EMBEDDED MODE
     ========================================================== */

  if (embedded) {
    const meta = ROOM_SETUP_STEP_META[tab];

    const isFirst = stepIdx === 0;

    const isLast = stepIdx === ROOM_SETUP_STEPS.length - 1;

    return (
      <div className="rsp-embedded-wrap" onClick={(e) => e.stopPropagation()}>
        <nav className="rsp-tracker" aria-label="ขั้นตอนตั้งค่าห้อง">
          {ROOM_SETUP_STEPS.map((s) => {
            const isOn = tab === s.id;

            const isSeen = visited.has(s.id);

            const isDone = isSeen && !isOn;

            return (
              <button
                key={s.id}
                type="button"
                className={`rsp-trk ${isSeen ? "seen" : ""} ${
                  isDone ? "done" : ""
                } ${isOn ? "on" : ""}`}
                onClick={() => handleTabClick(s.id)}
                aria-current={isOn ? "step" : undefined}
              >
                <span className="rsp-tn">{isDone ? "✓" : s.num}</span>

                <span className="rsp-tl">{s.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="rsp-step-head">
          <span
            className="rsp-sh-icon"
            style={{ "--tile": meta.tint } as React.CSSProperties}
            aria-hidden="true"
          >
            {meta.icon}
          </span>

          <div className="rsp-sh-body">
            <h1 className="rsp-sh-title">{meta.title}</h1>

            <p className="rsp-sh-desc">{meta.desc}</p>
          </div>
        </div>

        <div className="rsp-body">
          {tab === "size" && <SizeTab />}

          {tab === "structure" && <OpeningsTab />}

          {tab === "floor" && <SurfacesTab section="floor" />}

          {tab === "wall" && <SurfacesTab section="wall" />}
        </div>

        <div className="rsp-footer">
          <button
            type="button"
            className="rsp-fb"
            onClick={handlePrev}
            disabled={isFirst}
            aria-label="ย้อนกลับ"
          >
            ‹
          </button>
          <button type="button" className="rsp-cta" onClick={handleNext}>
            {ROOM_SETUP_CTA_LABEL[stepIdx]}
          </button>
        </div>

        {isLast && (
          <p className="rsp-cta-hint">
            แก้ไขได้ตลอดที่แท็บ <b>&ldquo;สร้างห้อง&rdquo;</b>
          </p>
        )}
      </div>
    );
  }

  /* ==========================================================
     POPUP MODE
     ========================================================== */

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
        style={{
          position: "fixed",
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
        aria-hidden={!open}
        inert={!open}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rsp-header">
          <b>🏗️ ปรับแต่งโครงสร้างห้อง</b>
          <IconButton label="ปิด" size="md" onClick={closePanel}>
            ✕
          </IconButton>
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
            className={`rsp-tab${tab === "structure" ? " active" : ""}`}
            onClick={() => setTab("structure")}
          >
            🚪 ช่องเปิด
          </button>

          <button
            type="button"
            className={`rsp-tab${tab === "floor" ? " active" : ""}`}
            onClick={() => setTab("floor")}
          >
            🟫 พื้น
          </button>

          <button
            type="button"
            className={`rsp-tab${tab === "wall" ? " active" : ""}`}
            onClick={() => setTab("wall")}
          >
            🎨 ผนัง
          </button>
        </div>

        <div className="rsp-body">
          {tab === "size" && <SizeTab />}

          {tab === "structure" && <OpeningsTab />}

          {tab === "floor" && <SurfacesTab section="floor" />}

          {tab === "wall" && <SurfacesTab section="wall" />}
        </div>
      </div>
    </>
  );
}
