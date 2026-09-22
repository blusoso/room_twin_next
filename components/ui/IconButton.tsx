"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "./cx";

type Size = "xs" | "sm" | "md" | "lg";
type Tone = "default" | "on" | "danger";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Required — for screen readers (DS: "aria-label ทุกปุ่มไอคอน") */
  label: string;
  size?: Size;
  tone?: Tone;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      size = "md",
      tone = "default",
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
        aria-label={label}
        title={rest.title ?? label}
        className={cx(
          "icon-btn",
          `icon-btn-${size}`,
          tone !== "default" && `icon-btn-${tone}`,
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);