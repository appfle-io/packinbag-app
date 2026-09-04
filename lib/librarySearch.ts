// 가방 보관함 / 팩 보관함 공통 글로벌 통합 검색 유틸.
// 순수 함수로 작성되어 HomeScreen, PacksScreen, DesktopSidebar가 100% 동일한 검색 결과를 공유한다.

import { Bag, Pack } from "@/lib/types";
import { getEditorDocFullText } from "@/lib/editorDocLimits";

// 결과 개수가 너무 많아지는 것을 막기 위한 상한 (화면당).
const MAX_RESULTS = 30;

// 검색어가 포함된 메모 텍스트에서 검색어 앞뒤 짧은 문맥(스니펫 1줄) 추출
export function extractTextSnippet(fullText: string, query: string, radius = 45): string {
  if (!fullText || !query) return "";
  const lowerText = fullText.toLowerCase();
  const lowerQ = query.trim().toLowerCase();
  const index = lowerText.indexOf(lowerQ);
  if (index === -1) return fullText.slice(0, 90);

  const start = Math.max(0, index - radius);
  const end = Math.min(fullText.length, index + lowerQ.length + radius);
  let snippet = fullText.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < fullText.length) snippet = snippet + "...";
  return snippet;
}

// 검색어가 포함된 메모 텍스트에서 앞뒤 상세 문맥(펼치기용) 추출
export function extractLongTextSnippet(fullText: string, query: string, radius = 160): string {
  if (!fullText || !query) return "";
  const lowerText = fullText.toLowerCase();
  const lowerQ = query.trim().toLowerCase();
  const index = lowerText.indexOf(lowerQ);
  if (index === -1) return fullText.slice(0, 300);

  const start = Math.max(0, index - radius);
  const end = Math.min(fullText.length, index + lowerQ.length + radius);
  let snippet = fullText.slice(start, end).trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < fullText.length) snippet = snippet + "...";
  return snippet;
}

export type SearchResultType = "bag" | "pack" | "item";

export interface GlobalSearchResult {
  type: SearchResultType;
  id: string;
  label: string;
  subtitle?: string;
  bag?: Bag;
  pack?: Pack;
  packId?: string;
  itemId?: string;
  isEditorPack?: boolean;
  snippet?: string;
  fullSnippet?: string;
}

export interface GlobalSearchOutput {
  results: GlobalSearchResult[];
  truncated: boolean;
}

// 하위 호환용 타입 alias
export type BagSearchResultType = SearchResultType;
export type BagSearchResult = GlobalSearchResult;
export type BagSearchOutput = GlobalSearchOutput;
export type PackSearchResultType = SearchResultType;
export type PackSearchResult = GlobalSearchResult;
export type PackSearchOutput = GlobalSearchOutput;

// 1. 가방 검색 전용 (가방 이름, 가방 속 팩 / 메모 / 짐)
export function searchBags(bags: Bag[] = [], query: string): GlobalSearchOutput {
  const q = query.trim().toLowerCase();
  if (!q) return { results: [], truncated: false };
  const results: GlobalSearchResult[] = [];

  bagLoop:
  for (const bag of bags) {
    if (!bag) continue;
    if (bag.name && bag.name.toLowerCase().includes(q)) {
      results.push({
        type: "bag",
        id: `bag-${bag.id}`,
        label: bag.name,
        bag,
      });
      if (results.length > MAX_RESULTS) break bagLoop;
    }

    const packs = Array.isArray(bag.packs) ? bag.packs : [];
    for (const pack of packs) {
      if (!pack) continue;
      const isEditor = pack.kind === "editor";
      const nameMatched = Boolean(pack.name && pack.name.toLowerCase().includes(q));
      const noteText = isEditor && pack.editorDoc ? getEditorDocFullText(pack.editorDoc) : "";
      const docMatched = Boolean(noteText && noteText.toLowerCase().includes(q));

      if (isEditor) {
        if (nameMatched || docMatched) {
          results.push({
            type: "pack",
            id: `bagpack-${bag.id}-${pack.id}`,
            label: pack.name || "제목 없는 메모",
            subtitle: bag.name,
            bag,
            packId: pack.id,
            isEditorPack: true,
            snippet: docMatched ? extractTextSnippet(noteText, q) : undefined,
            fullSnippet: docMatched ? extractLongTextSnippet(noteText, q) : undefined,
          });
          if (results.length > MAX_RESULTS) break bagLoop;
        }
      } else if (nameMatched) {
        results.push({
          type: "pack",
          id: `bagpack-${bag.id}-${pack.id}`,
          label: pack.name,
          subtitle: bag.name,
          bag,
          packId: pack.id,
          isEditorPack: false,
        });
        if (results.length > MAX_RESULTS) break bagLoop;
      }

      const items = Array.isArray(pack.items) ? pack.items : [];
      for (const item of items) {
        if (item && item.text && item.text.toLowerCase().includes(q)) {
          results.push({
            type: "item",
            id: `bagitem-${bag.id}-${pack.id}-${item.id}`,
            label: item.text,
            subtitle: `${bag.name} > ${pack.name}`,
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

// 2. 팩 보관함 검색 전용 (팩 이름, 팩 메모, 팩 속 짐)
export function searchLibraryPacks(libraryPacks: Pack[] = [], query: string): GlobalSearchOutput {
  const q = query.trim().toLowerCase();
  if (!q) return { results: [], truncated: false };
  const results: GlobalSearchResult[] = [];

  libPackLoop:
  for (const pack of libraryPacks) {
    if (!pack || pack.type === "folder") continue;
    const isEditor = pack.kind === "editor";
    const nameMatched = Boolean(pack.name && pack.name.toLowerCase().includes(q));
    const noteText = isEditor && pack.editorDoc ? getEditorDocFullText(pack.editorDoc) : "";
    const docMatched = Boolean(noteText && noteText.toLowerCase().includes(q));

    if (isEditor) {
      if (nameMatched || docMatched) {
        results.push({
          type: "pack",
          id: `libpack-${pack.id}`,
          label: pack.name || "제목 없는 메모",
          subtitle: "팩 보관함",
          pack,
          isEditorPack: true,
          snippet: docMatched ? extractTextSnippet(noteText, q) : undefined,
          fullSnippet: docMatched ? extractLongTextSnippet(noteText, q) : undefined,
        });
        if (results.length > MAX_RESULTS) break libPackLoop;
      }
    } else if (nameMatched) {
      results.push({
        type: "pack",
        id: `libpack-${pack.id}`,
        label: pack.name,
        subtitle: "팩 보관함",
        pack,
        isEditorPack: false,
      });
      if (results.length > MAX_RESULTS) break libPackLoop;
    }

    const items = Array.isArray(pack.items) ? pack.items : [];
    for (const item of items) {
      if (item && item.text && item.text.toLowerCase().includes(q)) {
        results.push({
          type: "item",
          id: `libitem-${pack.id}-${item.id}`,
          label: item.text,
          subtitle: `팩 보관함 > ${pack.name}`,
          pack,
          itemId: item.id,
        });
        if (results.length > MAX_RESULTS) break libPackLoop;
      }
    }
  }

  const truncated = results.length > MAX_RESULTS;
  return { results: results.slice(0, MAX_RESULTS), truncated };
}

// 3. 글로벌 통합 검색 (가방 + 팩보관함 모두 검색)
export function searchGlobal(
  bags: Bag[] = [],
  libraryPacks: Pack[] = [],
  query: string
): GlobalSearchOutput {
  const bagRes = searchBags(bags, query);
  const packRes = searchLibraryPacks(libraryPacks, query);
  const combined = [...bagRes.results, ...packRes.results];
  const truncated = bagRes.truncated || packRes.truncated || combined.length > MAX_RESULTS;
  return { results: combined.slice(0, MAX_RESULTS), truncated };
}

