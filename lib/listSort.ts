import { ListSortOption } from "@/lib/types";

// 가방/팩 목록에 공통으로 쓰는 정렬. 원본 배열은 건드리지 않고 정렬된 새 배열을 반환한다.
// "custom"은 순서 정보(order)가 따로 필요해서 이 함수 하나로는 처리할 수 없다 -
// arrangeList(고정핀 + custom 순서까지 포함)를 대신 쓴다. 여기서는 방어적으로
// createdAt 정렬로 대체한다.
function sortByOption<T extends { name: string; createdAt?: string; updatedAt?: string }>(
  items: T[],
  sortBy: ListSortOption | undefined
): T[] {
  const list = [...items];
  switch (sortBy) {
    case "nameAsc":
      return list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    case "nameDesc":
      return list.sort((a, b) => b.name.localeCompare(a.name, "ko"));
    case "updatedAt":
      return list.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    case "createdAt":
    case "custom":
    default:
      // 생성일자가 없는 예전 데이터는 맨 뒤로 밀리지 않도록 updatedAt으로 대체
      return list.sort((a, b) =>
        (b.createdAt ?? b.updatedAt ?? "").localeCompare(a.createdAt ?? a.updatedAt ?? "")
      );
  }
}

// 고정핀(pinnedIds) + 정렬기준(sortBy) + custom 순서(order)를 모두 반영해
// 최종 화면에 보여줄 순서를 계산한다. 고정된 항목은 항상 맨 앞, pinnedIds에 적힌
// 순서 그대로 보여준다. sortBy가 "custom"이면 나머지는 order(id 배열)를 따르고,
// order에 없는(새로 생긴) 항목은 생성일자 최신순으로 뒤에 자동으로 붙는다.
// maxPinned: 고정핀 개수 제한(없으면 3 기본값 - 가방 등 기존 기본값). v69부터 팩은
// 무제한이라 호출부가(PacksScreen) Infinity를 넘겨준다.
export function arrangeList<
  T extends { id: string; name: string; createdAt?: string; updatedAt?: string }
>(
  items: T[],
  opts: {
    sortBy?: ListSortOption;
    pinnedIds?: string[];
    order?: string[];
    maxPinned?: number;
  }
): T[] {
  const pinnedIds = (opts.pinnedIds ?? []).slice(0, opts.maxPinned ?? 3);
  const pinnedSet = new Set(pinnedIds);
  const byId = new Map(items.map((it) => [it.id, it]));
  const pinned = pinnedIds.map((id) => byId.get(id)).filter((it): it is T => !!it);
  const rest = items.filter((it) => !pinnedSet.has(it.id));

  if (opts.sortBy !== "custom") {
    return [...pinned, ...sortByOption(rest, opts.sortBy)];
  }

  const order = opts.order ?? [];
  const orderIndex = new Map(order.map((id, i) => [id, i]));
  const known = rest
    .filter((it) => orderIndex.has(it.id))
    .sort((a, b) => orderIndex.get(a.id)! - orderIndex.get(b.id)!);
  const unknown = sortByOption(
    rest.filter((it) => !orderIndex.has(it.id)),
    "createdAt"
  );
  return [...pinned, ...known, ...unknown];
}

// 고정핀 토글. 이미 고정돼있으면 해제, 아니면 추가(max개를 넘으면 무시하고 그대로 반환).
// max가 없으면 기존처럼 3개 기본값(가방). 팩은 v69부터 Infinity를 넘겨받아 무제한이다.
// 리디자인 v2 홈은 고정한 가방을 상단 캐러셀에 보여주면서 가방 고정을 5개까지 늘렸다(V2_MAX_PINNED_BAGS).
export const V2_MAX_PINNED_BAGS = 5;
export function togglePinned(pinnedIds: string[] | undefined, id: string, max: number = 3): string[] {
  const current = pinnedIds ?? [];
  if (current.includes(id)) return current.filter((p) => p !== id);
  if (current.length >= max) return current;
  return [...current, id];
}
