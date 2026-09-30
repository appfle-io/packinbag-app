"use client";

import { cx } from "./cx";

// 켜기/끄기 스위치. 줄 전체를 누를 수 있게 label과 함께 쓴다.
export function Toggle({
  checked,
  onChange,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx("flex min-h-13 w-full items-center justify-between gap-4 bg-transparent py-2 text-left", className)}
    >
      <span className="flex flex-col">
        <span className="text-body text-ink">{label}</span>
        {description && <span className="text-micro text-sub">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          "relative h-6.5 w-11 shrink-0 rounded-full transition-colors duration-160 ease-snappy",
          checked ? "bg-brand" : "bg-line-strong",
        )}
      >
        <span
          className={cx(
            "absolute top-0.75 size-5 rounded-full bg-card transition-[left] duration-200 ease-snappy",
            checked ? "left-5.25" : "left-0.75",
          )}
        />
      </span>
    </button>
  );
}
