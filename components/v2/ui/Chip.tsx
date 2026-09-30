"use client";

import { cx } from "./cx";

export interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  selected?: boolean;
  count?: number;
}

// 필터 칩(가방 속 팩, 가방 폴더, 팩 폴더). 높이 36, 가로 스크롤 줄 안에서 shrink-0.
export function Chip({ label, selected = false, count, className, type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        "inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-4 text-caption font-semibold",
        "transition-colors duration-160 ease-snappy",
        selected ? "border-ink bg-ink text-on-ink" : "border-line bg-card text-ink active:bg-fill",
        className,
      )}
      {...rest}
    >
      {label}
      {count !== undefined && <span className={cx("font-medium", selected ? "opacity-70" : "text-faint")}>{count}</span>}
    </button>
  );
}
