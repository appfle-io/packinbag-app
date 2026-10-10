// 가방 알림(D-Day · 반복) - iOS 기기 로컬 알림(2026-10-10, 1.5 빌드부터).
//
// - 설정은 사람마다 다르므로 가방 문서가 아니라 내 계정(UserProfile.bagReminders[bagId])에 둔다.
//   같은 계정의 다른 아이폰·아이패드도 각자 이 값을 보고 예약한다. 가방 문서의 옛 Bag.reminderOffsets는 쓰지 않는다.
// - 서버 없이 기기가 예약한다. 다른 멤버가 D-Day를 바꾸면 이 기기에서 앱을 다음에 열 때 다시 맞춰진다.
// - iOS는 앱당 예약 알림이 64개까지라, 가까운 것부터 MAX_SCHEDULED개만 예약한다(반복 알림은 요일마다 1개).
// - 웹·PC·플러그인이 없는 옛 앱(스토어 1.3)에서는 아무것도 하지 않는다(isLocalNotificationsAvailable).
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Bag, BagReminder } from "@/lib/types";

export const DDAY_PRESETS = [7, 3, 1, 0] as const;
export const MAX_CUSTOM_OFFSET = 30;
export const DEFAULT_DDAY_TIME = "09:00";
export const DEFAULT_REPEAT_TIME = "07:30";
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
const MAX_SCHEDULED = 60;

// ---- 순수 함수 ---------------------------------------------------------------

export function isReminderEmpty(r: BagReminder | undefined | null): boolean {
  return !r || ((r.ddayOffsets?.length ?? 0) === 0 && (r.repeatDays?.length ?? 0) === 0);
}

function parseTime(time: string | undefined, fallback: string): { h: number; m: number } {
  const [h, m] = (time && /^\d{2}:\d{2}$/.test(time) ? time : fallback).split(":").map(Number);
  return { h, m };
}

export function ddayLabel(offset: number): string {
  return offset === 0 ? "당일" : `D-${offset}`;
}

// 더보기 줄 오른쪽에 붙는 짧은 요약. 꺼져 있으면 null
export function reminderSummary(r: BagReminder | undefined | null, hasTravelDate: boolean): string | null {
  if (isReminderEmpty(r)) return null;
  const parts: string[] = [];
  const offsets = [...(r?.ddayOffsets ?? [])].sort((a, b) => b - a);
  if (hasTravelDate && offsets.length > 0) parts.push(offsets.map(ddayLabel).join("·"));
  const days = r?.repeatDays ?? [];
  if (days.length > 0) {
    const set = new Set(days);
    const label =
      set.size === 7
        ? "매일"
        : set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))
          ? "평일"
          : set.size === 2 && set.has(0) && set.has(6)
            ? "주말"
            : WEEKDAYS.filter((w) => set.has(w.day)).map((w) => w.label).join("");
    parts.push(`${label} ${r?.repeatTime ?? DEFAULT_REPEAT_TIME}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface PlannedNotification {
  bagId: string;
  title: string;
  body: string;
  // 한 번만: at / 매주 반복: weekday(0=일)·hour·minute
  at?: Date;
  weekly?: { weekday: number; hour: number; minute: number };
  // 예산(64개) 안에서 가까운 것부터 고르기 위한 다음 울림 시각
  nextFire: number;
}

// 가방 목록 + 내 알림 설정 → 예약할 알림 목록(가까운 순, 최대 MAX_SCHEDULED개)
export function planBagNotifications(
  bags: Bag[],
  reminders: Record<string, BagReminder> | undefined,
  now: Date = new Date(),
): PlannedNotification[] {
  if (!reminders) return [];
  const out: PlannedNotification[] = [];
  for (const bag of bags) {
    const r = reminders[bag.id];
    if (isReminderEmpty(r)) continue;
    const title = bag.name || "가방";

    if (bag.travelDate && /^\d{4}-\d{2}-\d{2}$/.test(bag.travelDate)) {
      const [y, mo, d] = bag.travelDate.split("-").map(Number);
      const { h, m } = parseTime(r!.ddayTime, DEFAULT_DDAY_TIME);
      for (const offset of new Set(r!.ddayOffsets ?? [])) {
        if (!Number.isInteger(offset) || offset < 0 || offset > MAX_CUSTOM_OFFSET) continue;
        const at = new Date(y, mo - 1, d - offset, h, m, 0, 0);
        if (at.getTime() <= now.getTime()) continue;
        out.push({
          bagId: bag.id,
          title,
          body: offset === 0 ? "오늘이 D-Day예요. 빠진 것 없는지 확인해 보세요" : `D-${offset} · 챙길 것을 미리 확인해 보세요`,
          at,
          nextFire: at.getTime(),
        });
      }
    }

    const { h, m } = parseTime(r!.repeatTime, DEFAULT_REPEAT_TIME);
    for (const weekday of new Set(r!.repeatDays ?? [])) {
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
      const next = new Date(now);
      next.setHours(h, m, 0, 0);
      let add = (weekday - now.getDay() + 7) % 7;
      if (add === 0 && next.getTime() <= now.getTime()) add = 7;
      next.setDate(next.getDate() + add);
      out.push({
        bagId: bag.id,
        title,
        body: "챙길 시간이에요. 체크하고 출발하세요",
        weekly: { weekday, hour: h, minute: m },
        nextFire: next.getTime(),
      });
    }
  }
  return out.sort((a, b) => a.nextFire - b.nextFire).slice(0, MAX_SCHEDULED);
}

// ---- iOS 로컬 알림 플러그인(@capacitor/local-notifications) ----------------------
// 패키지를 직접 import하지 않고 registerPlugin으로 부른다(lib/haptics.ts와 같은 방식, 웹 구현을 싣지 않으려고)

type PermissionState = "granted" | "denied" | "prompt" | "prompt-with-rationale";

interface LocalNotificationSchema {
  id: number;
  title: string;
  body: string;
  schedule?: { at?: Date; on?: { weekday?: number; hour?: number; minute?: number }; allowWhileIdle?: boolean };
  extra?: Record<string, unknown>;
}

interface LocalNotificationsPlugin {
  checkPermissions(): Promise<{ display: PermissionState }>;
  requestPermissions(): Promise<{ display: PermissionState }>;
  schedule(options: { notifications: LocalNotificationSchema[] }): Promise<unknown>;
  getPending(): Promise<{ notifications: { id: number; extra?: Record<string, unknown> }[] }>;
  cancel(options: { notifications: { id: number }[] }): Promise<void>;
  addListener(
    event: "localNotificationActionPerformed",
    cb: (action: { notification: { extra?: Record<string, unknown> } }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const LocalNotifications = registerPlugin<LocalNotificationsPlugin>("LocalNotifications");

export function isLocalNotificationsAvailable(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications");
}

export async function getNotificationPermission(): Promise<PermissionState | null> {
  if (!isLocalNotificationsAvailable()) return null;
  try {
    return (await LocalNotifications.checkPermissions()).display;
  } catch {
    return null;
  }
}

// 알림을 처음 켤 때만 묻는다(앱 시작 때 묻지 않는다)
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isLocalNotificationsAvailable()) return false;
  try {
    const now = (await LocalNotifications.checkPermissions()).display;
    if (now === "granted") return true;
    if (now === "denied") return false;
    return (await LocalNotifications.requestPermissions()).display === "granted";
  } catch {
    return false;
  }
}

const KIND = "pib-bag-reminder";
let syncing: Promise<void> | null = null;
let lastSignature = "";

// 팩인백이 예약한 가방 알림을 모두 지우고 지금 설정대로 다시 예약한다. 권한이 없으면 지우기만 한다
export async function syncBagNotifications(bags: Bag[], reminders: Record<string, BagReminder> | undefined) {
  if (!isLocalNotificationsAvailable()) return;
  const plan = planBagNotifications(bags, reminders);
  // 같은 내용이면 다시 예약하지 않는다(가방 체크할 때마다 bags가 바뀌어 불린다)
  const signature = JSON.stringify(plan.map((p) => [p.bagId, p.title, p.body, p.at?.getTime(), p.weekly]));
  if (signature === lastSignature) return;
  const run = async () => {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => n.extra?.kind === KIND).map((n) => ({ id: n.id }));
    if (ours.length > 0) await LocalNotifications.cancel({ notifications: ours });
    const granted = (await LocalNotifications.checkPermissions()).display === "granted";
    if (granted && plan.length > 0) {
      await LocalNotifications.schedule({
        notifications: plan.map((p, i) => ({
          id: 1000 + i,
          title: p.title,
          body: p.body,
          // Capacitor의 weekday는 1 = 일요일 ~ 7 = 토요일
          schedule: p.at
            ? { at: p.at, allowWhileIdle: true }
            : { on: { weekday: p.weekly!.weekday + 1, hour: p.weekly!.hour, minute: p.weekly!.minute } },
          extra: { kind: KIND, bagId: p.bagId },
        })),
      });
    }
    lastSignature = granted ? signature : "";
  };
  // 앞의 예약이 끝난 뒤에 이어서(겹쳐 지우고 예약하지 않게)
  const prev = syncing ?? Promise.resolve();
  syncing = prev.then(run).catch((err) => {
    lastSignature = "";
    console.error("[팩인백] 알림 예약 실패:", err);
  });
  await syncing;
}

// 알림을 눌러 앱이 열렸을 때 그 가방 id를 알려 준다. 앱이 꺼져 있다가 열린 경우도 플러그인이 이벤트를 보관했다가 준다
export function onBagNotificationTap(cb: (bagId: string) => void): () => void {
  if (!isLocalNotificationsAvailable()) return () => {};
  let handle: { remove: () => Promise<void> } | null = null;
  let removed = false;
  LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
    const extra = action.notification?.extra;
    if (extra?.kind === KIND && typeof extra.bagId === "string") cb(extra.bagId);
  })
    .then((h) => {
      if (removed) h.remove().catch(() => {});
      else handle = h;
    })
    .catch(() => {});
  return () => {
    removed = true;
    handle?.remove().catch(() => {});
  };
}
