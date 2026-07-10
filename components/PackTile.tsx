"use client";

import { IconLock, IconPin, IconPinFilled } from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { getPackColorHex } from "@/lib/packColors";
import { getProgressRatio } from "@/lib/itemStats";
import ProgressRing from "@/components/ProgressRing";

export default function PackTile({
  pack,
  onClick,
  locked,
  pinned,
  onTogglePin,
  isDragSource,
  isDragOver,
}: {
  pack: Pack;
  onClick: () => void;
  // true면 무료 전환으로 잠긴 팩. 탭하면 여전히 열리지만(읽기 전용) 자물쇠 표시를 보여준다.
  locked?: boolean;
  // 고정핀 처리된 팩인지 (최대 2개, 팩 라이브러리 그리드 맨 앞에 고정되고 드래그 대상에서 제외됨)
  pinned?: boolean;
  onTogglePin?: () => void;
  isDragSource?: boolean;
  isDragOver?: boolean;
}) {
  const itemNames = pack.items.map((i) => i.text || "(빈 항목)");
  const dotHex = getPackColorHex(pack.color);
  const ratio = getProgressRatio(pack.items);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className="relative aspect-square rounded-xl border border-border p-[calc(12px*var(--pack-library-card-scale,1))] md:p-[calc(16px*var(--pack-library-card-scale,1))] flex flex-col text-left shadow-sm transition-all duration-150 active:scale-[0.97] active:shadow-none cursor-pointer"
      style={{
        background: dotHex ? `${dotHex}26` : "var(--pack-library-card-bg)",
        opacity: isDragSource ? 0.4 : locked ? 0.6 : 1,
        boxShadow: isDragOver ? "0 0 0 2px var(--accent)" : undefined,
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
      {/* 제목 줄: 점(색상)+이름은 왼쪽에서 최대한 넓게, 고정핀은 오른쪽 끝에 별도 자리. */}
      <div className="flex items-start justify-between gap-1 shrink-0">
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          {dotHex && (
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: dotHex, transform: "scale(var(--pack-library-card-scale,1))" }}
            />
          )}
          <span className="text-[calc(13px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(14px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] font-medium line-clamp-2 min-w-0">
            {pack.name}
          </span>
        </span>
        {onTogglePin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            aria-label={pinned ? "고정 해제" : "이 팩 고정하기"}
            // 시각적으로는 아이콘만 작게 보이지만, 터치 영역은 패딩만큼 더 넓다 -
            // 음수 마진으로 레이아웃에 미치는 영향(제목이 밀리는 정도)은 원래 크기로 되돌린다.
            className="shrink-0 -m-2 p-2 flex items-center justify-center rounded-full active:bg-black/5"
          >
            {pinned ? (
              <IconPinFilled size={14} stroke={1.75} color="var(--accent)" />
            ) : (
              <IconPin size={14} stroke={1.75} color="var(--text-muted)" />
            )}
          </button>
        )}
      </div>
      {itemNames.length > 0 && (
        <span className="flex-1 text-[calc(11px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary line-clamp-2 break-keep mt-1.5">
          {itemNames.join(", ")}
        </span>
      )}
      <span className="flex items-center justify-end gap-2 text-[calc(11px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary shrink-0 mt-auto pt-1.5">
        {ratio !== null && <ProgressRing ratio={ratio} size={16} />}
        {pack.items.length}개
      </span>
    </div>
  );
}
