"use client";

import { forwardRef } from "react";
import { cx } from "./cx";

type Variant = "ghost" | "solid" | "soft";

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  // 아이콘만 있는 버튼은 스크린리더용 이름이 반드시 필요하다.
  label: string;
  variant?: Variant;
}

const VARIANT: Record<Variant, string> = {
  ghost: "rounded-field text-ink active:bg-fill",
  solid: "rounded-full bg-ink text-on-ink active:opacity-80",
  soft: "rounded-full bg-fill text-ink active:bg-line",
};

// 44x44 아이콘 버튼. 아이콘은 @tabler/icons-react, size 20~22 / stroke 1.75 권장.
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center",
        "transition-[opacity,background-color] duration-160 ease-snappy",
        "disabled:opacity-40 disabled:pointer-events-none",
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
