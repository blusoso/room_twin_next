// components/modals/useModalStores.ts
"use client";
import { create } from "zustand";

// ============================================================
// Confirm Modal Store
// ============================================================

interface ConfirmState {
  open: boolean;
  message: string;
  onConfirm: (() => void) | null;
  openConfirm: (message: string, onConfirm: () => void) => void;
  closeConfirm: () => void;
  confirm: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  message: "",
  onConfirm: null,

  openConfirm: (message, onConfirm) =>
    set({ open: true, message, onConfirm }),

  closeConfirm: () => set({ open: false, onConfirm: null }),

  confirm: () => {
    const cb = get().onConfirm;
    set({ open: false, onConfirm: null });
    if (cb) cb();
  },
}));

/**
 * Helper นอก React — ใช้ได้จาก usePlacement / usePointerInteraction ฯลฯ
 */
export function openConfirm(msg: string, onConfirm: () => void) {
  useConfirmStore.getState().openConfirm(msg, onConfirm);
}

export function closeConfirm() {
  useConfirmStore.getState().closeConfirm();
}

// ============================================================
// Zone Edit Modal Store
// ============================================================

interface ZoneEditState {
  targetUid: string | null;
  openZoneEdit: (zuid: string) => void;
  closeZoneEdit: () => void;
}

export const useZoneEditStore = create<ZoneEditState>((set) => ({
  targetUid: null,
  openZoneEdit: (zuid) => set({ targetUid: zuid }),
  closeZoneEdit: () => set({ targetUid: null }),
}));

export function openZoneEditDialog(zuid: string) {
  useZoneEditStore.getState().openZoneEdit(zuid);
}

export function closeZoneEditDialog() {
  useZoneEditStore.getState().closeZoneEdit();
}