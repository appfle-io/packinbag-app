// 위젯 · 단축어 · 실시간 현황(iOS 네이티브)이 읽는 가방 요약(2026-10-10).
// 웹(앱이 열려 있을 때 lib/v2/nativeBridge.ts)과 서버(app/api/native/summary)가 같은 모양을 만든다.
// 네이티브는 이 JSON을 App Group에 저장해 두고 읽는다(ios/App/PackInBagWidget/Shared/SummaryStore.swift).
// - 체크리스트 팩의 체크 아이템만(메모 · 글 아이템 · 폴더 제외). 메모 본문은 절대 넣지 않는다
// - 크기를 작게: 가방 최근 30개, 팩당 아이템 80개, 글자 80자
import type { Bag } from "@/lib/types";

export const NATIVE_SUMMARY_VERSION = 1;
const MAX_BAGS = 30;
const MAX_ITEMS = 80;
const MAX_TEXT = 80;

export interface NativeSummaryItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface NativeSummaryPack {
  id: string;
  name: string;
  items: NativeSummaryItem[];
}

export interface NativeSummaryBag {
  id: string;
  name: string;
  travelDate?: string;
  packs: NativeSummaryPack[];
}

export interface NativeSummary {
  v: number;
  updatedAt: string;
  bags: NativeSummaryBag[];
}

const clip = (s: unknown) => (typeof s === "string" ? s : "").slice(0, MAX_TEXT);

// uid가 소유자이면서 휴지통에 넣은 가방은 뺀다(목록 화면과 같은 기준)
export function buildNativeSummary(bags: Bag[], uid: string, now: Date = new Date()): NativeSummary {
  const active = bags.filter((b) => !(b.ownerId === uid && b.trashedByOwnerAt));
  const recent = [...active]
    .sort((a, b) => (b.lastCheckedAt ?? b.updatedAt ?? "").localeCompare(a.lastCheckedAt ?? a.updatedAt ?? ""))
    .slice(0, MAX_BAGS);
  return {
    v: NATIVE_SUMMARY_VERSION,
    updatedAt: now.toISOString(),
    bags: recent.map((bag) => ({
      id: bag.id,
      name: clip(bag.name) || "가방",
      ...(bag.travelDate ? { travelDate: bag.travelDate } : {}),
      packs: (Array.isArray(bag.packs) ? bag.packs : [])
        .filter((p) => p && p.kind !== "editor" && p.type !== "folder")
        .map((p) => ({
          id: p.id,
          name: clip(p.name) || "팩",
          items: (Array.isArray(p.items) ? p.items : [])
            .filter((i) => i && i.type !== "text")
            .slice(0, MAX_ITEMS)
            .map((i) => ({ id: i.id, text: clip(i.text), checked: !!i.checked })),
        }))
        .filter((p) => p.items.length > 0),
    })),
  };
}
