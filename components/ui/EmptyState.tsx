// components/ui/EmptyState.tsx
"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

export interface EmptyStateProps {
  /** emoji หรือ icon */
  icon: string;
  /** หัวข้อหลัก */
  title: string;
  /** คำอธิบายรอง */
  sub?: string;
  /** ปุ่ม action (optional) — DS บอก "ชวนกดต่อ" */
  action?: ReactNode;
  /** CSS class เสริม */
  className?: string;
}

export function EmptyState({
  icon,
  title,
  sub,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx("empty-state", className)}>
      <span className="empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <b className="empty-state-title">{title}</b>
      {sub && <span className="empty-state-sub">{sub}</span>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}