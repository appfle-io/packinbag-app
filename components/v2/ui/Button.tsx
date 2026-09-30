"use client";

import { forwardRef } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "text" | "danger";
type Size = "md" | "sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  leading?: React.ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-on-ink active:opacity-80 disabled:bg-line disabled:text-sub",
  secondary: "bg-card text-ink border border-line-strong active:bg-fill disabled:opacity-40",
  text: "bg-transparent text-brand active:opacity-60 disabled:opacity-40",
  danger: "bg-transparent text-alert active:opacity-60 disabled:opacity-40",
};

const SIZE: Record<Size, string> = {
  md: "h-12 px-5 text-body",
  sm: "h-11 px-4 text-body",
};

// 기본 버튼. 높이 48(md) / 44(sm) - 터치 영역 44px 이상 보장.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, leading, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-card font-semibold",
        "transition-[opacity,background-color] duration-160 ease-snappy",
        "disabled:pointer-events-none",
        VARIANT[variant],
        SIZE[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {leading}
      {children}
    </button>
  );
});