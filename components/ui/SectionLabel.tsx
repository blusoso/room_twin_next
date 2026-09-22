// components/ui/SectionLabel.tsx
"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

export interface SectionLabelProps {
  /** emoji หรือ icon สั้น ๆ */
  icon?: string;
  /** ข้อความ label */
  children: ReactNode;
  /** CSS class เสริม */
  className?: string;
}

export function SectionLabel({
  icon,
  children,
  className,
}: SectionLabelProps) {
  return (
    <div className={cx("section-label", className)}>
      {icon && (
        <span className="section-label-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="section-label-text">{children}</span>
    </div>
  );
}