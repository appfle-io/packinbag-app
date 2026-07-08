"use client";

import { Pack } from "@/lib/types";
import { getPackColorHex } from "@/lib/packColors";
import { getProgressRatio } from "@/lib/itemStats";
import ProgressRing from "@/components/ProgressRing";

export default function PackTile({
  pack,
  onClick,
}: {
  pack: Pack;
  onClick: () => void;
}) {
  const itemNames = pack.items.map((i) => i.text || "(빈 항목)");
  const dotHex = getPackColorHex(pack.color);
  const ratio = getProgressRatio(pack.items);

  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-xl border border-border p-3 md:p-4 flex flex-col text-left shadow-sm transition-all duration-150 active:scale-[0.97] active:shadow-none"
      style={{ background: dotHex ? `${dotHex}26` : "var(--surface)" }}
    >
      <span className="flex items-center gap-1.5 shrink-0">
        {dotHex && (
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ background: dotHex }}
          />
        )}
        <span className="text-[13px] md:text-[14px] font-medium line-clamp-2">
          {pack.name}
        </span>
      </span>
      {itemNames.length > 0 && (
        <span className="flex-1 text-[11px] md:text-[12px] text-text-secondary line-clamp-2 break-keep mt-1.5">
          {itemNames.join(", ")}
        </span>
      )}
      <span className="flex items-center justify-end gap-2 text-[11px] md:text-[12px] text-text-secondary shrink-0 mt-auto pt-1.5">
        {ratio !== null && <ProgressRing ratio={ratio} size={16} />}
        {pack.items.length}개
      </span>
    </button>
  );
}
