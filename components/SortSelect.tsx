"use client";

import { IconArrowsSort } from "@tabler/icons-react";
import { ListSortOption } from "@/lib/types";
import { SORT_OPTIONS, SORT_OPTION_LABELS } from "@/lib/listSort";

export default function SortSelect({
  value,
  onChange,
}: {
  value: ListSortOption;
  onChange: (value: ListSortOption) => void;
}) {
  return (
    <div
      className="relative flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 shrink-0"
      style={{ background: "var(--surface-2)" }}
    >
      <IconArrowsSort size={14} stroke={1.75} color="var(--text-secondary)" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ListSortOption)}
        aria-label="정렬 기준"
        className="bg-transparent text-[12px] pr-1 outline-none"
        style={{ color: "var(--text-secondary)" }}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {SORT_OPTION_LABELS[opt]}
          </option>
        ))}
      </select>
    </div>
  );
}
