// components/ToastHost.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type { ToastPayload } from "@/lib/utils/toast";

const EVENT = "roomtwin:ui-toast";
const MAX_STACK = 3;

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const onShow = (e: Event) => {
      const detail = (e as CustomEvent<ToastPayload>).detail;
      if (!detail?.msg) return;
      setToasts((list) => [...list, detail].slice(-MAX_STACK));
    };
    window.addEventListener(EVENT, onShow);
    return () => window.removeEventListener(EVENT, onShow);
  }, []);

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <ToastItem key={t.id} payload={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  payload,
  onDismiss,
}: {
  payload: ToastPayload;
  onDismiss: (id: string) => void;
}) {
  const { id, msg, undo, undoLabel, duration } = payload;

  useEffect(() => {
    if (duration <= 0) return;
    const t = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(t);
  }, [id, duration, onDismiss]);

  const handleUndo = async () => {
    onDismiss(id);
    try {
      await undo?.();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="toast-pill" role="status">
      <span className="toast-msg">{msg}</span>
      {undo && (
        <button
          type="button"
          className="toast-undo"
          onClick={handleUndo}
        >
          {undoLabel}
        </button>
      )}
    </div>
  );
}