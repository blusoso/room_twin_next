// components/ui/Chip.tsx
"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

type Variant = "default" | "sub";

export interface ChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  active?: boolean;
  variant?: Variant;
  /** icon (emoji หรือ SVG) */
  icon?: ReactNode;
  /** ตัวเลขมุมขวา (นับจำนวน — ใช้กับ sub-cat-pill) */
  count?: number;
  children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  default: "chip",
  sub: "sub-cat-pill",
};

const ACTIVE_CLASS: Record<Variant, string> = {
  default: "active",
  sub: "active",
};

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  function Chip(
    {
      active = false,
      variant = "default",
      icon,
      count,
      children,
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={active}
        className={cx(
          VARIANT_CLASS[variant],
          active && ACTIVE_CLASS[variant],
          className,
        )}
        {...rest}
      >
        {variant === "sub" ? (
          <>
            {icon && (
              <span className="sc-label">
                {icon} {children}
              </span>
            )}
            {!icon && <span className="sc-label">{children}</span>}
            {count !== undefined && (
              <span className="sc-count">{count}</span>
            )}
          </>
        ) : (
          <>
            {icon && (
              <span aria-hidden="true" style={{ lineHeight: 1 }}>
                {icon}
              </span>
            )}
            {children}
          </>
        )}
      </button>
    );
  },
);