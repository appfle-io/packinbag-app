// 가방 보관함 / 팩 보관함 상단 검색 기능에서 쓰는 검색 유틸.
// 순수 함수만 모아둬서 두 화면(HomeScreen, PacksScreen)이 동일한 로직을 공유한다.

import { Bag, Pack } from "@/lib/types";
import { getEditorDocFullText } from "@/lib/editorDocLimits";

// 결과 개수가 너무 많아지는 것을 막기 위한 상한 (화면당).
const MAX_RESULTS = 30;

// 에디터팩(자유문서형 메모 팩)의 메모 내용 안에서도 검색어를 찾는다. 매번 전체 텍스트를
// 다시 뽑는 비용이 있지만(검색 타이핑마다), 팩 개수가 개인 라이브러리/가방 규모에서는
// 충분히 가벼워서 캐싱 없이도 괜찮다.
function packMatchesText(pack: Pack, q: string): boolean {
  if (pack.name.toLowerCase().includes(q)) return true;
  if (pack.kind === "editor" && pack.editorDoc) {
    return getEditorDocFullText(pack.editorDoc).toLowerCase().includes(q);
  }
  return false;
}

export type BagSearchResultType = "bag" | "pack" | "item";

export interface BagSearchResult {
  type: BagSearchResultType;
  // React key용 고유 id
  id: string;
  // 결과 목록에 크게 보여줄 이름 (가방/팩/짐 텍스트, 메모팩이면 미리보기 텍스트)
  label: string;
  // 그 아래 작게 보여줄 위치 설명 (예: "가방이름 · 팩이름")
  subtitle?: string;
  bag: Bag;
  packId?: string;
  itemId?: string;
}

// searchBags의 반환값. truncated가 true면 실제 매칭이 MAX_RESULTS(30개)보다 많아서
// 화면에 안내 문구를 띄울 수 있게 한다 (PackSearchOutput과 동일한 패턴).
export interface BagSearchOutput {
  results: BagSearchResult[];
  truncated: boolean;
}

// 가방 보관함 검색: 가방 이름 / 가방 속 팩 이름(+메모팩 내용) / 팩 속 짐 텍스트를 모두 검색한다.
// MAX_RESULTS보다 하나 더 모아본 뒤에 잘라내는 방식으로 "진짜로 더 있는지"를 정확히 판별한다.
export function searchBags(bags: Bag[], query: string): BagSearchOutput {
  const q = query.trim().toLowerCase();
  if (!q) return { results: [], truncated: false };
  const results: BagSearchResult[] = [];

  bagLoop:
  for (const bag of bags) {
    if (bag.name.toLowerCase().includes(q)) {
      results.push({ type: "bag", id: `bag-${bag.id}`, label: bag.name, bag });
      if (results.length > MAX_RESULTS) break bagLoop;
    }
    for (const pack of bag.packs) {
      if (pack.name.toLowerCase().includes(q)) {
        results.push({
          type: "pack",
          id: `pack-${bag.id}-${pack.id}`,
          label: pack.name,
          subtitle: bag.name,
          bag,
          packId: pack.id,
        });
        if (results.length > MAX_RESULTS) break bagLoop;
      } else if (pack.kind === "editor" && pack.editorDoc) {
        // 메모팩은 이름이 아니라 내용이 검색어와 일치하는 경우도 있다.
        const noteText = getEditorDocFullText(pack.editorDoc);
        if (noteText.toLowerCase().includes(q)) {
          results.push({
            type: "pack",
            id: `pack-${bag.id}-${pack.id}`,
            label: pack.name,
            subtitle: `${bag.name} · 메모 내용 일치`,
            bag,
            packId: pack.id,
          });
          if (results.length > MAX_RESULTS) break bagLoop;
        }
      }
      for (const item of pack.items) {
        if (item.text && item.text.toLowerCase().includes(q)) {
          results.push({
            type: "item",
            id: `item-${bag.id}-${pack.id}-${item.id}`,
            label: item.text,
            subtitle: `${bag.name} · ${pack.name}`,
            bag,
            packId: pack.id,
            itemId: item.id,
          });
          if (results.length > MAX_RESULTS) break bagLoop;
        }
      }
    }
  }

  const truncated = results.length > MAX_RESULTS;
  return { results: results.slice(0, MAX_RESULTS), truncated };
}

export type PackSearchResultType = "pack" | "item" | "bag";

export interface PackSearchResult {
  type: PackSearchResultType;
  id: string;
  label: string;
  // 짐 매칭/메모 내용 매칭일 때 어디서 찾았는지 보여줌
  subtitle?: string;
  // type이 'pack'|'item'일 때만 있다(팩 보관함 결과).
  pack?: Pack;
  itemId?: string;
  // type이 'bag'일 때만 있다(가방 결과) - HomeScreen과 동일한 방식으로 열 수 있게 그대로 넘겨준다.
  bag?: Bag;
  packId?: string;
}

// searchLibraryPacks의 반환값. truncated가 true면 실제 매칭이 MAX_RESULTS(30개)보다 많아서
// 화면에 안내 문구("결과가 많아 상위 30개만 보여드려요" 등)를 띄울 수 있게 한다.
export interface PackSearchOutput {
  results: PackSearchResult[];
  truncated: boolean;
}

// 팩 보관함 검색: 라이브러리 팩 이름(+메모팩 내용) / 팩 속 짐 텍스트를 검색하고,
// bags를 함께 넘기면(가방 보관함과 동일하게) 가방 이름/가방 속 팩/짐까지 함께 찾아준다 -
// 팩 보관함과 가방 보관함 검색 범위를 동일하게 맞추기 위함.
export function searchLibraryPacks(
  packs: Pack[],
  query: string,
  bags?: Bag[]
): PackSearchOutput {
  const q = query.trim().toLowerCase();
  if (!q) return { results: [], truncated: false };
  const results: PackSearchResult[] = [];

  packLoop:
  for (const pack of packs) {
    if (pack.name.toLowerCase().includes(q)) {
      results.push({ type: "pack", id: `pack-${pack.id}`, label: pack.name, pack });
      if (results.length > MAX_RESULTS) break packLoop;
    } else if (pack.kind === "editor" && pack.editorDoc) {
      const noteText = getEditorDocFullText(pack.editorDoc);
      if (noteText.toLowerCase().includes(q)) {
        results.push({
          type: "pack",
          id: `pack-${pack.id}`,
          label: pack.name,
          subtitle: "메모 내용 일치",
          pack,
        });
        if (results.length > MAX_RESULTS) break packLoop;
      }
    }
    for (const item of pack.items) {
      if (item.text && item.text.toLowerCase().includes(q)) {
        results.push({
          type: "item",
          id: `item-${pack.id}-${item.id}`,
          label: item.text,
          subtitle: pack.name,
          pack,
          itemId: item.id,
        });
        if (results.length > MAX_RESULTS) break packLoop;
      }
    }
  }

  if (bags) {
    bagLoop:
    for (const bag of bags) {
      if (bag.name.toLowerCase().includes(q)) {
        results.push({
          type: "bag",
          id: `libbag-${bag.id}`,
          label: bag.name,
          subtitle: "가방",
          bag,
        });
        if (results.length > MAX_RESULTS) break bagLoop;
      }
      for (const pack of bag.packs) {
        if (packMatchesText(pack, q)) {
          results.push({
            type: "bag",
            id: `libbag-${bag.id}-${pack.id}`,
            label: pack.name,
            subtitle: `${bag.name} 안의 팩`,
            bag,
            packId: pack.id,
          });
          if (results.length > MAX_RESULTS) break bagLoop;
        }
        for (const item of pack.items) {
          if (item.text && item.text.toLowerCase().includes(q)) {
            results.push({
              type: "bag",
              id: `libbag-${bag.id}-${pack.id}-${item.id}`,
              label: item.text,
              subtitle: `${bag.name} · ${pack.name}`,
              bag,
              packId: pack.id,
              itemId: item.id,
            });
            if (results.length > MAX_RESULTS) break bagLoop;
          }
        }
      }
    }
  }

  const truncated = results.length > MAX_RESULTS;
  return { results: results.slice(0, MAX_RESULTS), truncated };
}
