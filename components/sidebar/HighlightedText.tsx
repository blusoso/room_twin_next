// components/sidebar/HighlightedText.tsx
// ⭐ ไฮไลต์คำค้นที่ตรงกับการ์ดในแคตตาล็อก (ใช้ทั้ง ProductCard และ ZoneCard)
"use client";
import { useMemo, type ReactNode } from "react";

interface Props {
  text: string;
  query?: string;
}

export default function HighlightedText({ text, query }: Props) {
  const tokens = useMemo(() => {
    const q = (query ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!q) return [] as string[];
    // ตัดคำซ้ำ + เรียงคำยาวก่อน เพื่อให้ช่วงที่ทับซ้อนกันถูก merge ถูกต้อง
    return Array.from(new Set(q.split(" ").filter(Boolean))).sort(
      (a, b) => b.length - a.length,
    );
  }, [query]);

  const nodes = useMemo(() => {
    if (tokens.length === 0) return null;
    const lower = text.toLowerCase();

    const ranges: Array<[number, number]> = [];
    for (const t of tokens) {
      let from = 0;
      for (;;) {
        const i = lower.indexOf(t, from);
        if (i < 0) break;
        ranges.push([i, i + t.length]);
        from = i + t.length;
      }
    }
    if (ranges.length === 0) return null;

    ranges.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    }

    const out: ReactNode[] = [];
    let pos = 0;
    merged.forEach(([s, e], i) => {
      if (s > pos) out.push(text.slice(pos, s));
      out.push(
        <mark className="hl" key={i}>
          {text.slice(s, e)}
        </mark>,
      );
      pos = e;
    });
    if (pos < text.length) out.push(text.slice(pos));
    return out;
  }, [text, tokens]);

  if (!nodes) return <>{text}</>;
  return <>{nodes}</>;
}
