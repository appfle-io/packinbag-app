import type { Bag } from "@/lib/types";
import { daysUntil, formatDDayLabel } from "@/lib/dday";
import { getViewablePacks } from "@/lib/premiumLimits";
import { statsOf, packingStateOf, type PackingState } from "@/hooks/bag";
import { formatAgo, formatShortDate } from "@/components/v2/bag/format";

// D-day가 이 일수 이내(0~7일 남음)인 가방은 최근 순서와 무관하게 목록 맨 위로 올린다.
export const SOON_DAYS = 7;
// 여행일이 이만큼 지난 가방은 "보관함으로 옮길까요?"로 제안한다(구 홈과 같은 기준).
export const ARCHIVE_SUGGEST_DAYS_PAST = 7;

export const STATE_LABEL: Record<PackingState, string> = {
  empty: "비어 있음",
  packing: "싸는 중",
  packed: "다 쌌어요",
};

export interface BagSummary {
  bag: Bag;
  done: number;
  total: number;
  ratio: number;
  state: PackingState;
  // 정렬 기준 시각: 마지막 체크 시각, 없으면(예전 가방) 마지막 수정 시각
  activityAt: string;
  // "10분 전 체크" / "3일 전 수정"
  activityLabel: string;
  // 출발일까지 남은 일수(지났으면 음수), 날짜 없으면 null
  dday: number | null;
  // 다가오는 출발일만 "D-3" / "D-DAY"
  ddayLabel: string | null;
  soon: boolean;
  // "싸는 중 · 10월 12일 · 어제 체크 · 2명"
  status: string;
}

export function summarizeBag(bag: Bag, premium: boolean): BagSummary {
  const packs = getViewablePacks(bag.packs, premium);
  const { done, total } = statsOf(packs);
  const state = packingStateOf(packs);
  const activityAt = bag.lastCheckedAt ?? bag.updatedAt ?? bag.createdAt;
  const ago = formatAgo(activityAt);
  const activityLabel = ago ? `${ago} ${bag.lastCheckedAt ? "체크" : "수정"}` : "";
  const dday = bag.travelDate ? daysUntil(bag.travelDate) : null;
  const upcoming = dday !== null && dday >= 0;
  const ddayLabel = upcoming ? formatDDayLabel(bag.travelDate, !!bag.ddayCountTodayAsDayOne) : null;
  const status = [
    STATE_LABEL[state],
    formatShortDate(bag.travelDate),
    activityLabel || null,
    bag.memberIds.length > 1 ? `${bag.memberIds.length}명` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    bag,
    done,
    total,
    ratio: total > 0 ? done / total : 0,
    state,
    activityAt,
    activityLabel,
    dday,
    ddayLabel,
    soon: upcoming && (dday as number) <= SOON_DAYS,
    status,
  };
}

const byActivityDesc = (a: BagSummary, b: BagSummary) =>
  a.activityAt < b.activityAt ? 1 : a.activityAt > b.activityAt ? -1 : 0;

// 홈 정렬: D-day 7일 이내(가까운 순) → 나머지는 최근 체크 순
export function sortForHome(list: BagSummary[]): BagSummary[] {
  const soon = list
    .filter((s) => s.soon)
    .sort((a, b) => (a.dday as number) - (b.dday as number) || byActivityDesc(a, b));
  const rest = list.filter((s) => !s.soon).sort(byActivityDesc);
  return [...soon, ...rest];
}

export interface HomeSections {
  // 상단 큰 카드: 지금 싸는 중인 가방 중 가장 최근에 체크한 것
  featured: BagSummary | null;
  pinned: BagSummary[];
  recent: BagSummary[];
}

export function buildSections(list: BagSummary[], pinnedIds: string[]): HomeSections {
  const featured = list.filter((s) => s.state === "packing").sort(byActivityDesc)[0] ?? null;
  const rest = list.filter((s) => s !== featured);
  const pinnedSet = new Set(pinnedIds);
  const pinned = pinnedIds
    .map((id) => rest.find((s) => s.bag.id === id))
    .filter((s): s is BagSummary => !!s);
  const recent = sortForHome(rest.filter((s) => !pinnedSet.has(s.bag.id)));
  return { featured, pinned, recent };
}

// 여행일이 한참 지났는데 보관하지도, 제안을 닫지도 않은 가방
export function archiveSuggestionsOf(list: BagSummary[], dismissedIds: string[]): Bag[] {
  const dismissed = new Set(dismissedIds);
  return list
    .filter((s) => s.dday !== null && s.dday <= -ARCHIVE_SUGGEST_DAYS_PAST && !dismissed.has(s.bag.id))
    .map((s) => s.bag);
}
