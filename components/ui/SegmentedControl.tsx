// components/ui/SegmentedControl.tsx
"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

export interface SegmentOption<T extends string = string> {
  value: T;
  /** เนื้อหาในปุ่ม — ใส่ emoji + text, หรือแค่ text ก็ได้ */
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  /** CSS class ของ container (เช่น "panel-main-tabs") */
  containerClass: string;
  /** CSS class ของปุ่มแต่ละตัว (เช่น "panel-main-tab") */
  optionClass: string;
  /** CSS class ของปุ่ม active (default: "active") */
  activeClass?: string;
  /** CSS class เสริม */
  className?: string;
  /** aria-label ของกลุ่ม */
  ariaLabel?: string;
}

export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  containerClass,
  optionClass,
  activeClass = "active",
  className,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cx(containerClass, className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            className={cx(optionClass, active && activeClass)}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}