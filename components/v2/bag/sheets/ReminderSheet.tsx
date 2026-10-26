"use client";

import { useState } from "react";
import { IconChevronLeft, IconChevronRight, IconPlus } from "@tabler/icons-react";
import type { Bag, BagReminder, ReminderTimes } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, Chip, SectionHeader, Sheet, Toggle, cx } from "@/components/v2/ui";
import { bagPushView, showsBagPush, type PushKind } from "@/lib/v2/serverPush";
import {
  DDAY_PRESETS,
  DEFAULT_DDAY_TIME,
  DEFAULT_REPEAT_TIME,
  ITEM_DUE_PRESETS,
  MAX_CUSTOM_OFFSET,
  WEEKDAYS,
  ddayLabel,
  ensureNotificationPermission,
  itemDueSetting,
  normalizeReminder,
  timesSummary,
} from "@/lib/v2/bagReminders";
import { notificationSettingsPath } from "@/lib/v2/platform";

// 가방 더보기 > 알림 · 팩 길게 누르기 > 알림(initialPackId).
// - 가방: D-Day 알림(D-7·D-3·D-1·당일 + 직접 입력)과 요일 반복 알림
// - 팩마다 따로(2026-10-26): 줄을 누르면 같은 D-Day · 반복 칸을 그 팩용으로
// - 아이템 마감(2026-10-26): 마감일이 있는 아이템을 전날 · 당일 몇 시에 알릴지(없으면 기본 전날 · 당일 09:00)
// 내 계정에만 저장되고(다른 멤버에게는 영향 없음) 이 아이폰·아이패드가 예약한다(AppShell → syncBagNotifications).
// 시트를 닫을 때 한 번만 저장한다. 알림 권한은 처음 켤 때 묻는다.
export function ReminderSheet({
  open,
  onClose,
  bag,
  initialPackId,
}: {
  open: boolean;
  onClose: () => void;
  bag: Bag;
  initialPackId?: string | null;
}) {
  const { user, profile, updateBagReminder, setBagPushMuted, setBagPushOff, isOfflineMode } = useAuth();
  const { show } = useToast();
  const saved = profile?.bagReminders?.[bag.id];
  const [draft, setDraft] = useState<BagReminder>(saved ?? {});
  const [draftFor, setDraftFor] = useState<string | null>(open ? `${bag.id}|${initialPackId ?? ""}` : null);
  // null = 가방 알림, 값 = 그 팩 알림
  const [view, setView] = useState<string | null>(open ? initialPackId ?? null : null);
  const [denied, setDenied] = useState(false);
  const [asked, setAsked] = useState(false);

  // 열릴 때마다(또는 다른 가방으로 바뀌면) 저장된 값으로 다시 시작
  const key = open ? `${bag.id}|${initialPackId ?? ""}` : null;
  if (key !== draftFor) {
    setDraftFor(key);
    if (key) {
      setDraft(saved ?? {});
      setView(initialPackId ?? null);
      setAsked(false);
    }
  }

  const packs = bag.packs.filter((p) => p.type !== "folder");
  const viewPack = view ? packs.find((p) => p.id === view) ?? null : null;

  // 처음 켜는 순간(누름 안에서) 권한을 묻는다
  const askPermissionOnce = () => {
    if (asked) return;
    setAsked(true);
    ensureNotificationPermission().then((ok) => setDenied(!ok));
  };
  const update = (next: BagReminder) => {
    if (normalizeReminder(next, packs.map((p) => p.id))) askPermissionOnce();
    setDraft(next);
  };
  const setBagTimes = (t: ReminderTimes) => update({ ...draft, ...t });
  const setPackTimes = (packId: string, t: ReminderTimes) => update({ ...draft, packs: { ...(draft.packs ?? {}), [packId]: t } });

  const close = () => {
    const ids = packs.map((p) => p.id);
    const next = normalizeReminder(draft, ids);
    const before = saved ? normalizeReminder(saved, ids) : null;
    if (JSON.stringify(next) !== JSON.stringify(before) || (!next && saved)) {
      updateBagReminder(bag.id, next)
        .then(() => show(next ? "알림을 맞춰 두었어요" : "D-Day · 반복 알림을 껐어요"))
        .catch((err) => {
          console.error("[팩인백] 알림 설정 저장 실패:", err);
          show("알림 설정을 저장하지 못했어요");
        });
    }
    onClose();
  };

  // 함께 쓰는 가방의 서버 푸시(2026-10-11). 누르면 바로 저장한다(닫을 때가 아니라).
  // "이 가방 소식 받기" + 켜져 있을 때만 종류별. 설정 > 알림에서 끈 종류는 흐리게(여기서는 못 켠다)
  const showPush = showsBagPush(bag, isOfflineMode);
  const push = bagPushView(profile, bag, user?.uid);
  const saveFailed = () => show("설정을 저장하지 못했어요");
  const toggleMaster = (on: boolean) => {
    const tasks: Promise<void>[] = [];
    if (push.muted === on) tasks.push(setBagPushMuted(bag.id, !on));
    // 종류를 모두 꺼 두었던 가방을 다시 켜면 전부 다시 켠다
    if (on && push.onCount === 0 && push.off.length > 0) tasks.push(setBagPushOff(bag.id, []));
    Promise.all(tasks)
      .then(() => show(on ? "이 가방 소식을 다시 받아요" : "이 가방 소식 알림을 껐어요. 여기서 다시 켤 수 있어요"))
      .catch(saveFailed);
  };
  const toggleKind = (kind: PushKind, on: boolean) => {
    const next = on ? push.off.filter((k) => k !== kind) : [...push.off, kind];
    setBagPushOff(bag.id, next).catch(saveFailed);
  };
  const masterDescription =
    push.usable === 0
      ? "설정 > 알림에서 모두 꺼 두었어요"
      : !push.master
        ? "꺼져 있어요 · 켜면 아래에서 종류를 골라요"
        : push.onCount === push.usable
          ? "모두 받아요"
          : `${push.usable}개 중 ${push.onCount}개 받아요`;

  const due = itemDueSetting(draft);
  const dueCount = packs.reduce((n, p) => n + p.items.filter((i) => i.type === "check" && i.dueDate && !i.checked).length, 0);
  const toggleDue = (o: number) =>
    update({ ...draft, itemDue: { offsets: due.offsets.includes(o) ? due.offsets.filter((x) => x !== o) : [...due.offsets, o], time: due.time } });

  const title = viewPack ? `${viewPack.name || "팩"} 알림` : "알림";

  return (
    <Sheet open={open} onClose={close} title={title}>
      <div className="flex flex-col gap-6">
        {denied && (
          <p className="m-0 rounded-card bg-fill px-4 py-3 text-caption text-sub">
            알림이 꺼져 있어요. {notificationSettingsPath()}에서 허용해 주세요.
          </p>
        )}

        {viewPack ? (
          <>
            <button
              type="button"
              onClick={() => setView(null)}
              className="-mt-2 flex items-center gap-1 self-start bg-transparent text-caption font-semibold text-sub"
            >
              <IconChevronLeft size={16} stroke={2} aria-hidden="true" />
              가방 알림
            </button>
            <TimesEditor
              value={draft.packs?.[viewPack.id] ?? {}}
              onChange={(t) => setPackTimes(viewPack.id, t)}
              hasTravelDate={!!bag.travelDate}
              target="팩"
            />
            <p className="m-0 text-micro text-faint">
              이 팩에 남은 것만 알려 드리고, 누르면 이 팩으로 바로 가요. 가방 알림과 같은 시각이면 가방 알림에서는 이 팩을 빼요.
            </p>
          </>
        ) : (
          <>
            {showPush && (
              <section className="flex flex-col gap-2">
                <SectionHeader>함께 쓰는 사람 소식</SectionHeader>
                <div className="flex flex-col rounded-card border border-line bg-card px-4">
                  <Toggle
                    checked={push.master}
                    onChange={toggleMaster}
                    disabled={push.usable === 0}
                    label="이 가방 소식 받기"
                    description={masterDescription}
                  />
                  {push.master &&
                    push.kinds.map((k) => (
                      <Toggle
                        key={k.kind}
                        checked={k.on}
                        onChange={(on) => toggleKind(k.kind, on)}
                        disabled={k.locked}
                        label={k.label}
                        description={k.locked ? "설정 > 알림에서 꺼 두었어요" : k.description}
                        className="border-t border-line pl-3"
                      />
                    ))}
                </div>
              </section>
            )}

            <TimesEditor value={draft} onChange={setBagTimes} hasTravelDate={!!bag.travelDate} target="가방" />

            {packs.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionHeader>팩마다 따로</SectionHeader>
                <div className="flex flex-col rounded-card border border-line bg-card px-4">
                  {packs.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setView(p.id)}
                      className={cx(
                        "flex min-h-13 w-full items-center gap-3 bg-transparent text-left text-body",
                        i > 0 && "border-t border-line",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{p.name || "팩"}</span>
                      <span className="truncate text-caption text-sub">
                        {timesSummary(draft.packs?.[p.id], !!bag.travelDate) ?? "꺼짐"}
                      </span>
                      <IconChevronRight size={18} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="flex flex-col gap-3">
              <SectionHeader>아이템 마감 알림</SectionHeader>
              <div className="flex flex-wrap gap-2">
                {ITEM_DUE_PRESETS.map((o) => (
                  <Chip key={o} label={o === 0 ? "당일" : "전날"} selected={due.offsets.includes(o)} onClick={() => toggleDue(o)} />
                ))}
              </div>
              {due.offsets.length > 0 && (
                <TimeRow
                  label="아이템 마감 알림 시간"
                  value={due.time}
                  onChange={(time) => setDraft({ ...draft, itemDue: { offsets: due.offsets, time } })}
                />
              )}
              <p className="m-0 text-caption text-sub">
                {dueCount > 0 ? `마감일이 있는 아이템 ${dueCount}개` : "아이템을 길게 눌러 마감일을 정할 수 있어요"}
                {" · "}다른 사람이 맡은 아이템은 알리지 않아요
              </p>
            </section>
          </>
        )}

        <p className="m-0 text-micro text-faint">
          내 계정에만 저장돼요. 함께 쓰는 멤버의 알림은 바뀌지 않아요. 같은 계정으로 로그인한 휴대폰 · 태블릿 앱에서 받아요.
        </p>
      </div>
    </Sheet>
  );
}

function TimeRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex min-h-13 items-center justify-between border-b border-line">
      <span className="text-body">받을 시간</span>
      <input
        type="time"
        aria-label={label}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-10 rounded-field border border-line bg-card px-2 text-caption outline-none"
      />
    </div>
  );
}

// D-Day · 반복 칸(가방과 팩이 같이 쓴다)
function TimesEditor({
  value,
  onChange,
  hasTravelDate,
  target,
}: {
  value: ReminderTimes;
  onChange: (next: ReminderTimes) => void;
  hasTravelDate: boolean;
  target: "가방" | "팩";
}) {
  const { show } = useToast();
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const offsets = value.ddayOffsets ?? [];
  const days = value.repeatDays ?? [];
  const customOffsets = offsets.filter((o) => !(DDAY_PRESETS as readonly number[]).includes(o)).sort((a, b) => b - a);
  const pick = (next: Partial<ReminderTimes>) =>
    onChange({ ddayOffsets: offsets, ddayTime: value.ddayTime, repeatDays: days, repeatTime: value.repeatTime, ...next });

  const toggleOffset = (o: number) => pick({ ddayOffsets: offsets.includes(o) ? offsets.filter((x) => x !== o) : [...offsets, o] });
  const toggleDay = (d: number) => pick({ repeatDays: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });

  const addCustom = () => {
    const n = Number(customValue);
    if (!Number.isInteger(n) || n < 1 || n > MAX_CUSTOM_OFFSET) {
      show(`1~${MAX_CUSTOM_OFFSET}일 전 사이로 입력해 주세요`);
      return;
    }
    if (!offsets.includes(n)) pick({ ddayOffsets: [...offsets, n] });
    setCustomOpen(false);
    setCustomValue("");
  };

  const weekdaySet = new Set(days);
  const isWeekdays = weekdaySet.size === 5 && [1, 2, 3, 4, 5].every((d) => weekdaySet.has(d));
  const isEveryday = weekdaySet.size === 7;

  return (
    <>
      <section className="flex flex-col gap-3">
        <SectionHeader>D-Day 알림</SectionHeader>
        {hasTravelDate ? (
          <>
            <div className="flex flex-wrap gap-2">
              {DDAY_PRESETS.map((o) => (
                <Chip key={o} label={ddayLabel(o)} selected={offsets.includes(o)} onClick={() => toggleOffset(o)} />
              ))}
              {customOffsets.map((o) => (
                <Chip key={o} label={ddayLabel(o)} selected onClick={() => toggleOffset(o)} />
              ))}
              <Chip label="직접 입력" onClick={() => setCustomOpen((v) => !v)} />
            </div>
            {customOpen && (
              <div className="flex items-center gap-2">
                <span className="text-body">D-</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_CUSTOM_OFFSET}
                  aria-label="며칠 전"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustom()}
                  className="h-10 w-20 rounded-field border border-line bg-card px-2 text-body outline-none"
                />
                <Button size="sm" variant="secondary" leading={<IconPlus size={16} stroke={2} />} onClick={addCustom}>
                  추가
                </Button>
              </div>
            )}
            {offsets.length > 0 && (
              <TimeRow
                label={`${target} D-Day 알림 시간`}
                value={value.ddayTime ?? DEFAULT_DDAY_TIME}
                onChange={(ddayTime) => pick({ ddayTime })}
              />
            )}
          </>
        ) : (
          <p className="m-0 text-caption text-sub">가방 정보에서 D-Day를 정하면 알림을 받을 수 있어요.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader>반복 알림</SectionHeader>
        {/* 요일 7개는 폰 폭에서도 한 줄에 들어가게 칸을 나눠 채운다(칩 기본 여백으로는 일요일이 다음 줄로 넘어감) */}
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => {
            const on = weekdaySet.has(w.day);
            return (
              <button
                key={w.day}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(w.day)}
                className={cx(
                  "h-9 rounded-full border text-caption font-semibold transition-colors duration-160 ease-snappy",
                  on ? "border-ink bg-ink text-on-ink" : "border-line bg-card text-ink active:bg-fill",
                )}
              >
                {w.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Chip label="평일" selected={isWeekdays} onClick={() => pick({ repeatDays: isWeekdays ? [] : [1, 2, 3, 4, 5] })} />
          <Chip label="매일" selected={isEveryday} onClick={() => pick({ repeatDays: isEveryday ? [] : [0, 1, 2, 3, 4, 5, 6] })} />
        </div>
        {days.length > 0 && (
          <TimeRow
            label={`${target} 반복 알림 시간`}
            value={value.repeatTime ?? DEFAULT_REPEAT_TIME}
            onChange={(repeatTime) => pick({ repeatTime })}
          />
        )}
      </section>
    </>
  );
}
