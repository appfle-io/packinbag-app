"use client";

import { IconLock } from "@tabler/icons-react";
import { Bag } from "@/lib/types";
import { formatItemCountLabel, getProgressRatio } from "@/lib/itemStats";
import { getPackColorHex } from "@/lib/packColors";
import { formatDDayLabel } from "@/lib/dday";
import ProgressRing from "@/components/ProgressRing";

// 설정 > 화면설정 > 가방 크기 슬라이더 값(--bag-card-scale)에 맞춰 패딩/간격/글자
// 크기를 함께 조절한다. 글자는 --font-scale-factor(설정 > 글자 크기)까지 같이 곱해서,
// "가방 크기"와 "글자 크기" 두 설정이 자연스럽게 겹쳐 적용되도록 한다.
export default function BagCard({
  bag,
  onClick,
  locked,
}: {
  bag: Bag;
  onClick: () => void;
  // true면 무료 전환으로 잠긴 가방. 탭하면 여전히 열리지만(읽기 전용) 자물쇠 표시를 보여준다.
  locked?: boolean;
}) {
  const allItems = bag.packs.flatMap((p) => p.items);
  const totalLabel = formatItemCountLabel(allItems, bag.images.length > 0);
  const overallRatio = getProgressRatio(allItems);
  const ddayLabel = formatDDayLabel(bag.travelDate);

  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-xl border border-border p-[calc(12px*var(--bag-card-scale,1))] md:p-[calc(16px*var(--bag-card-scale,1))] flex flex-col text-left shadow-sm transition-all duration-150 active:scale-[0.97] active:shadow-none"
      style={{ background: "var(--bag-card-bg)", opacity: locked ? 0.6 : 1 }}
    >
      {locked && (
        <span
          className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <IconLock size={11} stroke={2} color="#fff" />
        </span>
      )}
      <div className="flex items-start justify-between gap-1.5 shrink-0">
        <span className="text-[calc(13px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(14px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] font-medium line-clamp-2">
          {bag.name}
        </span>
        {ddayLabel && (
          <span
            className="text-[calc(10px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(11px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] font-medium rounded-full px-1.5 py-0.5 shrink-0"
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
                  className="flex items-center gap-1 text-[calc(11px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary truncate"
                >
                  {dotHex && (
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: dotHex, transform: "scale(var(--bag-card-scale,1))" }}
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
      <span className="flex items-center justify-end gap-2 text-[calc(11px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary shrink-0 mt-auto pt-1.5">
        {bag.memberIds.length > 1 && (
          <span className="flex items-center gap-0.5 text-text-muted">
            👥 {bag.memberIds.length}
          </span>
        )}
        {overallRatio !== null && (
          <span style={{ transform: "scale(var(--bag-card-scale,1))" }}>
            <ProgressRing ratio={overallRatio} size={18} />
          </span>
        )}
        {totalLabel && <span className="font-medium">{totalLabel}</span>}
      </span>
    </button>
  );
}
