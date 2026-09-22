// components/ThemeGuard.tsx
"use client";

import { useLayoutEffect } from "react";

function resolveTheme(): "light" | "dark" {
  try {
    const stored = localStorage.getItem("rt-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * ThemeGuard
 * - set data-theme ก่อน paint (useLayoutEffect)
 * - เฝ้าดู MutationObserver — ถ้ามีอะไรมาเขียนทับ ให้เขียนกลับทันที
 * - ไม่ใช้ React state → ไม่มีทางหลุด sync
 */
export default function ThemeGuard() {
  useLayoutEffect(() => {
    const apply = () => {
      const want = resolveTheme();
      if (document.documentElement.getAttribute("data-theme") !== want) {
        document.documentElement.setAttribute("data-theme", want);
      }
    };

    // 1) apply ทันที (ก่อน paint)
    apply();

    // 2) เฝ้าดู — ถ้าใครเขียนทับ ค่อยดึงกลับ
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // 3) OS theme เปลี่ยน (เฉพาะตอนไม่มีค่าที่ผู้ใช้เลือกเอง)
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSysChange = () => {
      try {
        if (localStorage.getItem("rt-theme")) return;
      } catch {}
      apply();
    };
    mq.addEventListener("change", onSysChange);

    return () => {
      obs.disconnect();
      mq.removeEventListener("change", onSysChange);
    };
  }, []);

  return null;
}