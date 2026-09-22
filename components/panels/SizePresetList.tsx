// components/panels/SizePresetList.tsx
"use client";
// ⭐ รายการ "ขนาดสำเร็จรูป" (presentational เท่านั้น — ไม่แตะ store/three)
//    ใช้ 2 ที่:
//      variant="menu"  → เมนู popover ของ floating toolbar (แถวแนวตั้ง มี ✓ "ใช้อยู่")
//      variant="chips" → chip row ในแผงปรับแต่ง (เหนือสไลเดอร์ขนาด)

import { matchSizePreset, sizePresetGroup } from "@/lib/data/sizePresets";
import type { SizePreset } from "@/lib/data/sizePresets";
import type { Params } from "@/lib/state/types";
import { Chip } from "@/components/ui";

interface Props {
  productId: string;
  params: Params;
  variant: "menu" | "chips";
  onPick: (preset: SizePreset) => void;
}

export default function SizePresetList({
  productId,
  params,
  variant,
  onPick,
}: Props) {
  const group = sizePresetGroup(productId);
  if (!group) return null;

  const active = matchSizePreset(productId, params);

  // ── chips variant → ใช้ <Chip> (pattern เดียวกับ CatalogFilterPanel) ──
  if (variant === "chips") {
    return (
      <div className="cz-presets">
        {group.presets.map((preset) => {
          const isActive = active?.id === preset.id;
          return (
            <Chip
              key={preset.id}
              active={isActive}
              title={preset.sub}
              onClick={() => onPick(preset)}
            >
              {preset.label}
            </Chip>
          );
        })}
      </div>
    );
  }

  // ── menu variant → คงไว้เดิม (structure เฉพาะ: label + sub + check) ──
  return (
    <div className="sm-list">
      {group.presets.map((preset) => {
        const isActive = active?.id === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            className={`size-opt${isActive ? " active" : ""}`}
            title={preset.sub}
            aria-current={isActive ? "true" : undefined}
            onClick={() => onPick(preset)}
          >
            <span className="size-opt-main">
              <span className="size-opt-label">{preset.label}</span>
              <span className="size-opt-sub">{preset.sub}</span>
            </span>
            {isActive && (
              <span className="size-opt-check">✓ ใช้อยู่</span>
            )}
          </button>
        );
      })}
    </div>
  );
}