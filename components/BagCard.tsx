"use client";

import { IconLock, IconPin, IconPinFilled } from "@tabler/icons-react";
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
  pinned,
  onTogglePin,
  isDragSource,
  isDragOver,
}: {
  bag: Bag;
  onClick: () => void;
  // true면 무료 전환으로 잠긴 가방. 탭하면 여전히 열리지만(읽기 전용) 자물쇠 표시를 보여준다.
  locked?: boolean;
  // 고정핀 처리된 가방인지 (최대 2개, 홈 그리드 맨 앞에 고정되고 드래그 대상에서 제외됨)
  pinned?: boolean;
  onTogglePin?: () => void;
  isDragSource?: boolean;
  isDragOver?: boolean;
}) {
  const allItems = bag.packs.flatMap((p) => p.items);
  const totalLabel = formatItemCountLabel(allItems, bag.images.length > 0);
  const overallRatio = getProgressRatio(allItems);
  const ddayLabel = formatDDayLabel(bag.travelDate, bag.ddayCountTodayAsDayOne);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className="relative aspect-square rounded-xl border border-border p-[calc(12px*var(--bag-card-scale,1))] md:p-[calc(16px*var(--bag-card-scale,1))] flex flex-col text-left shadow-sm transition-all duration-150 active:scale-[0.97] active:shadow-none cursor-pointer"
      style={{
        background: "var(--bag-card-bg)",
        opacity: isDragSource ? 0.4 : locked ? 0.6 : 1,
        boxShadow: isDragOver ? "0 0 0 2px var(--accent)" : undefined,
        // 카드를 길게 누르면 순서변경 드래그(HomeScreen)로 이어지는데, 이 카드에는
        // user-select/touch-callout 방지 처리가 없어서 그 전에 네이티브 텍스트 선택/복사
        // 콜아웃(에디트모드)이 먼저 뜨는 문제가 있었다. PackTile.tsx와 동일하게 여기서도
        // 선택/콜아웃을 막아서 롱프레스가 곧바로 드래그로만 이어지게 한다.
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
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
      {/* 제목 줄: 제목은 왼쪽에서 최대한 넓게, 고정핀은 오른쪽 끝에 별도 자리를 차지한다
          (D-Day 배지와 자리를 다투지 않도록 D-Day는 아예 다음 줄로 내려서 따로 보여준다). */}
      <div className="flex items-start justify-between gap-1 shrink-0">
        <span className="text-[calc(13px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(14px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] font-medium line-clamp-2 min-w-0 flex-1">
          {bag.name}
        </span>
        {onTogglePin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            aria-label={pinned ? "고정 해제" : "이 가방 고정하기"}
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
      {ddayLabel && (
        <div className="mt-1 shrink-0">
          <span
            className="inline-block text-[calc(10px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(11px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] font-medium rounded-full px-1.5 py-0.5"
            style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
          >
            {ddayLabel}
          </span>
        </div>
      )}
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
    </div>
  );
}
