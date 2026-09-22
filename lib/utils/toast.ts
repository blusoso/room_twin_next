// lib/utils/toast.ts
//
// ⭐ Toast + Undo per DS (.toast)
//    - Dark pill + inline undo button
//    - Auto-dismiss ~4.5 วิ
//    - Listener อยู่ใน components/ToastHost.tsx (event: roomtwin:ui-toast)

export interface ToastOptions {
  /** ปุ่ม "เลิกทำ" ในตัว toast */
  undo?: () => void | Promise<void>;
  /** label ของปุ่ม undo (default: "เลิกทำ") */
  undoLabel?: string;
  /** ระยะเวลาแสดง (ms) — default 4500 */
  duration?: number;
}

export interface ToastPayload {
  id: string;
  msg: string;
  undo?: () => void | Promise<void>;
  undoLabel: string;
  duration: number;
}

const EVENT = "roomtwin:ui-toast";

export function showToast(msg: string, opts: ToastOptions = {}): void {
  if (typeof window === "undefined") return;

  const payload: ToastPayload = {
    id: `t${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    msg,
    undo: opts.undo,
    undoLabel: opts.undoLabel ?? "เลิกทำ",
    duration: opts.duration ?? 4500,
  };

  window.dispatchEvent(new CustomEvent(EVENT, { detail: payload }));
}