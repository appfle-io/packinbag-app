import { Item, Pack, Bag } from "@/lib/types";

export function itemsMatch(a: Item[], b: Item[]) {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.type === b[i].type && item.text === b[i].text);
}

// 가방 안의 팩이 지금 이 순간 기준으로 보관함 원본과 완전히 같은 내용인지 확인.
// 캐시된 pack.savedAsLibraryPack 필드에 의존하지 않고 매번 현재 libraryPacks와
// 직접 비교하므로, 다른 가방/기기에서 같은 보관함 팩을 먼저 바꿔놔도 정확히 반영된다.
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

// 이 팩이 연동된 보관함 원본이 지금 로그인한 사람 자신의 보관함에 실제로 있는지
// 확인한다. 가방은 여러 명이 같이 쓰다 보니 linkedLibraryPackId가 다른 멤버가 저장해둔
// 보관함 팩을 가리킬 수도 있는데, 그런 경우에는 다른 사람의 보관함 공간을 지울
// 권한이 없으니 "함께 삭제" 옵션 자체를 보여주지 않아야 한다.
export function canDeleteFromLibrary(pack: Pack, libraryPacks: Pack[]): boolean {
  if (!pack.linkedLibraryPackId) return false;
  return libraryPacks.some((p) => p.id === pack.linkedLibraryPackId);
}

// 보관함 팩(libraryPackIds)을 가리키는 linkedLibraryPackId를 가진 가방 속 팩들을 모두 찾는다.
// 보관함에서 팩을 삭제(휴지통 이동)할 때, 연결된 가방 속 사본을 함께 지울지/연결만 끊을지
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

// --- 메모팩(에디터팩) 실시간 동기화 ------------------------------------------
// 팩 보관함의 메모팩과, 그걸 연동해서 가방에 불러온 사본을 "가방을 열 때 / 팩 보관함에
// 들어갈 때" 그 순간에 한 번 비교해서 최신 쪽 내용으로 맞춘다(양방향). 체크리스트 팩과
// 달리 메모팩은 items가 항상 빈 배열이고 진행률/체크 개념 자체가 없어서(에디터팩 주석
// 참고), 짐 단위 병합 없이 문서(editorDoc) 통째로 비교/복사하면 충분하다. 지속적인
// onSnapshot 구독이나 서버 트리거 없이, 화면 진입 시점 1회성 비교라 핑퐁(무한루프)
// 걱정도 없다.
export interface EditorSyncPatch {
  name: string;
  editorDoc: object | null;
  editorPreviewText?: string;
  updatedAt: string;
}

// bagPack(가방 속 사본)과 libraryPack(연동된 보관함 원본) 중 어느 쪽을 기준으로 맞춰야
// 하는지 판정한다. updatedAt이 없는 예전 데이터는 가장 오래된 것(0)으로 취급한다.
// 이미 내용이 완전히 같으면(타임스탬프만 다르고 실제 문서는 동일) "none"을 돌려서
// 불필요한 쓰기를 만들지 않는다.
export function resolveEditorSyncDirection(
  bagPack: Pack,
  libraryPack: Pack
): "bag-wins" | "library-wins" | "none" {
  if (bagPack.kind !== "editor" || libraryPack.kind !== "editor") return "none";
  const sameContent =
    JSON.stringify(bagPack.editorDoc ?? null) === JSON.stringify(libraryPack.editorDoc ?? null) &&
    bagPack.name.trim() === libraryPack.name.trim();
  if (sameContent) return "none";
  const bagTime = bagPack.updatedAt ? new Date(bagPack.updatedAt).getTime() : 0;
  const libTime = libraryPack.updatedAt ? new Date(libraryPack.updatedAt).getTime() : 0;
  if (bagTime === libTime) return "none";
  return bagTime > libTime ? "bag-wins" : "library-wins";
}

// 이긴 쪽(source)의 이름/문서 내용만 뽑아서, 상대편에 그대로 덮어쓸 부분 패치를 만든다.
export function buildEditorSyncPatch(source: Pack): EditorSyncPatch {
  return {
    name: source.name,
    editorDoc: source.editorDoc ?? null,
    editorPreviewText: source.editorPreviewText,
    updatedAt: source.updatedAt ?? new Date().toISOString(),
  };
}
