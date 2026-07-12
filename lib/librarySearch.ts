// 가방 보관함 / 팩 보관함 상단 검색 기능에서 쓰는 검색 유틸.
// 순수 함수만 모아둬서 두 화면(HomeScreen, PacksScreen)이 동일한 로직을 공유한다.

import { Bag, Pack } from "@/lib/types";

// 결과 개수가 너무 많아지는 것을 막기 위한 상한 (화면당).
const MAX_RESULTS = 30;

export type BagSearchResultType = "bag" | "pack" | "item";

export interface BagSearchResult {
  type: BagSearchResultType;
  // React key용 고유 id
  id: string;
  // 결과 목록에 크게 보여줄 이름 (가방/팩/짐 텍스트)
  label: string;
  // 그 아래 작게 보여줄 위치 설명 (예: "가방이름 · 팩이름")
  subtitle?: string;
  bag: Bag;
  packId?: string;
  itemId?: string;
}

// 가방 보관함 검색: 가방 이름 / 가방 속 팩 이름 / 팩 속 짐 텍스트를 모두 검색한다.
export function searchBags(bags: Bag[], query: string): BagSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: BagSearchResult[] = [];

  for (const bag of bags) {
    if (bag.name.toLowerCase().includes(q)) {
      results.push({ type: "bag", id: `bag-${bag.id}`, label: bag.name, bag });
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
        }
      }
      if (results.length >= MAX_RESULTS) return results.slice(0, MAX_RESULTS);
    }
  }

  return results.slice(0, MAX_RESULTS);
}

export type PackSearchResultType = "pack" | "item";

export interface PackSearchResult {
  type: PackSearchResultType;
  id: string;
  label: string;
  // 짐 매칭일 때만 어느 팩에 있는지 보여줌
  subtitle?: string;
  pack: Pack;
  itemId?: string;
}

// 팩 보관함 검색: 라이브러리 팩 이름 / 팩 속 짐 텍스트를 검색한다.
export function searchLibraryPacks(packs: Pack[], query: string): PackSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: PackSearchResult[] = [];

  for (const pack of packs) {
    if (pack.name.toLowerCase().includes(q)) {
      results.push({ type: "pack", id: `pack-${pack.id}`, label: pack.name, pack });
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
      }
    }
    if (results.length >= MAX_RESULTS) return results.slice(0, MAX_RESULTS);
  }

  return results.slice(0, MAX_RESULTS);
}
