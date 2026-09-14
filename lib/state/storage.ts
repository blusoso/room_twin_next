// lib/state/storage.ts
import { STORAGE_KEY } from "@/lib/data/constants";
import type { SerializedState } from "./types";

export function saveToStorage(state: SerializedState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* quota / private mode — ignore */
  }
}

export function loadFromStorage(): SerializedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SerializedState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

export function clearStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* ignore */
  }
}

export function trackAffiliateClick(): void {
  if (typeof window === "undefined") return;
  try {
    const key = "roomtwin_clicks";
    const n = Number(localStorage.getItem(key) || "0") + 1;
    localStorage.setItem(key, String(n));
  } catch (e) {
    /* ignore */
  }
}