"use client";

import { Bag } from "@/lib/types";
import { formatItemCountLabel, getProgressRatio } from "@/lib/itemStats";
import { getPackColorHex } from "@/lib/packColors";
import { formatDDayLabel } from "@/lib/dday";
import ProgressRing from "@/components/ProgressRing";

export default function BagCard({
  bag,
  onClick,
}: {
  bag: Bag;
  onClick: () => void;
}) {
  const allItems = bag.packs.flatMap((p) => p.items);
  const totalLabel = formatItemCountLabel(allItems, bag.images.length > 0);
  const overallRatio = getProgressRatio(allItems);
  const ddayLabel = formatDDayLabel(bag.travelDate);

  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-xl border border-border p-3 md:p-4 flex flex-col text-left shadow-sm transition-all duration-150 active:scale-[0.97] active:shadow-none"
      style={{ background: "var(--bag-card-bg)" }}
    >
      <div className="flex items-start justify-between gap-1.5 shrink-0">
        <span className="text-[13px] md:text-[14px] font-medium line-clamp-2">
          {bag.name}
        </span>
        {ddayLabel && (
          <span
            className="text-[10px] md:text-[11px] font-medium rounded-full px-1.5 py-0.5 shrink-0"
            style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
          >
            {ddayLabel}
          </span>
        )}
      </div>
      {bag.packs.length > 0 && (
        <div className="flex-1 min-h-0 overflow-hidden mt-1.5">
          <div className="grid grid-cols-2 gap-x-2 md:gap-x-3 gap-y-0.5 md:gap-y-1">
            {bag.packs.map((pack) => {
              const packLabel = formatItemCountLabel(pack.items, false);
              const dotHex = getPackColorHex(pack.color);
              return (
                <span
                  key={pack.id}
                  className="flex items-center gap-1 text-[11px] md:text-[12px] text-text-secondary truncate"
                >
                  {dotHex && (
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: dotHex }}
                    />
                  )}
                  <span className="truncate">
                    {pack.name}
                    {packLabel && (
                      <span className="text-text-muted">({packLabel})</span>
                    )}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}
      <span className="flex items-center justify-end gap-2 text-[11px] md:text-[12px] text-text-secondary shrink-0 mt-auto pt-1.5">
        {bag.memberIds.length > 1 && (
          <span className="flex items-center gap-0.5 text-text-muted">
            👥 {bag.memberIds.length}
          </span>
        )}
        {overallRatio !== null && <ProgressRing ratio={overallRatio} size={18} />}
        {totalLabel && <span className="font-medium">{totalLabel}</span>}
      </span>
    </button>
  );
}
