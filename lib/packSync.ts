import { Item, Pack, Bag } from "@/lib/types";

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
  if (pack.name.trim() !== source.name.trim()) return false;
  // 에디터팩(자유문서형)은 items가 항상 빈 배열이라 itemsMatch로는 내용 차이를
  // 감지할 수 없으므로, editorDoc(TipTap JSON) 자체를 직접 비교한다.
  if (pack.kind === "editor" || source.kind === "editor") {
    return JSON.stringify(pack.editorDoc ?? null) === JSON.stringify(source.editorDoc ?? null);
  }
  return itemsMatch(pack.items, source.items);
}

// 이 팩이 연동된 라이브러리 원본이 지금 로그인한 사람 자신의 라이브러리에 실제로 있는지
// 확인한다. 가방은 여러 명이 같이 쓰다 보니 linkedLibraryPackId가 다른 멤버가 저장해둔
// 라이브러리 팩을 가리킬 수도 있는데, 그런 경우에는 다른 사람의 라이브러리 공간을 지울
// 권한이 없으니 "함께 삭제" 옵션 자체를 보여주지 않아야 한다.
export function canDeleteFromLibrary(pack: Pack, libraryPacks: Pack[]): boolean {
  if (!pack.linkedLibraryPackId) return false;
  return libraryPacks.some((p) => p.id === pack.linkedLibraryPackId);
}

// 라이브러리 팩(libraryPackIds)을 가리키는 linkedLibraryPackId를 가진 가방 속 팩들을 모두 찾는다.
// 라이브러리에서 팩을 삭제(휴지통 이동)할 때, 연결된 가방 속 사본을 함께 지울지/연결만 끊을지
// 물어보기 위해 쓴다(폴더 삭제 시는 하위 팩 id까지 모두 넘겨야 한다).
export function findLinkedBagPackRefs(
  bags: Bag[],
  libraryPackIds: Set<string>
): { bagId: string; packId: string }[] {
  const refs: { bagId: string; packId: string }[] = [];
  for (const bag of bags) {
    for (const p of bag.packs) {
      if (p.linkedLibraryPackId && libraryPackIds.has(p.linkedLibraryPackId)) {
        refs.push({ bagId: bag.id, packId: p.id });
      }
    }
  }
  return refs;
}
