// lib/three/toast.ts
export function showToast(msg: string, duration = 3200) {
  if (typeof document === "undefined") return;
  const el = document.getElementById("placementToast");
  if (!el) return;

  el.textContent = "⚠️ " + msg;
  el.classList.add("show");

  const key = "__roomtwin_toast_timer__";
  const w = window as any;
  if (w[key]) clearTimeout(w[key]);
  w[key] = setTimeout(() => {
    el.classList.remove("show");
  }, duration);
}