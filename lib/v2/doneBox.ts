// 가방 완료함(2026-11-01, spec/bag.md BAG-DONE).
// 챙긴 체크 아이템을 가방 맨 아래 "완료함"으로 모아 보여 준다. 실제로 옮기지 않고 Item.checkedAt과
// 가방 doneBoxMode로 화면에서만 나눈다 - 체크를 풀면 원래 팩 자리로, 진행률 · 다시 싸기 · 위젯은 그대로.
// 완료함 아이템은 자동으로 지우지 않는다(사용자가 완료함에서 선택 · 전체 삭제).
import type { Bag, Item, Pack } from "@/lib/types";

export type DoneBoxMode = NonNullable<Bag["doneBoxMode"]>;

export const DONE_BOX_MODES: { id: DoneBoxMode; label: string; sub?: string; line: string }[] = [
  { id: "off", label: "옮기지 않음", sub: "완료함을 끄고 팩 안에 그대로 둬요", line: "꺼져 있어요" },
  { id: "now", label: "바로", sub: "체크하면 곧바로", line: "체크하면 바로 옮겨요" },
  { id: "hour", label: "1시간 뒤", line: "1시간 뒤에 옮겨요" },
  { id: "nextday", label: "다음 날", sub: "새벽 4시에 정리", line: "다음 날 옮겨요" },
  { id: "dday", label: "D-Day 다음 날", sub: "D-Day를 정한 가방만", line: "D-Day 다음 날 옮겨요" },
  { id: "week", label: "7일 뒤", line: "7일 뒤에 옮겨요" },
];

// 켤 때 처음 고르는 값(설정 시트에서 "기본"으로 표시)
export const DEFAULT_DONE_BOX_MODE: DoneBoxMode = "nextday";

const HOUR = 3_600_000;
// "다음 날"은 자정이 아니라 새벽 4시 - 밤늦게 챙긴 것이 몇 분 만에 넘어가지 않게
const DAY_START_HOUR = 4;

export function doneBoxModeOf(bag: Pick<Bag, "doneBoxMode" | "travelDate">): DoneBoxMode {
  const m = bag.doneBoxMode ?? "off";
  // D-Day를 지운 가방은 "다음 날"로
  if (m === "dday" && !parseDate(bag.travelDate)) return "nextday";
  return m;
}

function parseDate(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function nextDayStart(base: Date): number {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, DAY_START_HOUR).getTime();
}

// 체크한 시각. 없으면(11/1 전에 체크했거나 예전 앱 · 위젯이 체크) 오래전에 챙긴 것으로 본다 - 켜면 바로 완료함에.
// 가방 lastCheckedAt으로 대신하면 누가 체크할 때마다 값이 바뀌어 순서가 뒤섞이고 옮기는 때가 계속 밀린다
function checkedTime(item: Item): number {
  const t = item.checkedAt ? Date.parse(item.checkedAt) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

// 이 아이템이 완료함으로 넘어가는 시각(ms). 완료함을 안 쓰거나 안 챙긴 아이템은 null
export function doneBoxMoveAt(item: Item, bag: Bag, now = Date.now()): number | null {
  if (!item.checked) return null;
  const mode = doneBoxModeOf(bag);
  if (mode === "off") return null;
  const t = checkedTime(item);
  switch (mode) {
    case "now":
      return t;
    case "hour":
      return t + HOUR;
    case "nextday":
      return nextDayStart(new Date(t));
    case "dday":
      return Math.max(t, nextDayStart(parseDate(bag.travelDate) ?? new Date(now)));
    case "week":
      return t + 7 * 24 * HOUR;
  }
}

export interface DoneBoxEntry {
  packId: string;
  packName: string;
  item: Item;
}

// 지금 완료함에 있는 아이템(최근에 챙긴 것 먼저)과, 다음에 누가 넘어가는 시각(화면 타이머용, 없으면 null).
// now는 화면이 타이머로 갱신하는 시각이라 조금 늦을 수 있다 - "바로"는 시각과 상관없이 바로 넣는다.
// skipPack: 개인 잠금으로 가린 팩처럼 완료함에도 보이면 안 되는 팩
export function splitDoneBox(
  bag: Bag,
  now = Date.now(),
  skipPack?: (pack: Pack) => boolean,
): { entries: DoneBoxEntry[]; ids: Set<string>; nextChangeAt: number | null } {
  const found: (DoneBoxEntry & { t: number })[] = [];
  let nextChangeAt: number | null = null;
  const instant = doneBoxModeOf(bag) === "now";
  for (const p of bag.packs) {
    if (p.kind === "editor" || p.type === "folder" || skipPack?.(p)) continue;
    for (const item of p.items) {
      const at = doneBoxMoveAt(item, bag, now);
      if (at === null) continue;
      if (instant || at <= now) found.push({ packId: p.id, packName: p.name, item, t: checkedTime(item) });
      else if (nextChangeAt === null || at < nextChangeAt) nextChangeAt = at;
    }
  }
  found.sort((a, b) => b.t - a.t);
  return {
    entries: found.map(({ packId, packName, item }) => ({ packId, packName, item })),
    ids: new Set(found.map((e) => e.item.id)),
    nextChangeAt,
  };
}

// 체크 상태가 바뀐 아이템에 checkedAt을 맞춘다: 새로 체크했으면 찍고(이미 값이 있으면 그대로 - 되돌리기용),
// 풀었으면 지운다. 바뀐 게 없으면 next를 그대로 돌려준다(쓸데없이 다시 그리지 않게)
export function stampCheckedAt(prev: Bag, next: Bag, nowIso: string): Bag {
  if (prev.packs === next.packs) return next;
  const wasChecked = new Set<string>();
  for (const p of prev.packs) for (const i of p.items) if (i.checked) wasChecked.add(i.id);
  let changed = false;
  const packs = next.packs.map((p) => {
    let packChanged = false;
    const items = p.items.map((i) => {
      if (i.checked) {
        if (i.checkedAt || wasChecked.has(i.id)) return i;
        packChanged = true;
        return { ...i, checkedAt: nowIso };
      }
      if (i.checkedAt === undefined) return i;
      packChanged = true;
      const { checkedAt: _drop, ...rest } = i;
      void _drop;
      return rest;
    });
    if (!packChanged) return p;
    changed = true;
    return { ...p, items };
  });
  return changed ? { ...next, packs } : next;
}

// 완료함으로 넘어간 아이템을 뺀 팩 목록(11/12 사용자: 완료함 것은 더 볼 게 아니라 백업으로 두는 것 →
// 진행률 · 전체 개수 · 팩 머리줄 · 홈 카드 · 위젯 · 잠금화면 숫자에서 모두 뺀다. 풀면 다시 셈).
// keep: 화면이 잠깐 제자리에 둔 아이템(BAG-DONE-04 "바로" 0.8초)처럼 아직 세야 하는 것
export function packsWithoutDoneBox(bag: Bag, packs: Pack[] = bag.packs, now = Date.now(), keep?: Set<string>): Pack[] {
  const mode = doneBoxModeOf(bag);
  if (mode === "off") return packs;
  let changed = false;
  const out = packs.map((p) => {
    if (p.kind === "editor" || p.type === "folder" || !Array.isArray(p.items)) return p;
    const items = p.items.filter((i) => {
      if (!i || keep?.has(i.id)) return true;
      const at = doneBoxMoveAt(i, bag, now);
      return at === null || (mode !== "now" && at > now);
    });
    if (items.length === p.items.length) return p;
    changed = true;
    return { ...p, items };
  });
  return changed ? out : packs;
}
