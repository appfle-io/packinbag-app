"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import type { Bag, BagReminder } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, Chip, SectionHeader, Sheet, cx } from "@/components/v2/ui";
import {
  DDAY_PRESETS,
  DEFAULT_DDAY_TIME,
  DEFAULT_REPEAT_TIME,
  MAX_CUSTOM_OFFSET,
  WEEKDAYS,
  ddayLabel,
  ensureNotificationPermission,
  isReminderEmpty,
} from "@/lib/v2/bagReminders";

// 가방 더보기 > 알림. D-Day 알림(D-7·D-3·D-1·당일 + 직접 입력)과 요일 반복 알림.
// 내 계정에만 저장되고(다른 멤버에게는 영향 없음) 이 아이폰·아이패드가 예약한다(AppShell → syncBagNotifications).
// 시트를 닫을 때 한 번만 저장한다. 알림 권한은 처음 켤 때 묻는다.
export function ReminderSheet({ open, onClose, bag }: { open: boolean; onClose: () => void; bag: Bag }) {
  const { profile, updateBagReminder } = useAuth();
  const { show } = useToast();
  const saved = profile?.bagReminders?.[bag.id];
  const [draft, setDraft] = useState<BagReminder>(saved ?? {});
  const [draftFor, setDraftFor] = useState<string | null>(open ? bag.id : null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [denied, setDenied] = useState(false);
  const [asked, setAsked] = useState(false);

  // 열릴 때마다(또는 다른 가방으로 바뀌면) 저장된 값으로 다시 시작
  const key = open ? bag.id : null;
  if (key !== draftFor) {
    setDraftFor(key);
    if (key) {
      setDraft(saved ?? {});
      setCustomOpen(false);
      setCustomValue("");
      setAsked(false);
    }
  }

  const offsets = draft.ddayOffsets ?? [];
  const days = draft.repeatDays ?? [];
  const customOffsets = offsets.filter((o) => !(DDAY_PRESETS as readonly number[]).includes(o)).sort((a, b) => b - a);

  // 처음 켜는 순간(누름 안에서) 권한을 묻는다
  const askPermissionOnce = () => {
    if (asked) return;
    setAsked(true);
    ensureNotificationPermission().then((ok) => setDenied(!ok));
  };

  const update = (next: BagReminder) => {
    if (isReminderEmpty(draft) && !isReminderEmpty(next)) askPermissionOnce();
    setDraft(next);
  };

  const toggleOffset = (o: number) =>
    update({ ...draft, ddayOffsets: offsets.includes(o) ? offsets.filter((x) => x !== o) : [...offsets, o] });
  const toggleDay = (d: number) =>
    update({ ...draft, repeatDays: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });
  const setDays = (next: number[]) => update({ ...draft, repeatDays: next });

  const addCustom = () => {
    const n = Number(customValue);
    if (!Number.isInteger(n) || n < 1 || n > MAX_CUSTOM_OFFSET) {
      show(`1~${MAX_CUSTOM_OFFSET}일 전 사이로 입력해 주세요`);
      return;
    }
    if (!offsets.includes(n)) update({ ...draft, ddayOffsets: [...offsets, n] });
    setCustomOpen(false);
    setCustomValue("");
  };

  const close = () => {
    const before = JSON.stringify(saved ?? {});
    const normalized: BagReminder = {
      ddayOffsets: offsets.length ? [...offsets].sort((a, b) => b - a) : undefined,
      ddayTime: offsets.length ? draft.ddayTime ?? DEFAULT_DDAY_TIME : undefined,
      repeatDays: days.length ? [...days].sort() : undefined,
      repeatTime: days.length ? draft.repeatTime ?? DEFAULT_REPEAT_TIME : undefined,
    };
    const empty = isReminderEmpty(normalized);
    if (JSON.stringify(empty ? {} : JSON.parse(JSON.stringify(normalized))) !== before) {
      updateBagReminder(bag.id, empty ? null : normalized)
        .then(() => show(empty ? "이 가방 알림을 껐어요" : "알림을 맞춰 두었어요"))
        .catch((err) => {
          console.error("[팩인백] 알림 설정 저장 실패:", err);
          show("알림 설정을 저장하지 못했어요");
        });
    }
    onClose();
  };

  const timeInput = "h-10 rounded-field border border-line bg-card px-2 text-caption outline-none";
  const weekdaySet = new Set(days);
  const isWeekdays = weekdaySet.size === 5 && [1, 2, 3, 4, 5].every((d) => weekdaySet.has(d));
  const isEveryday = weekdaySet.size === 7;

  return (
    <Sheet open={open} onClose={close} title="알림">
      <div className="flex flex-col gap-6">
        {denied && (
          <p className="m-0 rounded-card bg-fill px-4 py-3 text-caption text-sub">
            알림이 꺼져 있어요. 아이폰 설정 &gt; 팩인백 &gt; 알림에서 허용해 주세요.
          </p>
        )}

        <section className="flex flex-col gap-3">
          <SectionHeader>D-Day 알림</SectionHeader>
          {bag.travelDate ? (
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
                <div className="flex min-h-13 items-center justify-between border-b border-line">
                  <span className="text-body">받을 시간</span>
                  <input
                    type="time"
                    aria-label="D-Day 알림 시간"
                    value={draft.ddayTime ?? DEFAULT_DDAY_TIME}
                    onChange={(e) => e.target.value && setDraft({ ...draft, ddayTime: e.target.value })}
                    className={timeInput}
                  />
                </div>
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
            <Chip label="평일" selected={isWeekdays} onClick={() => setDays(isWeekdays ? [] : [1, 2, 3, 4, 5])} />
            <Chip label="매일" selected={isEveryday} onClick={() => setDays(isEveryday ? [] : [0, 1, 2, 3, 4, 5, 6])} />
          </div>
          {days.length > 0 && (
            <div className="flex min-h-13 items-center justify-between border-b border-line">
              <span className="text-body">받을 시간</span>
              <input
                type="time"
                aria-label="반복 알림 시간"
                value={draft.repeatTime ?? DEFAULT_REPEAT_TIME}
                onChange={(e) => e.target.value && setDraft({ ...draft, repeatTime: e.target.value })}
                className={timeInput}
              />
            </div>
          )}
        </section>

        <p className="m-0 text-micro text-faint">
          내 계정에만 저장돼요. 함께 쓰는 멤버의 알림은 바뀌지 않아요. 같은 계정으로 로그인한 아이폰·아이패드에서 받아요.
        </p>
      </div>
    </Sheet>
  );
}
