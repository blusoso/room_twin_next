// components/ui/Input.tsx
"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cx } from "./cx";

type Variant = "text" | "search" | "small" | "num";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  variant?: Variant;
  /** แสดง error state (border danger) */
  error?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  text: "",                    // ใช้ className ภายนอก
  search: "catalog-search-input",
  small: "ss-input",
  num: "cz-num-input",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { variant = "text", error = false, className, type = "text", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(
        VARIANT_CLASS[variant],
        error && "error",
        className,
      )}
      {...rest}
    />
  );
});