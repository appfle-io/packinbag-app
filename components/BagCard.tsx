"use client";

import { IconLock, IconPin, IconPinFilled, IconArchive, IconArchiveOff, IconUsers, IconCheck } from "@tabler/icons-react";
import { Bag } from "@/lib/types";
import { formatItemCountLabel, getProgressRatio } from "@/lib/itemStats";
import { getViewablePacks } from "@/lib/premiumLimits";
import { formatDDayLabel } from "@/lib/dday";
import ProgressRing from "@/components/ProgressRing";

// 설정 > 화면설정 > 가방 카드 크기 슬라이더 값(--bag-card-scale)에 맞춰 패딩/간격/아이콘을
// 조절하고, 가방 글씨 크기 슬라이더 값(--bag-card-font-scale)에 맞춰 글자 크기를 조절한다 -
// 카드 크기와 글자 크기가 서로 독립적으로 조절된다. 글자는 --font-scale-factor(설정 > 글자
// 크기)까지 같이 곱해서, 앱 전체 글자 크기 설정과도 자연스럽게 겹쳐 적용되도록 한다.
export default function BagCard({
  bag,
  onClick,
  premium,
  locked,
  pinned,
  onTogglePin,
  archived,
  onToggleArchive,
  isDragSource,
  isDragOver,
  selectMode,
  selected,
  compact,
}: {
  bag: Bag;
  onClick: () => void;
  // 지금 이 카드를 보는 사람(로그인한 본인) 기준 프리미엄 여부. 다른 멤버(프리미엄)가 만든
  // AI추천 팩(Pack.aiRecommendSource)을 무료회원 본인 화면에서는 미리보기/개수에서 숨기는 데 쓴다.
  premium: boolean;
  // true면 무료 전환으로 잠긴 가방. 탭하면 여전히 열리지만(읽기 전용) 자물쇠 표시를 보여준다.
  locked?: boolean;
  // 고정핀 처리된 가방인지 (최대 3개, 홈 그리드 맨 앞에 고정되고 드래그 대상에서 제외됨)
  pinned?: boolean;
  onTogglePin?: () => void;
  // 보관 처리된 가방인지 ("진행중"/"보관" 탭으로 나눠 보여줄 때 씀). 삭제가 아니라 그냥
  // 메인 목록에서 숨겨두는 것뿐이라 언제든 되돌릴 수 있다.
  archived?: boolean;
  onToggleArchive?: () => void;
  isDragSource?: boolean;
  isDragOver?: boolean;
  // 다중 선택 모드 여부 및 선택 상태
  selectMode?: boolean;
  selected?: boolean;
  // 3열 모드 등 작은 카드용 간소화 보기 (이름, 핀, 보관, 동기화/인원수 위주)
  compact?: boolean;
}) {
  // AI추천 팩(aiRecommendSource)은 무료회원에게는 목록/개수/진행률 어디에도 포함시키지 않는다.
  const viewablePacks = getViewablePacks(bag.packs, premium);
  const allItems = viewablePacks.flatMap((p) => p.items);
  const totalLabel = formatItemCountLabel(allItems, bag.images.length > 0);
  const overallRatio = getProgressRatio(allItems);
  const ddayLabel = formatDDayLabel(bag.travelDate, bag.ddayCountTodayAsDayOne);

  return (
    // 바깥 래퍼: 실제 화면에 보이진 않고, 그리드가 준 폭(칸 너비)을 컨테이너 쿼리로
    // 안쪽 카드에 전달하는 역할만 한다. 높이는 안쪽 카드 높이에 맞춰 자동으로 정해진다.
    <div className="[container-type:inline-size]">
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      // 예전엔 aspect-square로 항상 정사각형 고정이었는데, 그러면 글씨를 줄였을 때 카드
      // 안에 여백만 남는 문제가 있었다. 이제는 '가방 카드크기(가로폭)'을 최대 높이로만
      // 쓰고(max-h-[100cqw] = 내 폭만큼), 내용이 적으면 카드가 그만큼 낮아지고, 내용이
      // 많으면 이 최대 높이에서 세로 스크롤이 생기게 한다.
      className={`relative max-h-[100cqw] overflow-y-auto rounded-lg border p-[calc(12px*var(--bag-card-scale,1))] md:p-[calc(16px*var(--bag-card-scale,1))] flex flex-col text-left shadow-sm transition-all duration-150 active:scale-[0.97] active:shadow-none cursor-pointer ${
        selected
          ? "border-accent ring-2 ring-accent/30 scale-[0.98]"
          : selectMode
          ? "border-border/90 opacity-90"
          : "border-border"
      }`}
      style={{
        background: selected
          ? "color-mix(in srgb, var(--accent) 7%, var(--bag-card-bg))"
          : "var(--bag-card-bg)",
        opacity: isDragSource ? 0.4 : locked ? 0.6 : undefined,
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
      {/* 제목 줄: 제목은 왼쪽에서 최대한 넓게, 우측에는 핀/보관 버튼 또는 다중선택 체크박스 배치 */}
      <div className="flex items-start justify-between gap-1.5 shrink-0">
        <span className="text-[calc(13px*var(--bag-card-font-scale,1)*var(--font-scale-factor,1))] md:text-[calc(14px*var(--bag-card-font-scale,1)*var(--font-scale-factor,1))] font-medium line-clamp-2 min-w-0 flex-1">
          {bag.name}
        </span>

        {selectMode ? (
          <div
            className={`shrink-0 -mt-0.5 -mr-0.5 h-[20px] w-[20px] rounded-full flex items-center justify-center transition-all ${
              selected
                ? "shadow-2xs"
                : "border-[1.5px] border-border-strong/70 bg-surface/80"
            }`}
            style={{
              background: selected ? "var(--accent)" : undefined,
              borderColor: selected ? "var(--accent)" : undefined,
            }}
          >
            {selected && <IconCheck size={13} stroke={3} color="#fff" />}
          </div>
        ) : compact ? (
          pinned && (
            <span className="shrink-0 -mt-0.5 text-accent" title="고정된 가방">
              <IconPinFilled size={13} stroke={1.75} />
            </span>
          )
        ) : (
          (onTogglePin || onToggleArchive) && (
            <div className="shrink-0 flex items-center gap-4">
              {onToggleArchive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleArchive();
                  }}
                  aria-label={archived ? "보관 해제" : "보관하기"}
                  className="shrink-0 -m-2 p-2 flex items-center justify-center rounded-md active:bg-black/5"
                >
                  {archived ? (
                    <IconArchiveOff size={14} stroke={1.75} color="var(--accent)" />
                  ) : (
                    <IconArchive size={14} stroke={1.75} color="var(--text-muted)" />
                  )}
                </button>
              )}
              {onTogglePin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin();
                  }}
                  aria-label={pinned ? "고정 해제" : "이 가방 고정하기"}
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
          )
        )}
      </div>

      {ddayLabel && (
        <div className="mt-1 shrink-0">
          <span
            className="inline-block text-[calc(10px*var(--bag-card-font-scale,1)*var(--font-scale-factor,1))] md:text-[calc(11px*var(--bag-card-font-scale,1)*var(--font-scale-factor,1))] font-medium rounded-md px-2 py-0.5 border border-accent/40 bg-accent/5 text-accent"
          >
            {ddayLabel}
          </span>
        </div>
      )}

      {/* 가방 속 팩 미리보기 목록 (선택 모드 및 3열 컴팩트 모드에서는 정보 과밀 방지를 위해 간소화) */}
      {viewablePacks.length > 0 && !selectMode && !compact && (
        <div className="flex-1 min-h-0 overflow-hidden mt-1.5 flex flex-col justify-start">
          <div className="flex flex-col gap-1 @[240px]:grid @[240px]:grid-cols-2 @[240px]:gap-x-2.5 @[240px]:gap-y-1">
            {viewablePacks.slice(0, 4).map((pack) => {
              const packLabel =
                pack.kind === "editor"
                  ? "메모"
                  : formatItemCountLabel(pack.items, false);
              return (
                <div
                  key={pack.id}
                  className="flex items-center gap-1.5 text-[calc(11.5px*var(--bag-card-font-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--bag-card-font-scale,1)*var(--font-scale-factor,1))] text-text-secondary min-w-0"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0 bg-text-muted/60"
                    style={{ transform: "scale(var(--bag-card-scale,1))" }}
                  />
                  <span className="truncate flex-1 font-normal text-text-secondary">
                    {pack.name}
                  </span>
                  {packLabel && (
                    <span className="text-[10px] text-text-muted shrink-0 tabular-nums">
                      {packLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 4개 초과 시 간결한 +N개 뱃지 */}
          {viewablePacks.length > 4 && (
            <div className="mt-1 flex items-center">
              <span className="text-[10px] font-medium text-text-muted px-1.5 py-0.5 rounded bg-surface-2/60">
                +{viewablePacks.length - 4}개 더보기
              </span>
            </div>
          )}
        </div>
      )}

      {/* 카드 하단 정보 (멤버수, 프로그레스 링, 총 짐 수) */}
      <span
        className={`flex items-center ${
          compact && bag.memberIds.length > 1 ? "justify-between" : "justify-end"
        } gap-2 text-[calc(11px*var(--bag-card-font-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--bag-card-font-scale,1)*var(--font-scale-factor,1))] text-text-secondary shrink-0 mt-auto pt-1.5`}
      >
        {bag.memberIds.length > 1 && (
          <span className="flex items-center gap-1 text-text-muted text-[11px] shrink-0">
            <IconUsers size={13} stroke={1.75} />
            <span>{bag.memberIds.length}</span>
          </span>
        )}
        {!compact && overallRatio !== null && (
          <span style={{ transform: "scale(var(--bag-card-scale,1))" }}>
            <ProgressRing ratio={overallRatio} size={17} />
          </span>
        )}
        {totalLabel && <span className="font-medium text-[11px] truncate shrink-0">{totalLabel}</span>}
      </span>

      {/* 카드 하단 2px 미니멀 진행률 바 */}
      {overallRatio !== null && (
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-border/40 overflow-hidden rounded-b-lg">
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{
              width: `${Math.round(overallRatio * 100)}%`,
              background: "var(--accent)",
            }}
          />
        </div>
      )}
    </div>
    </div>
  );
}
