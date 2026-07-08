import { ListSortOption } from "@/lib/types";

export const SORT_OPTION_LABELS: Record<ListSortOption, string> = {
  createdAt: "생성일자순",
  nameAsc: "이름 오름차순",
  nameDesc: "이름 내림차순",
  updatedAt: "최근 업데이트순",
};

export const SORT_OPTIONS: ListSortOption[] = [
  "createdAt",
  "nameAsc",
  "nameDesc",
  "updatedAt",
];

// 가방/팩 목록에 공통으로 쓰는 정렬. 원본 배열은 건드리지 않고 정렬된 새 배열을 반환한다.
export function sortByOption<T extends { name: string; createdAt?: string; updatedAt?: string }>(
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
    default:
      // 생성일자가 없는 예전 데이터는 맨 뒤로 밀리지 않도록 updatedAt으로 대체
      return list.sort((a, b) =>
        (b.createdAt ?? b.updatedAt ?? "").localeCompare(a.createdAt ?? a.updatedAt ?? "")
      );
  }
}
