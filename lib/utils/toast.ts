// lib/utils/toast.ts
//
// ⭐ ตัว dispatch ของ event `roomtwin:toast`
//    listener อยู่ใน components/viewport/Overlays.tsx (#placementToast)
export function showToast(msg: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("roomtwin:toast", { detail: { msg } }),
  );
}
