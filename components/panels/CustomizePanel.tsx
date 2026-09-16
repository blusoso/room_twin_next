// components/panels/CustomizePanel.tsx
"use client";
import { useCallback, useEffect } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { PRODUCT_BY_ID, defaultParamsFor } from "@/lib/data/products";
import { PARAM_SCHEMA } from "@/lib/data/schemas";
import { clampPresetParams, hasSizePresets } from "@/lib/data/sizePresets";
import type { SizePreset } from "@/lib/data/sizePresets";
import { hexOf, numOf } from "@/lib/utils/format";
import { reinstantiateItem } from "@/lib/three/instantiate";
import { resolveRestHeights } from "@/lib/three/placement";
import { rebuildBaseboards } from "@/lib/three/roomShell";
// ⭐ แก้ params ใช้เจ้าของเดียวร่วมกับปุ่มขนาดบน floating toolbar
import { applyParamEdit, applyParamsPatch } from "@/lib/three/paramEdit";
import SizePresetList from "./SizePresetList";
import { useSaveState } from "@/hooks/useSaveState";
import type { PlacedItem } from "@/lib/state/types";
import type { DimDef, ColorDef, BoolDef } from "@/lib/data/schemas";

export default function CustomizePanel() {
  const targetUid = useRoomTwin((s) => s.customizeTargetUid);
  const setTarget = useRoomTwin((s) => s.setCustomizeTarget);
  const placedItems = useRoomTwin((s) => s.placedItems);
  const { saveState } = useSaveState();

  const item = targetUid
    ? placedItems.find((i) => i.uid === targetUid)
    : null;
  const open = !!item;

  const close = useCallback(() => {
    setTarget(null);
    saveState();
  }, [setTarget, saveState]);

  // Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      {/* ⭐ Backdrop — render เฉพาะตอน open */}
      {open && (
        <div
          className="panel-backdrop z-29 show"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={`customize-panel${open ? " show" : ""}`}
        aria-hidden={!open}
        // ⭐ Inline styles — บังคับแม้ CSS ไม่โหลด
        style={{
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
        // ⭐ inert — block ทุก interaction เมื่อปิด
        {...(!open ? { inert: "" as any } : {})}
      >
        <div className="cz-head">
          <div className="cz-head-main">
            <div className="cz-title">
              {item
                ? `🎨 ${item.displayName || PRODUCT_BY_ID.get(item.productId)?.name || ""}`
                : "ปรับแต่ง"}
            </div>
            <div className="cz-subtitle">
              ปรับขนาด สี และตัวเลือก — เห็นผลทันทีในห้อง
            </div>
          </div>
          <button
            type="button"
            className="cz-close"
            onClick={close}
            title="ปิด"
          >
            ✕
          </button>
        </div>

        {item && <CustomizeBody item={item} onSave={close} />}
      </aside>
    </>
  );
}

// ============================================================
// Body
// ============================================================

function CustomizeBody({
  item,
  onSave,
}: {
  item: PlacedItem;
  onSave: () => void;
}) {
  const schema = PARAM_SCHEMA[item.productId];
  if (!schema) return null;

  const product = PRODUCT_BY_ID.get(item.productId);
  if (!product) return null;

  const hasDims = !!(schema.dims && schema.dims.length);
  const hasColors = !!(schema.colors && schema.colors.length);
  const hasBools = !!(schema.bools && schema.bools.length);

  const handleReset = () => {
    useRoomTwin.getState().updateItem(item.uid, {
      params: defaultParamsFor(product),
      themeOverride: undefined,
      displayName: null,
    });
    reinstantiateItem(item.uid);
    resolveRestHeights();
    rebuildBaseboards();
  };

  return (
    <>
      <div className="cz-body">
        {hasDims && (
          <div className="cz-section">
            <div className="cz-section-label">📐 ขนาด</div>
            {/* ⭐ ขนาดสำเร็จรูป — แตะเดียวได้ขนาดที่รู้จักชื่อ (รายการเดียวกับปุ่ม 📐 บน toolbar) */}
            {hasSizePresets(item.productId) && (
              <SizePresetList
                productId={item.productId}
                params={item.params}
                variant="chips"
                onPick={(preset: SizePreset) =>
                  applyParamsPatch(
                    item,
                    clampPresetParams(item.productId, preset.params),
                  )
                }
              />
            )}
            {schema.dims!.map((def) => (
              <DimRow key={def.key} item={item} def={def} />
            ))}
          </div>
        )}

        {hasColors && (
          <div className="cz-section">
            <div className="cz-section-label">🎨 สี</div>
            {schema.colors!.map((def) => (
              <ColorRow key={def.key} item={item} def={def} />
            ))}
          </div>
        )}

        {hasBools && (
          <div className="cz-section">
            <div className="cz-section-label">⚙️ ตัวเลือกเพิ่มเติม</div>
            {schema.bools!.map((def) => (
              <BoolRow key={def.key} item={item} def={def} />
            ))}
          </div>
        )}
      </div>

      <div className="cz-foot">
        <button
          type="button"
          className="cz-reset"
          onClick={handleReset}
        >
          คืนค่าเดิม
        </button>
        <button
          type="button"
          className="cz-save"
          onClick={onSave}
        >
          เสร็จสิ้น
        </button>
      </div>
    </>
  );
}

// ============================================================
// Rows
// ============================================================

function DimRow({ item, def }: { item: PlacedItem; def: DimDef }) {
  const value =
    item.params[def.key] !== undefined ? item.params[def.key] : def.min;
  const commit = (v: number) => {
    const clamped = Math.round(Math.max(def.min, Math.min(def.max, v)));
    if (clamped === value) return;
    applyParamEdit(item, def.key, clamped);
  };

  return (
    <div className="cz-row">
      <label className="cz-row-label">{def.label}</label>
      <div className="cz-row-control">
        <input
          type="range"
          className="cz-slider"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={(e) => commit(parseFloat(e.target.value))}
        />
        <input
          type="number"
          className="cz-num-input"
          inputMode="decimal"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) commit(v);
          }}
        />
        <span className="cz-unit">ซม.</span>
      </div>
    </div>
  );
}

function ColorRow({ item, def }: { item: PlacedItem; def: ColorDef }) {
  const value = item.params[def.key] ?? 0xcccccc;
  return (
    <div className="cz-row">
      <label className="cz-row-label">{def.label}</label>
      <div className="cz-row-control">
        <input
          type="color"
          className="cz-color-input"
          value={hexOf(value)}
          onChange={(e) => applyParamEdit(item, def.key, numOf(e.target.value))}
        />
        <span className="cz-color-hex">
          {hexOf(value).toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function BoolRow({ item, def }: { item: PlacedItem; def: BoolDef }) {
  const checked = !!item.params[def.key];
  return (
    <div className="cz-row">
      <label className="cz-row-label">{def.label}</label>
      <div className="cz-row-control">
        <label className="cz-toggle">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) =>
              applyParamEdit(item, def.key, e.target.checked)
            }
          />
          <span className="cz-toggle-track" />
        </label>
      </div>
    </div>
  );
}