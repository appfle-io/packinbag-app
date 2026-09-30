"use client";

import { useId } from "react";
import { cx } from "./cx";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

// 화면 모드 / 글자 크기 / 담당자 선택처럼 2~4개 중 하나를 고르는 컨트롤.
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("grid gap-1 rounded-field bg-fill p-1", className)}
      // 칸 개수는 옵션 수에 따라 런타임에 정해진다
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            name={name}
            onClick={() => onChange(o.value)}
            className={cx(
              "h-9 rounded-control text-caption transition-colors duration-160 ease-snappy",
              on ? "bg-card font-semibold text-ink ring-1 ring-line" : "bg-transparent font-medium text-sub",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
