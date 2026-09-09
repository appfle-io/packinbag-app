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
      className="relative flex items-center rounded-md border border-border/80 px-2 py-1 shrink-0"
      style={{ background: "var(--surface)" }}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ListSortOption)}
        aria-label="정렬 기준"
        className="bg-transparent text-[11.5px] pr-0.5 outline-none font-medium"
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
