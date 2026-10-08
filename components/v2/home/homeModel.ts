import type { Bag } from "@/lib/types";
import { daysUntil, formatDDayLabel } from "@/lib/dday";
import { getViewablePacks } from "@/lib/premiumLimits";
import { statsOf, packingStateOf, type PackingState } from "@/hooks/bag";
import { formatAgo, formatShortDate } from "@/components/v2/bag/format";

// D-day가 이 일수 이내(0~7일 남음)인 가방은 최근 순서와 무관하게 목록 맨 위로 올린다.
const SOON_DAYS = 7;
// 여행일이 이만큼 지난 가방은 "보관함으로 옮길까요?"로 제안한다(구 홈과 같은 기준).
const ARCHIVE_SUGGEST_DAYS_PAST = 7;

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
  // 끊긴 동안 만들어서 아직 계정에 안 올라간 가방(lib/v2/pendingCreates)
  pending: boolean;
}

export function summarizeBag(bag: Bag, premium: boolean, pending = false): BagSummary {
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
    pending,
  };
}

const byActivityDesc = (a: BagSummary, b: BagSummary) =>
  a.activityAt < b.activityAt ? 1 : a.activityAt > b.activityAt ? -1 : 0;

// 홈 정렬: D-day 7일 이내(가까운 순) → 나머지는 최근 체크 순
function sortForHome(list: BagSummary[]): BagSummary[] {
  const soon = list
    .filter((s) => s.soon)
    .sort((a, b) => (a.dday as number) - (b.dday as number) || byActivityDesc(a, b));
  const rest = list.filter((s) => !s.soon).sort(byActivityDesc);
  return [...soon, ...rest];
}

export interface HomeSections {
  // 상단 캐러셀: D-day 7일 이내(가까운 순) → 지금 싸는 중(최근 체크 순), 고정 가방은 제외, 최대 5개
  highlights: Highlight[];
  // "고정" 구역: 고정한 순서 그대로(정렬과 무관하게 항상 위)
  pinned: BagSummary[];
  // 아래 "가방" 목록: 고정한 가방만 뺀 나머지 전부(캐러셀에 나온 가방도 포함), 고른 정렬대로. 화면에서는 5개씩 옆으로 넘긴다(BagListPager)
  list: BagSummary[];
}

const HIGHLIGHT_MAX = 5;

type HighlightReason = "pinned" | "soon" | "packing";
export interface Highlight {
  summary: BagSummary;
  reason: HighlightReason;
}

// 홈 목록 정렬. 값은 구 UI와 같은 UserProfile.bagSortBy에 저장한다(nameAsc/nameDesc/custom은 그대로, 그 외 값은 모두 "최근순")
// custom(직접 정한 순서)은 폴더마다 따로(bagOrderByParent[폴더 id | "root"]). 구 UI 드래그로 정한 순서도 그대로 이어받는다
export type HomeSort = "recent" | "nameAsc" | "nameDesc" | "custom";
export const HOME_SORT_LABEL: Record<HomeSort, string> = {
  recent: "최근순",
  nameAsc: "이름순 (ㄱ→ㅎ)",
  nameDesc: "이름 역순 (ㅎ→ㄱ)",
  custom: "직접 정한 순서",
};
export function homeSortOf(bagSortBy: string | undefined): HomeSort {
  return bagSortBy === "nameAsc" || bagSortBy === "nameDesc" || bagSortBy === "custom" ? bagSortBy : "recent";
}

const nameOf = (s: BagSummary) => (s.bag.name || "").trim();

// order: custom일 때 쓰는 가방 id 순서. 여기 없는 가방(새 가방 등)은 뒤에 최근순으로 붙는다
function sortHomeList(list: BagSummary[], sort: HomeSort, order?: string[]): BagSummary[] {
  if (sort === "recent") return sortForHome(list);
  if (sort === "custom") {
    const index = new Map((order ?? []).map((id, i) => [id, i]));
    const known = list.filter((s) => index.has(s.bag.id)).sort((a, b) => index.get(a.bag.id)! - index.get(b.bag.id)!);
    return [...known, ...sortForHome(list.filter((s) => !index.has(s.bag.id)))];
  }
  const dir = sort === "nameAsc" ? 1 : -1;
  return [...list].sort((a, b) => dir * nameOf(a).localeCompare(nameOf(b), "ko") || byActivityDesc(a, b));
}

export function buildSections(list: BagSummary[], pinnedIds: string[], sort: HomeSort = "recent", order?: string[]): HomeSections {
  const highlights: Highlight[] = [];
  const used = new Set<string>();
  const push = (s: BagSummary, reason: HighlightReason) => {
    if (highlights.length >= HIGHLIGHT_MAX || used.has(s.bag.id)) return;
    used.add(s.bag.id);
    highlights.push({ summary: s, reason });
  };
  const pinned: BagSummary[] = [];
  for (const id of pinnedIds) {
    const s = list.find((x) => x.bag.id === id);
    if (s && !used.has(s.bag.id)) {
      used.add(s.bag.id);
      pinned.push(s);
    }
  }
  list
    .filter((s) => s.soon)
    .sort((a, b) => (a.dday as number) - (b.dday as number) || byActivityDesc(a, b))
    .forEach((s) => push(s, "soon"));
  list
    .filter((s) => s.state === "packing")
    .sort(byActivityDesc)
    .forEach((s) => push(s, "packing"));

  const pinnedSet = new Set(pinned.map((s) => s.bag.id));
  return { highlights, pinned, list: sortHomeList(list.filter((s) => !pinnedSet.has(s.bag.id)), sort, order) };
}

// 여행일이 한참 지났는데 보관하지도, 제안을 닫지도 않은 가방
export function archiveSuggestionsOf(list: BagSummary[], dismissedIds: string[]): Bag[] {
  const dismissed = new Set(dismissedIds);
  return list
    .filter((s) => s.dday !== null && s.dday <= -ARCHIVE_SUGGEST_DAYS_PAST && !dismissed.has(s.bag.id))
    .map((s) => s.bag);
}
