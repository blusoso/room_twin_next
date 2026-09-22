// components/viewport/FloatingToolbarBtn.tsx
//
// ⭐ ปุ่มใน floating toolbar (pill สี ink เข้ม) — pattern เฉพาะ
//    ต่างจาก <IconButton> ทั่วไป: ปุ่มกลม 34px บนพื้นเข้ม
//    มี 7 variant ตาม CSS .ft-btn.* ที่มีอยู่แล้ว
"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type Variant =
  | "default"
  | "danger"
  | "zone"
  | "swap"
  | "customize"
  | "lock"
  | "theme";

export interface FloatingToolbarBtnProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** aria-label — บังคับสำหรับ a11y */
  label: string;
  /** ชนิดของปุ่ม — ตรงกับ CSS class ของ floating toolbar */
  variant?: Variant;
  /** toggle state (เช่น swap mode เปิด, size menu เปิด) */
  active?: boolean;
  /** ปุ่มกว้าง — แสดง icon + label ต่อกัน (สำหรับ size picker) */
  wide?: boolean;
  /** ไอคอน (emoji / SVG) — ใช้เฉพาะ wide variant */
  icon?: ReactNode;
  /** เนื้อหาปุ่ม — ปุ่มกลมใส่ emoji, ปุ่ม wide ใส่ข้อความ */
  children?: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  default: "",
  danger: "danger",
  zone: "zone-btn",
  swap: "swap",
  customize: "customize",
  lock: "locked",
  theme: "theme",
};

export const FloatingToolbarBtn = forwardRef<
  HTMLButtonElement,
  FloatingToolbarBtnProps
>(function FloatingToolbarBtn(
  {
    label,
    variant = "default",
    active = false,
    wide = false,
    icon,
    children,
    className,
    type = "button",
    title,
    ...rest
  },
  ref,
) {
  const classes = [
    "ft-btn",
    VARIANT_CLASS[variant],
    active ? "active" : "",
    wide ? "size" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active || undefined}
      title={title ?? label}
      className={classes}
      {...rest}
    >
      {wide ? (
        <>
          <span className="ft-size-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="ft-size-text">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});