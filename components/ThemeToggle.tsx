// components/ThemeToggle.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "rt-theme";
type Theme = "light" | "dark";

function getSystem(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readCurrent(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return getSystem();
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {}
}

interface Props {
  className?: string;
}

export default function ThemeToggle({ className = "" }: Props) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const [interacted, setInteracted] = useState(false);

  // sync ครั้งแรก — เขียน DOM จาก localStorage กัน init script ที่อาจไม่รัน
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {}

    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    } else {
      document.documentElement.setAttribute("data-theme", getSystem());
    }

    setTheme(readCurrent());
    setMounted(true);
  }, []);

  // ฟัง OS change (เฉพาะตอนไม่มีค่าที่ผู้ใช้เลือกเอง)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch {}
      if (stored === "light" || stored === "dark") return;

      const next: Theme = e.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      setTheme(next);
      setInteracted(true); // ให้หมุนตามด้วย
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const handleClick = useCallback(() => {
    const current = readCurrent();
    const next: Theme = current === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
    setInteracted(true);
  }, []);

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={handleClick}
      aria-label={theme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
      title={theme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
      data-mounted={mounted ? "1" : "0"}
      data-theme-state={mounted ? theme : "light"}
      data-animate={interacted ? "1" : "0"}
    >
      <span className="theme-icon" aria-hidden="true">
        🌓
      </span>
    </button>
  );
}