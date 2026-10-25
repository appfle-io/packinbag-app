"use client";

import { IconEye, IconLock } from "@tabler/icons-react";
import { Badge, ProgressBar, ProgressRing, cx, useLongPress } from "@/components/v2/ui";
import { formatRelativeDay } from "@/components/v2/bag/format";
import { useOpenDetail } from "@/lib/v2/openDetail";
import type { BagSummary } from "./homeModel";

interface RowProps {
  summary: BagSummary;
  // 무료 한도를 넘어 읽기 전용(서버 Bag.locked)
  locked?: boolean;
  // 개인 잠금으로 잠근 가방(2026-10-12). 이름만 보이고 진행률 · 상태는 가린다
  privateLocked?: boolean;
  // 목록 마지막 줄은 구분선을 뺀다
  last?: boolean;
  // 보관함 목록에서는 진행 상태 대신 "마지막 사용"만 보여준다
  archived?: boolean;
  // 사용 가이드 대상(data-guide). 가방 탭 투어가 첫 줄에만 단다
  guide?: string;
  onOpen: () => void;
  onMenu: () => void;
}

function DdayBadge({ summary }: { summary: BagSummary }) {
  if (!summary.ddayLabel) return null;
  return <Badge tone={summary.soon ? "brand" : "neutral"}>{summary.ddayLabel}</Badge>;
}

// 끊긴 동안 만든 가방: 연결되면 알아서 계정에 올라간다
function PendingBadge({ summary }: { summary: BagSummary }) {
  if (!summary.pending) return null;
  return <Badge>올리기 대기</Badge>;
}

// 가방 한 줄: 진행률 링 · 이름(+D-day) · 상태 한 줄 · 챙긴 개수. 길게 누르기/우클릭으로 가방 메뉴.
// 넓은 화면에서 상세 칸에 열려 있는 가방은 줄 바탕을 칠해 표시한다
export function BagRow({ summary, locked, privateLocked, last, archived, guide, onOpen, onMenu }: RowProps) {
  const press = useLongPress(onMenu, onOpen);
  const { bag } = summary;
  const open = useOpenDetail().bagId === bag.id;
  return (
    <button
      type="button"
      {...press}
      data-guide={guide}
      aria-current={open ? "true" : undefined}
      className={cx(
        "flex min-h-16 select-none items-center gap-4 py-2 text-left",
        "transition-colors duration-160 ease-snappy active:bg-fill",
        // 열린 줄은 양옆으로 조금 넓혀 둥근 바탕을 칠한다(부모가 flex-col이라 너비는 저절로 늘어남)
        open ? "-mx-2 rounded-field bg-fill px-2" : "w-full bg-transparent",
        !last && !open && "border-b border-line",
      )}
    >
      {privateLocked ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-sub" aria-hidden="true">
          <IconLock size={18} stroke={1.9} />
        </span>
      ) : (
        <ProgressRing value={summary.ratio} label={`${bag.name} 챙긴 비율`} className={archived ? "opacity-50" : undefined} />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cx("truncate text-body font-semibold", archived ? "text-sub" : "text-ink")}>{bag.name || "이름 없는 가방"}</span>
          {!archived && <DdayBadge summary={summary} />}
          <PendingBadge summary={summary} />
          {locked && <IconEye size={14} stroke={1.9} className="shrink-0 text-faint" aria-label="읽기 전용 가방" />}
        </span>
        <span className="truncate text-caption text-sub">
          {privateLocked ? "잠긴 가방" : archived ? `마지막 사용 · ${formatRelativeDay(summary.activityAt)}` : summary.status}
        </span>
      </span>
      {summary.total > 0 && !privateLocked && (
        <span className="shrink-0 text-caption font-semibold text-sub">
          {summary.done}/{summary.total}
        </span>
      )}
    </button>
  );
}

// 홈 상단 큰 카드(캐러셀 한 장). eyebrow = 제목 위 작은 줄(고정 / 곧 출발 / 지금 싸는 중).
export function FeaturedBagCard({
  summary,
  locked,
  eyebrow,
  onOpen,
  onMenu,
}: Omit<RowProps, "last" | "archived"> & { eyebrow?: string }) {
  const press = useLongPress(onMenu, onOpen);
  const { bag } = summary;
  const label = eyebrow ?? `지금 싸는 중${summary.activityLabel ? ` · ${summary.activityLabel}` : ""}`;
  return (
    <button
      type="button"
      {...press}
      className={cx(
        "flex h-full w-full select-none flex-col justify-between gap-4 rounded-card border border-line bg-card p-5 text-left",
        "transition-colors duration-160 ease-snappy active:bg-fill",
      )}
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-micro font-semibold text-brand">{label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-heading font-bold text-ink">{bag.name || "이름 없는 가방"}</span>
            {locked && <IconEye size={16} stroke={1.9} className="shrink-0 text-faint" aria-label="읽기 전용 가방" />}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <PendingBadge summary={summary} />
          <DdayBadge summary={summary} />
        </span>
      </span>
      <span className="flex w-full flex-col gap-2">
        <ProgressBar value={summary.ratio} label={`${bag.name} 챙긴 비율`} />
        <span className="flex items-center justify-between gap-3 text-caption text-sub">
          <span>{summary.total > 0 ? `${summary.done} / ${summary.total} 챙김` : "아직 비어 있어요"}</span>
          {bag.lastPackedAt && <span className="truncate">마지막으로 다 싼 날 · {formatRelativeDay(bag.lastPackedAt)}</span>}
        </span>
      </span>
    </button>
  );
}
