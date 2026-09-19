// components/ui/Pill.tsx
"use client";
import { forwardRef } from "react";

export type PillSize = "sm" | "md" | "lg";

export interface PillProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** ขนาด: sm (30px) / md (34px) / lg (38px) */
  size?: PillSize;
  /** ไอคอนด้านซ้าย — รับได้ทั้ง emoji string หรือ SVG */
  icon?: React.ReactNode;
  /** badge ท้ายปุ่ม (เช่น count) */
  badge?: React.ReactNode;
  /** toggle state — เปิดใช้กับปุ่มเลือกหมวด/ตัวกรอง */
  active?: boolean;
  /** ล็อกความกว้างขั้นต่ำ (เช่น ปุ่มเสถียรไม่ขยับตอน active) */
  minWidth?: number | string;
  type?: "button" | "submit" | "reset";
}

const Pill = forwardRef<HTMLButtonElement, PillProps>(function Pill(
  {
    size = "md",
    icon,
    badge,
    active = false,
    minWidth,
    type = "button",
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        "pill",
        `pill-${size}`,
        active ? "is-active" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={active || undefined}
      style={{
        ...(minWidth !== undefined ? { minWidth } : null),
        ...style,
      }}
      {...rest}
    >
      {icon != null && (
        <span className="pill-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="pill-label">{children}</span>
      {badge != null && <span className="pill-badge">{badge}</span>}
    </button>
  );
});

export default Pill;