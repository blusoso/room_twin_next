"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

type Variant =
  | "primary"
  | "copper"
  | "sage"
  | "secondary"
  | "ghost"
  | "floating"
  | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      block = false,
      icon,
      iconRight,
      className,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          "btn",
          `btn-${variant}`,
          `btn-${size}`,
          block && "btn-block",
          className,
        )}
        {...rest}
      >
        {icon && (
          <span className="btn-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        {children != null && <span className="btn-label">{children}</span>}
        {iconRight && (
          <span className="btn-icon" aria-hidden="true">
            {iconRight}
          </span>
        )}
      </button>
    );
  },
);