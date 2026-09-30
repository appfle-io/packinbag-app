"use client";

import { IconCheck } from "@tabler/icons-react";
import { cx } from "./cx";

export interface CheckMarkProps {
  checked: boolean;
  // round: 짐 체크(가방) / square: 선택(팩 고르기, 메모 체크박스)
  shape?: "round" | "square";
  className?: string;
}

// 체크 표시만 그리는 부품. 클릭 영역은 부모(ListRow/버튼)가 갖는다 - 줄 전체가 눌려야 하기 때문.
export function CheckMark({ checked, shape = "round", className }: CheckMarkProps) {
  const fill = shape === "round" ? "bg-brand border-brand" : "bg-ink border-ink";
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-5.5 shrink-0 items-center justify-center border-check",
        shape === "round" ? "rounded-full" : "rounded-control",
        "transition-colors duration-160 ease-snappy",
        checked ? fill : "border-line-strong bg-card",
        className,
      )}
    >
      {checked && <IconCheck size={14} stroke={3} className={shape === "round" ? "text-on-brand" : "text-on-ink"} />}
    </span>
  );
}
