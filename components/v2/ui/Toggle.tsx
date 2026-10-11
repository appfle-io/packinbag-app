"use client";

import { cx } from "./cx";

// 켜기/끄기 스위치. 줄 전체를 누를 수 있게 label과 함께 쓴다. disabled면 흐리게 · 누를 수 없음(2026-10-11)
export function Toggle({
  checked,
  onChange,
  label,
  description,
  className,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "flex min-h-13 w-full items-center justify-between gap-4 bg-transparent py-2 text-left disabled:cursor-default",
        className,
      )}
    >
      <span className="flex flex-col">
        <span className={cx("text-body", disabled ? "text-faint" : "text-ink")}>{label}</span>
        {description && <span className="text-micro text-sub">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          "relative h-6.5 w-11 shrink-0 rounded-full transition-colors duration-160 ease-snappy",
          disabled ? "bg-fill" : checked ? "bg-brand" : "bg-line-strong",
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
