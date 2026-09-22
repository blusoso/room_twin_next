// components/ui/Modal.tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { cx } from "./cx";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** CSS class ของ overlay (เช่น "confirm-overlay") */
  overlayClass: string;
  /** CSS class ของ box (เช่น "confirm-box") */
  boxClass: string;
  /** ปิดเมื่อคลิก backdrop (default: true) */
  closeOnBackdrop?: boolean;
  /** ปิดเมื่อกด Escape (default: true) */
  closeOnEscape?: boolean;
  /** id ของ element ที่อธิบาย modal (สำหรับ aria-labelledby) */
  labelledBy?: string;
}

export function Modal({
  open,
  onClose,
  children,
  overlayClass,
  boxClass,
  closeOnBackdrop = true,
  closeOnEscape = true,
  labelledBy,
}: ModalProps) {
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
    <div
      className={cx(overlayClass, open && "show")}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      aria-hidden={!open}
    >
      <div
        className={boxClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>
  );
}