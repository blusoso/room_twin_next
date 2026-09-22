// components/ui/Panel.tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { cx } from "./cx";

export interface PanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** CSS class ของ aside (เช่น "customize-panel") */
  panelClass: string;
  /** CSS class ของ backdrop (ถ้ามี) */
  backdropClass?: string;
  /** z-index class (เช่น "z-29") */
  backdropZ?: string;
  /** ปิดเมื่อกด Escape (default: true) */
  closeOnEscape?: boolean;
  /** aria-labelledby */
  labelledBy?: string;
}

export function Panel({
  open,
  onClose,
  children,
  panelClass,
  backdropClass = "panel-backdrop",
  backdropZ,
  closeOnEscape = true,
  labelledBy,
}: PanelProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  return (
    <>
      {open && backdropClass && (
        <div
          className={cx(backdropClass, backdropZ, "show")}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cx(panelClass, open && "show")}
        aria-hidden={!open}
        aria-labelledby={labelledBy}
        style={{
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
        {...(!open ? { inert: "" as any } : {})}
      >
        {children}
      </aside>
    </>
  );
}
