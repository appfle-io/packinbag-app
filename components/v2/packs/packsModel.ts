import type { ListSortOption, Pack } from "@/lib/types";
import { arrangeList } from "@/lib/listSort";
import { formatAgo } from "@/components/v2/bag/format";

// 폴더 트리 깊이 방어(구 PacksScreen과 같은 값). parentId가 꼬여 순환해도 무한 루프에 빠지지 않게.
const MAX_DEPTH = 20;

// 팩 탭 정렬(2026-10-14, 가방 홈과 같은 4가지). 값은 UserProfile.packSortBy에 저장한다.
// 최근순 = 최근에 고친 순(updatedAt, 없으면 만든 시각). 예전 기본값 "createdAt"을 포함해 나머지 값은 모두 최근순으로 읽는다
export type PackSort = "recent" | "nameAsc" | "nameDesc" | "custom";
export const PACK_SORT_LABEL: Record<PackSort, string> = {
  recent: "최근순",
  nameAsc: "이름순 (ㄱ→ㅎ)",
  nameDesc: "이름 역순 (ㅎ→ㄱ)",
  custom: "직접 정한 순서",
};
export function packSortOf(packSortBy: string | undefined): PackSort {
  return packSortBy === "nameAsc" || packSortBy === "nameDesc" || packSortBy === "custom" ? packSortBy : "recent";
}
// arrangeList에 넘길 값
export function packSortOption(sort: PackSort): ListSortOption {
  return sort === "recent" ? "updatedAt" : sort;
}

// 이 폴더(없으면 최상위) 바로 아래 항목: 폴더 먼저, 그다음 팩/메모.
// 각 묶음 안의 순서는 구 화면과 같은 규칙(정렬 기준 + 고정 + 직접 정한 순서)을 그대로 따른다.
export function entriesIn(
  packs: Pack[],
  folderId: string | undefined,
  opts: { sortBy?: ListSortOption; pinnedIds: string[]; orderByParent?: Record<string, string[]> },
): Pack[] {
  const siblings = packs.filter((p) => (p.parentId ?? undefined) === folderId);
  const arranged = arrangeList(siblings, {
    sortBy: opts.sortBy,
    pinnedIds: opts.pinnedIds,
    order: opts.orderByParent?.[folderId ?? "root"] ?? [],
    maxPinned: Infinity,
  });
  return [...arranged.filter((p) => p.type === "folder"), ...arranged.filter((p) => p.type !== "folder")];
}

// 최상위에서 이 폴더까지의 폴더 목록(자기 자신 포함). 중간 폴더가 사라졌으면 거기서 끊는다.
export function pathTo(packs: Pack[], folderId: string | undefined): Pack[] {
  const byId = new Map(packs.map((p) => [p.id, p]));
  const chain: Pack[] = [];
  let cur = folderId ? byId.get(folderId) : undefined;
  while (cur && chain.length < MAX_DEPTH) {
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

// 폴더 안(하위 폴더 포함)의 팩·메모 개수와 바로 아래 하위 폴더 개수
function folderCounts(packs: Pack[], folderId: string): { packs: number; subfolders: number } {
  let count = 0;
  const walk = (id: string, depth: number) => {
    if (depth > MAX_DEPTH) return;
    for (const p of packs) {
      if (p.parentId !== id) continue;
      if (p.type === "folder") walk(p.id, depth + 1);
      else count += 1;
    }
  };
  walk(folderId, 0);
  const subfolders = packs.filter((p) => p.parentId === folderId && p.type === "folder").length;
  return { packs: count, subfolders };
}

// 목록 한 줄 아래에 보여줄 설명
export function metaOf(packs: Pack[], entry: Pack): string {
  if (entry.type === "folder") {
    const { packs: n, subfolders } = folderCounts(packs, entry.id);
    return n === 0 && subfolders === 0 ? "비어 있음" : `팩 ${n}개${subfolders ? ` · 하위 폴더 ${subfolders}개` : ""}`;
  }
  if (entry.kind === "editor") {
    const preview = (entry.editorPreviewText ?? "").replace(/\s+/g, " ").trim();
    if (preview) return `메모 · ${preview}`;
    const ago = formatAgo(entry.updatedAt);
    return ago ? `메모 · ${ago} 수정` : "메모";
  }
  if (entry.items.length === 0) return "비어 있음";
  const names = entry.items
    .slice(0, 3)
    .map((i) => i.text)
    .join(", ");
  return `아이템 ${entry.items.length}개 · ${names}`;
}

// "여행 › 해외" (검색 결과·이동 대상 표시용). 최상위면 "팩"
export function pathLabel(packs: Pack[], folderId: string | undefined): string {
  const chain = pathTo(packs, folderId);
  return chain.length === 0 ? "팩" : chain.map((f) => f.name).join(" › ");
}

// 옮길 수 있는 폴더(자기 자신과 그 하위 폴더는 뺀다)를 경로 이름 순으로
export function moveTargets(packs: Pack[], movingIds: Set<string>, descendantsOf: (id: string) => string[]) {
  const blocked = new Set(movingIds);
  movingIds.forEach((id) => descendantsOf(id).forEach((d) => blocked.add(d)));
  return packs
    .filter((p) => p.type === "folder" && !blocked.has(p.id))
    .map((f) => ({ folder: f, label: pathLabel(packs, f.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
}
