// 가방 알림 예약 계획(순수 함수, 2026-10-26). 예약 · 권한 · 누름은 lib/v2/bagReminders.ts.
//
// 세 갈래(native-ios.md NAT-NOTI):
// - 가방 알림: BagReminder의 D-Day · 반복. 본문에 가방 전체 남은 개수 · 내가 맡은 것
// - 팩 알림: BagReminder.packs[packId]. 그 팩만 보고, 누르면 그 팩까지
// - 아이템 마감: 아이템 Item.dueDate(멤버 모두에게 보임) × 내 설정 BagReminder.itemDue(없으면 전날 · 당일 09:00).
//   남이 맡은 아이템은 빼고, 같은 시각 것은 하나로 묶는다. 누르면 그 아이템까지
// 로컬 알림은 예약할 때 문구가 굳는다 → 가방이 바뀌면 AppShell이 다시 예약한다(내용이 같으면 건너뜀).
import type { Bag, BagReminder, Item, Pack, ReminderTimes } from "@/lib/types";

export const DDAY_PRESETS = [7, 3, 1, 0] as const;
export const MAX_CUSTOM_OFFSET = 30;
export const DEFAULT_DDAY_TIME = "09:00";
export const DEFAULT_REPEAT_TIME = "07:30";
// 아이템 마감 알림: 1 = 전날, 0 = 당일
export const ITEM_DUE_PRESETS = [1, 0] as const;
export const DEFAULT_ITEM_DUE: { offsets: number[]; time: string } = { offsets: [1, 0], time: "09:00" };
// 화면 표시 순서(월~일). 값은 JS Date.getDay()와 같다(0 = 일요일)
export const WEEKDAYS: { day: number; label: string }[] = [
  { day: 1, label: "월" },
  { day: 2, label: "화" },
  { day: 3, label: "수" },
  { day: 4, label: "목" },
  { day: 5, label: "금" },
  { day: 6, label: "토" },
  { day: 0, label: "일" },
];
// iOS는 앱당 예약 알림 64개까지
export const MAX_SCHEDULED = 60;
const LOCKED_BAG_TITLE = "잠근 가방";
const NAMES_SHOWN = 2;

export function isTimesEmpty(r: ReminderTimes | undefined | null): boolean {
  return !r || ((r.ddayOffsets?.length ?? 0) === 0 && (r.repeatDays?.length ?? 0) === 0);
}

// 저장할 것이 하나도 없으면 true. itemDue는 "끔"(빈 배열)도 내 선택이라 남긴다
export function isReminderEmpty(r: BagReminder | undefined | null): boolean {
  if (!r) return true;
  if (!isTimesEmpty(r)) return false;
  if (r.packs && Object.values(r.packs).some((p) => !isTimesEmpty(p))) return false;
  return !r.itemDue;
}

export function itemDueSetting(r: BagReminder | undefined | null): { offsets: number[]; time: string } {
  return { offsets: r?.itemDue?.offsets ?? DEFAULT_ITEM_DUE.offsets, time: r?.itemDue?.time ?? DEFAULT_ITEM_DUE.time };
}

function parseTime(time: string | undefined, fallback: string): { h: number; m: number } {
  const [h, m] = (time && /^\d{2}:\d{2}$/.test(time) ? time : fallback).split(":").map(Number);
  return { h, m };
}

function parseDate(ymd: string | undefined): [number, number, number] | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return [y, m, d];
}

// D-Day 알림 칩 · 요약(2026-10-26 C안: "D-3" 대신 "3일 전" — 아이템 마감과 헷갈리지 않게).
// 가방은 여행만이 아니다(어린이집 · 출근 · 기념일 · 태어난 날) → "출발" 같은 여행 말 쓰지 않기(사용자, 10/26)
export function ddayLabel(offset: number): string {
  return offset === 0 ? "당일" : offset === 1 ? "전날" : `${offset}일 전`;
}

function daysLabel(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return "매일";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "평일";
  if (set.size === 2 && set.has(0) && set.has(6)) return "주말";
  return WEEKDAYS.filter((w) => set.has(w.day)).map((w) => w.label).join("");
}

// 시간 묶음 하나의 짧은 요약("D-Day 3일 전·전날 09:00 · 평일 07:30"). 꺼져 있으면 null
export function timesSummary(r: ReminderTimes | undefined | null, hasTravelDate: boolean): string | null {
  if (isTimesEmpty(r)) return null;
  const parts: string[] = [];
  const offsets = [...(r?.ddayOffsets ?? [])].sort((a, b) => b - a);
  if (hasTravelDate && offsets.length > 0) parts.push(`D-Day ${offsets.map(ddayLabel).join("·")} ${r?.ddayTime ?? DEFAULT_DDAY_TIME}`);
  const days = r?.repeatDays ?? [];
  if (days.length > 0) parts.push(`${daysLabel(days)} ${r?.repeatTime ?? DEFAULT_REPEAT_TIME}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// 아이템 마감 요약("마감 전날·당일 09:00"). 꺼져 있으면 null
export function itemDueSummary(r: BagReminder | undefined | null): string | null {
  const due = itemDueSetting(r);
  if (due.offsets.length === 0) return null;
  const labels = [...due.offsets].sort((a, b) => b - a).map((o) => (o === 0 ? "당일" : o === 1 ? "전날" : `${o}일 전`));
  return `마감 ${labels.join("·")} ${due.time}`;
}

// 더보기 줄 오른쪽 요약. 꺼져 있으면 null. bag을 주면 팩 알림 수 · 마감 알림(마감일 있는 아이템이 있을 때)도 붙인다
export function reminderSummary(r: BagReminder | undefined | null, hasTravelDate: boolean, bag?: Bag): string | null {
  const parts: string[] = [];
  const own = timesSummary(r, hasTravelDate);
  if (own) parts.push(own);
  if (bag) {
    const packCount = bag.packs.filter((p) => !isTimesEmpty(r?.packs?.[p.id])).length;
    if (packCount > 0) parts.push(`팩 ${packCount}개`);
    if (itemDueSetting(r).offsets.length > 0 && bag.packs.some((p) => p.items.some((i) => parseDate(i.dueDate)))) parts.push("마감");
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface PlannedNotification {
  bagId: string;
  packId?: string;
  itemId?: string;
  title: string;
  body: string;
  // 한 번만: at / 매주 반복: weekday(0=일)·hour·minute
  at?: Date;
  weekly?: { weekday: number; hour: number; minute: number };
  // 예산(64개) 안에서 가까운 것부터 고르기 위한 다음 울림 시각
  nextFire: number;
}

export interface ReminderLock {
  bagIds?: string[];
  // `${bagId}/${packId}`
  packKeys?: string[];
  // 보관함 팩 id(그 팩을 불러온 가방 속 팩도 잠김)
  libraryIds?: string[];
}

const isChecklist = (p: Pack) => p.kind !== "editor" && p.type !== "folder";
const openChecks = (p: Pack) => p.items.filter((i) => i.type === "check" && !i.checked);
const countChecks = (p: Pack) => p.items.filter((i) => i.type === "check").length;

function names(items: Item[]): string {
  const shown = items.slice(0, NAMES_SHOWN).map((i) => i.text.trim() || "아이템");
  const rest = items.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} 외 ${rest}개` : shown.join(", ");
}

const headOf = (kind: "dday0" | "dday" | "repeat", lead: string) =>
  kind === "dday0" ? "오늘이 D-Day예요" : kind === "repeat" ? "챙길 시간이에요" : lead;

// 가방 알림 본문. packs에서는 같은 시각에 따로 울리는 팩을 미리 뺀다(겹쳐 말하지 않게)
function bagBody(lead: string, packs: Pack[], me: string | undefined, hide: boolean, kind: "dday0" | "dday" | "repeat"): string {
  const lists = packs.filter(isChecklist);
  const total = lists.reduce((n, p) => n + countChecks(p), 0);
  const fallback =
    kind === "dday0"
      ? "오늘이 D-Day예요. 빠진 것 없는지 확인해 보세요"
      : kind === "dday"
        ? `${lead} · 챙길 것을 미리 확인해 보세요`
        : "챙길 시간이에요. 빠진 것 없는지 체크해 보세요";
  if (total === 0) return fallback;
  const left = lists.map((p) => ({ p, open: openChecks(p) })).filter((x) => x.open.length > 0);
  const leftCount = left.reduce((n, x) => n + x.open.length, 0);
  const head = headOf(kind, lead);
  if (leftCount === 0) return kind === "repeat" ? fallback : kind === "dday0" ? "오늘이 D-Day예요 · 다 챙겼어요" : `${lead} · 다 챙겼어요`;
  let body = `${head} · ${leftCount}개 남았어요`;
  if (!hide) {
    const byPack = left.slice(0, 3).map((x) => `${x.p.name || "팩"} ${x.open.length}`);
    body += ` (${byPack.join(" · ")}${left.length > 3 ? ` 외 ${left.length - 3}팩` : ""})`;
  }
  const mine = me ? left.flatMap((x) => x.open.filter((i) => i.assigneeUid === me)) : [];
  if (mine.length > 0) body += hide ? ` · 내가 맡은 것 ${mine.length}개` : ` · 내가 맡은 것: ${names(mine)}`;
  return body;
}

function packBody(lead: string, pack: Pack, hide: boolean, kind: "dday0" | "dday" | "repeat"): string {
  const head = headOf(kind, lead);
  if (!isChecklist(pack)) return kind === "repeat" ? `${pack.name || "메모"} 확인할 시간이에요` : `${head} · 메모를 확인해 보세요`;
  const open = openChecks(pack);
  if (countChecks(pack) === 0) return `${head} · 챙길 것을 확인해 보세요`;
  if (open.length === 0) return kind === "repeat" ? "챙길 시간이에요. 빠진 것 없는지 체크해 보세요" : `${head} · 다 챙겼어요`;
  return hide ? `${head} · ${open.length}개 남았어요` : `${head} · ${open.length}개 남았어요: ${names(open)}`;
}

function weeklyNext(now: Date, weekday: number, h: number, m: number): number {
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  let add = (weekday - now.getDay() + 7) % 7;
  if (add === 0 && next.getTime() <= now.getTime()) add = 7;
  next.setDate(next.getDate() + add);
  return next.getTime();
}

// 시간 묶음 하나 → 울릴 때 목록(D-Day는 출발일이 있을 때만, 지난 시각은 뺌)
function fires(times: ReminderTimes | undefined, travel: [number, number, number] | null, now: Date) {
  const out: { at?: Date; weekly?: PlannedNotification["weekly"]; nextFire: number; key: string; kind: "dday0" | "dday" | "repeat"; lead: string }[] = [];
  if (!times) return out;
  if (travel) {
    const { h, m } = parseTime(times.ddayTime, DEFAULT_DDAY_TIME);
    for (const offset of new Set(times.ddayOffsets ?? [])) {
      if (!Number.isInteger(offset) || offset < 0 || offset > MAX_CUSTOM_OFFSET) continue;
      const at = new Date(travel[0], travel[1] - 1, travel[2] - offset, h, m, 0, 0);
      if (at.getTime() <= now.getTime()) continue;
      out.push({ at, nextFire: at.getTime(), key: `at:${at.getTime()}`, kind: offset === 0 ? "dday0" : "dday", lead: `D-${offset}` });
    }
  }
  const { h, m } = parseTime(times.repeatTime, DEFAULT_REPEAT_TIME);
  for (const weekday of new Set(times.repeatDays ?? [])) {
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
    out.push({ weekly: { weekday, hour: h, minute: m }, nextFire: weeklyNext(now, weekday, h, m), key: `wk:${weekday}:${h}:${m}`, kind: "repeat", lead: "" });
  }
  return out;
}

// 가방 목록 + 내 알림 설정 → 예약할 알림 목록(가까운 순, 최대 MAX_SCHEDULED개)
export function planBagNotifications(
  bags: Bag[],
  reminders: Record<string, BagReminder> | undefined,
  now: Date = new Date(),
  lock: ReminderLock = {},
  me?: string,
): PlannedNotification[] {
  const lockedBags = new Set(lock.bagIds ?? []);
  const lockedPacks = new Set(lock.packKeys ?? []);
  const lockedLibrary = new Set(lock.libraryIds ?? []);
  const out: PlannedNotification[] = [];
  for (const bag of bags) {
    const r = reminders?.[bag.id];
    const bagHidden = lockedBags.has(bag.id);
    const bagName = bagHidden ? LOCKED_BAG_TITLE : bag.name || "가방";
    const packHidden = (p: Pack) => bagHidden || lockedPacks.has(`${bag.id}/${p.id}`) || (!!p.linkedLibraryPackId && lockedLibrary.has(p.linkedLibraryPackId));
    const packTitle = (p: Pack) => (packHidden(p) ? bagName : `${bagName} · ${p.name || "팩"}`);
    const travel = parseDate(bag.travelDate);

    // 팩 알림(먼저 - 같은 시각의 가방 알림에서 그 팩을 빼려고)
    const packFireKeys = new Map<string, Set<string>>();
    for (const pack of bag.packs) {
      const times = r?.packs?.[pack.id];
      if (isTimesEmpty(times) || pack.type === "folder") continue;
      const hide = packHidden(pack);
      for (const f of fires(times, travel, now)) {
        if (!packFireKeys.has(f.key)) packFireKeys.set(f.key, new Set());
        packFireKeys.get(f.key)!.add(pack.id);
        out.push({
          bagId: bag.id,
          packId: pack.id,
          title: packTitle(pack),
          body: packBody(f.lead, pack, hide, f.kind),
          at: f.at,
          weekly: f.weekly,
          nextFire: f.nextFire,
        });
      }
    }

    // 가방 알림
    for (const f of fires(r, travel, now)) {
      const skip = packFireKeys.get(f.key);
      const packs = skip ? bag.packs.filter((p) => !skip.has(p.id)) : bag.packs;
      out.push({ bagId: bag.id, title: bagName, body: bagBody(f.lead, packs, me, bagHidden, f.kind), at: f.at, weekly: f.weekly, nextFire: f.nextFire });
    }

    // 아이템 마감
    const due = itemDueSetting(r);
    if (due.offsets.length === 0) continue;
    const { h, m } = parseTime(due.time, DEFAULT_ITEM_DUE.time);
    const groups = new Map<number, { offset: number; entries: { pack: Pack; item: Item }[] }>();
    for (const pack of bag.packs) {
      if (!isChecklist(pack)) continue;
      for (const item of pack.items) {
        const d = parseDate(item.dueDate);
        if (!d || item.type !== "check" || item.checked) continue;
        if (item.assigneeUid && item.assigneeUid !== me) continue;
        for (const offset of new Set(due.offsets)) {
          if (!Number.isInteger(offset) || offset < 0 || offset > MAX_CUSTOM_OFFSET) continue;
          const at = new Date(d[0], d[1] - 1, d[2] - offset, h, m, 0, 0);
          if (at.getTime() <= now.getTime()) continue;
          const g = groups.get(at.getTime()) ?? { offset, entries: [] };
          g.entries.push({ pack, item });
          groups.set(at.getTime(), g);
        }
      }
    }
    for (const [time, g] of groups) {
      const lead = g.offset === 0 ? "오늘까지" : g.offset === 1 ? "내일까지" : `${g.offset}일 뒤까지`;
      const one = g.entries.length === 1 ? g.entries[0] : null;
      const samePack = g.entries.every((e) => e.pack.id === g.entries[0].pack.id) ? g.entries[0].pack : null;
      const hide = g.entries.some((e) => packHidden(e.pack));
      out.push({
        bagId: bag.id,
        packId: samePack?.id,
        itemId: one?.item.id,
        title: samePack ? packTitle(samePack) : bagName,
        body: hide
          ? `${lead} 챙길 것 ${g.entries.length}개`
          : one
            ? `${lead}: ${one.item.text.trim() || "아이템"}`
            : `${lead} ${g.entries.length}개: ${names(g.entries.map((e) => e.item))}`,
        at: new Date(time),
        nextFire: time,
      });
    }
  }
  return out.sort((a, b) => a.nextFire - b.nextFire).slice(0, MAX_SCHEDULED);
}

// 저장 전에 정리: 빈 팩 설정 · 사라진 팩을 빼고, 정렬하고, 시간이 필요 없는 묶음은 시간을 뺀다
export function normalizeTimes(t: ReminderTimes | undefined): ReminderTimes | undefined {
  const offsets = t?.ddayOffsets ?? [];
  const days = t?.repeatDays ?? [];
  if (offsets.length === 0 && days.length === 0) return undefined;
  const out: ReminderTimes = {};
  if (offsets.length) {
    out.ddayOffsets = [...new Set(offsets)].sort((a, b) => b - a);
    out.ddayTime = t?.ddayTime ?? DEFAULT_DDAY_TIME;
  }
  if (days.length) {
    out.repeatDays = [...new Set(days)].sort();
    out.repeatTime = t?.repeatTime ?? DEFAULT_REPEAT_TIME;
  }
  return out;
}

export function normalizeReminder(r: BagReminder, packIds: string[]): BagReminder | null {
  const out: BagReminder = { ...(normalizeTimes(r) ?? {}) };
  const packs: Record<string, ReminderTimes> = {};
  for (const id of packIds) {
    const t = normalizeTimes(r.packs?.[id]);
    if (t) packs[id] = t;
  }
  if (Object.keys(packs).length) out.packs = packs;
  if (r.itemDue) {
    const offsets = [...new Set(r.itemDue.offsets)].sort((a, b) => b - a);
    const same = offsets.join() === DEFAULT_ITEM_DUE.offsets.join() && (r.itemDue.time ?? DEFAULT_ITEM_DUE.time) === DEFAULT_ITEM_DUE.time;
    // 기본값과 같으면 저장하지 않는다(없음 = 기본)
    if (!same) out.itemDue = { offsets, time: r.itemDue.time ?? DEFAULT_ITEM_DUE.time };
  }
  return isReminderEmpty(out) ? null : out;
}
