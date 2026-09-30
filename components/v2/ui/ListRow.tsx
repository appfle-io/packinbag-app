"use client";

import { IconChevronRight } from "@tabler/icons-react";
import { cx } from "./cx";

export interface ListRowProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  // 목록 마지막 줄 등 구분선을 빼야 할 때
  divider?: boolean;
  // 완료된 아이템처럼 흐리게
  muted?: boolean;
}

// 한 줄짜리 목록 항목(가방, 팩, 설정, 아이템). 최소 높이 52, 줄 전체가 버튼.
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  chevron,
  divider = true,
  muted,
  className,
  type = "button",
  ...rest
}: ListRowProps) {
  return (
    <button
      type={type}
      className={cx(
        "flex min-h-13 w-full items-center gap-3 bg-transparent py-2 text-left",
        "transition-colors duration-160 ease-snappy active:bg-fill",
        "disabled:pointer-events-none disabled:opacity-50",
        divider && "border-b border-line",
        className,
      )}
      {...rest}
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cx("truncate text-body", muted ? "text-faint" : "text-ink")}>{title}</span>
        {subtitle && <span className="truncate text-caption text-sub">{subtitle}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2 text-caption text-sub">{trailing}</span>}
      {chevron && <IconChevronRight size={16} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />}
    </button>
  );
}
