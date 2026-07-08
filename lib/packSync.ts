import { Item, Pack } from "@/lib/types";

export function itemsMatch(a: Item[], b: Item[]) {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.type === b[i].type && item.text === b[i].text);
}

// 가방 안의 팩이 지금 이 순간 기준으로 라이브러리 원본과 완전히 같은 내용인지 확인.
// 캐시된 pack.savedAsLibraryPack 필드에 의존하지 않고 매번 현재 libraryPacks와
// 직접 비교하므로, 다른 가방/기기에서 같은 라이브러리 팩을 먼저 바꿔놔도 정확히 반영된다.
export function isInSyncWithLibrary(pack: Pack, libraryPacks: Pack[]): boolean {
  if (!pack.linkedLibraryPackId) return false;
  const source = libraryPacks.find((p) => p.id === pack.linkedLibraryPackId);
  if (!source) return false;
  return pack.name.trim() === source.name.trim() && itemsMatch(pack.items, source.items);
}
