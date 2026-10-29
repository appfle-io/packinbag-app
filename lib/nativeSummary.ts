// 위젯 · 단축어 · 실시간 현황(iOS 네이티브)이 읽는 가방 요약(2026-10-10).
// 웹(앱이 열려 있을 때 lib/v2/nativeBridge.ts)과 서버(app/api/native/summary)가 같은 모양을 만든다.
// 네이티브는 이 JSON을 App Group에 저장해 두고 읽는다(ios/App/PackInBagWidget/Shared/SummaryStore.swift).
// - 체크리스트 팩의 체크 아이템만(메모 · 글 아이템 · 폴더 제외). 메모 본문은 절대 넣지 않는다
// - 크기를 작게: 가방 최근 30개, 팩당 아이템 80개, 글자 80자
import type { Bag, Pack } from "@/lib/types";

const NATIVE_SUMMARY_VERSION = 1;
const MAX_BAGS = 30;
const MAX_ITEMS = 80;
const MAX_TEXT = 80;

export interface NativeSummaryItem {
  id: string;
  text: string;
  checked: boolean;
}

interface NativeSummaryPack {
  id: string;
  name: string;
  items: NativeSummaryItem[];
  // 하단 입력창으로 넣은 "미분류" 팩(10/11). 가방 전체 위젯에서 맨 앞, 단축어 팩 목록에서는 "미분류(기본)"
  inbox?: true;
}

interface NativeSummaryBag {
  id: string;
  name: string;
  travelDate?: string;
  // 내가 고정한 가방(10/11). 위젯 편집 · 단축어 가방 목록에서 "고정한 가방" 묶음
  pinned?: true;
  // 마지막으로 다 싼 때(ISO, 2026-10-18). 북마크 위젯 "다 싼 날". 없으면 키를 넣지 않는다(예전 앱은 모르는 키를 무시)
  lastPackedAt?: string;
  // D-Day 당일을 1일로 세기(Bag.ddayCountTodayAsDayOne, 2026-10-29). 켠 가방만 키를 넣는다 — 당일부터 D+1
  ddayDayOne?: true;
  packs: NativeSummaryPack[];
}

// 요약에 쓰는 내 계정 설정(users/{uid}). 보관함 가방은 빼고, 고정한 가방은 표시한다(10/11)
export interface NativeSummaryProfile {
  archivedBagIds?: string[];
  pinnedBagIds?: string[];
  // 개인 잠금(2026-10-12, lib/v2/privateLock): 잠근 가방은 통째로, 잠근 팩(`bagId/packId`)과 잠근 보관함 팩을 불러온 팩은 뺀다
  lockedBagIds?: string[];
  lockedPackKeys?: string[];
  lockedLibraryIds?: string[];
}

export interface NativeSummary {
  v: number;
  updatedAt: string;
  bags: NativeSummaryBag[];
  // 보관함 팩(1.6 Siri · Spotlight 검색용, 10/12). 앱이 열려 있을 때 웹만 넣는다(lib/v2/nativeBridge).
  // 서버 /api/native/summary는 넣지 않는다(읽기 비용) → 네이티브는 이 키가 없으면 마지막에 받은 목록을 그대로 둔다
  library?: NativeSummaryLibraryPack[];
}

export interface NativeSummaryLibraryPack {
  id: string;
  name: string;
  // checklist = 체크리스트 팩(count = 아이템 수) / note = 메모팩(본문은 넣지 않음)
  kind: "checklist" | "note";
  count?: number;
}

const MAX_LIBRARY = 100;

// 보관함 팩 검색 목록. 휴지통 · 빠른팩은 부르는 쪽에서 뺀다. 폴더 · 개인 잠금한 팩은 여기서 뺀다
export function buildNativeLibrary(packs: Pack[], lockedLibraryIds: string[] = []): NativeSummaryLibraryPack[] {
  const locked = new Set(lockedLibraryIds);
  return packs
    .filter((p) => p && p.type !== "folder" && !p.trashedAt && !locked.has(p.id))
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, MAX_LIBRARY)
    .map((p) =>
      p.kind === "editor"
        ? { id: p.id, name: clip(p.name) || "메모", kind: "note" as const }
        : {
            id: p.id,
            name: clip(p.name) || "팩",
            kind: "checklist" as const,
            count: (Array.isArray(p.items) ? p.items : []).filter((i) => i && i.type !== "text").length,
          },
    );
}

const clip = (s: unknown) => (typeof s === "string" ? s : "").slice(0, MAX_TEXT);

// uid가 소유자이면서 휴지통에 넣은 가방은 뺀다(목록 화면과 같은 기준). 보관함 가방도 뺀다(10/11).
// 고정한 가방이 먼저(30개 안에 꼭 들게), 그다음 최근 체크 순.
// 팩 순서는 가방 화면과 같게 미분류가 맨 앞. 체크 아이템이 없는 팩도 넣는다(단축어 "가방에 추가"에서 고를 수 있게, 10/11)
export function buildNativeSummary(
  bags: Bag[],
  uid: string,
  now: Date = new Date(),
  profile: NativeSummaryProfile = {},
): NativeSummary {
  const archived = new Set([...(profile.archivedBagIds ?? []), ...(profile.lockedBagIds ?? [])]);
  const lockedPacks = new Set(profile.lockedPackKeys ?? []);
  const lockedLibrary = new Set(profile.lockedLibraryIds ?? []);
  const pinned = new Set(profile.pinnedBagIds ?? []);
  const active = bags.filter((b) => !(b.ownerId === uid && b.trashedByOwnerAt) && !archived.has(b.id));
  const recent = [...active]
    .sort(
      (a, b) =>
        Number(pinned.has(b.id)) - Number(pinned.has(a.id)) ||
        (b.lastCheckedAt ?? b.updatedAt ?? "").localeCompare(a.lastCheckedAt ?? a.updatedAt ?? ""),
    )
    .slice(0, MAX_BAGS);
  return {
    v: NATIVE_SUMMARY_VERSION,
    updatedAt: now.toISOString(),
    bags: recent.map((bag) => ({
      id: bag.id,
      name: clip(bag.name) || "가방",
      ...(bag.travelDate ? { travelDate: bag.travelDate } : {}),
      ...(pinned.has(bag.id) ? { pinned: true as const } : {}),
      ...(typeof bag.lastPackedAt === "string" && bag.lastPackedAt ? { lastPackedAt: bag.lastPackedAt } : {}),
      ...(bag.ddayCountTodayAsDayOne === true ? { ddayDayOne: true as const } : {}),
      packs: (Array.isArray(bag.packs) ? bag.packs : [])
        .filter((p) => p && p.kind !== "editor" && p.type !== "folder")
        .filter((p) => !lockedPacks.has(`${bag.id}/${p.id}`) && !(p.linkedLibraryPackId && lockedLibrary.has(p.linkedLibraryPackId)))
        .sort((a, b) => Number(!!b.isInbox) - Number(!!a.isInbox))
        .map((p) => ({
          id: p.id,
          name: clip(p.name) || "팩",
          items: (Array.isArray(p.items) ? p.items : [])
            .filter((i) => i && i.type !== "text")
            .slice(0, MAX_ITEMS)
            .map((i) => ({ id: i.id, text: clip(i.text), checked: !!i.checked })),
          ...(p.isInbox ? { inbox: true as const } : {}),
        }))
        // 빈 미분류는 숨긴다(가방 화면도 빈 미분류는 안 보임)
        .filter((p) => !(p.inbox && p.items.length === 0)),
    })),
  };
}
