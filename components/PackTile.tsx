"use client";

import { IconLock } from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { getPackColorHex } from "@/lib/packColors";
import { getProgressRatio } from "@/lib/itemStats";
import ProgressRing from "@/components/ProgressRing";

export default function PackTile({
  pack,
  onClick,
  locked,
}: {
  pack: Pack;
  onClick: () => void;
  // true면 무료 전환으로 잠긴 팩. 탭하면 여전히 열리지만(읽기 전용) 자물쇠 표시를 보여준다.
  locked?: boolean;
}) {
  const itemNames = pack.items.map((i) => i.text || "(빈 항목)");
  const dotHex = getPackColorHex(pack.color);
  const ratio = getProgressRatio(pack.items);

  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-xl border border-border p-[calc(12px*var(--pack-library-card-scale,1))] md:p-[calc(16px*var(--pack-library-card-scale,1))] flex flex-col text-left shadow-sm transition-all duration-150 active:scale-[0.97] active:shadow-none"
      style={{
        background: dotHex ? `${dotHex}26` : "var(--pack-library-card-bg)",
        opacity: locked ? 0.6 : 1,
      }}
    >
      {locked && (
        <span
          className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <IconLock size={11} stroke={2} color="#fff" />
        </span>
      )}
      <span className="flex items-center gap-1.5 shrink-0">
        {dotHex && (
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ background: dotHex, transform: "scale(var(--pack-library-card-scale,1))" }}
          />
        )}
        <span className="text-[calc(13px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(14px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] font-medium line-clamp-2">
          {pack.name}
        </span>
      </span>
      {itemNames.length > 0 && (
        <span className="flex-1 text-[calc(11px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary line-clamp-2 break-keep mt-1.5">
          {itemNames.join(", ")}
        </span>
      )}
      <span className="flex items-center justify-end gap-2 text-[calc(11px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary shrink-0 mt-auto pt-1.5">
        {ratio !== null && <ProgressRing ratio={ratio} size={16} />}
        {pack.items.length}개
      </span>
    </button>
  );
}
