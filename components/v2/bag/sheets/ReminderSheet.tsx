"use client";

import { useState } from "react";
import {
  IconBriefcase,
  IconCalendarDue,
  IconChevronLeft,
  IconChevronRight,
  IconPackage,
  IconPlaneDeparture,
  IconPlus,
  IconRepeat,
  IconUsers,
} from "@tabler/icons-react";
import type { Bag, BagReminder, ReminderTimes } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, Chip, Sheet, Toggle, cx } from "@/components/v2/ui";
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
  itemDueSummary,
  normalizeReminder,
  timesSummary,
} from "@/lib/v2/bagReminders";
import { planBagNotifications } from "@/lib/v2/reminderPlan";
import { nativeLockFilter } from "@/lib/v2/privateLock";
import { notificationSettingsPath } from "@/lib/v2/platform";

// 가방 더보기 > 알림 · 팩 길게 누르기 > 알림(initialPackId) — 2026-10-26 C안(요약 목록 → 눌러서 설정).
// 첫 화면: 가방 전체 · 팩마다 · 아이템 마감일 · 함께 쓰는 사람 소식(함께 쓰는 가방만) 네 줄, 줄마다 지금 켜진 것 요약.
// 세부 화면: 가방 · 팩은 "D-Day 알림" · "매주 반복 알림" 두 상자(시간도 상자마다), 마감은 전날 · 당일 + 마감일 있는 아이템 목록.
// 가방 · 팩 · 마감 화면 아래 "이렇게 와요"는 지금 설정으로 실제 예약될 첫 알림(lib/v2/reminderPlan).
// 내 계정에만 저장되고(다른 멤버에게는 영향 없음) 이 기기가 예약한다(AppShell → syncBagNotifications).
// 시트를 닫을 때 한 번만 저장한다(소식 토글은 누를 때 바로). 알림 권한은 처음 켤 때 묻는다.
type View = "home" | "bag" | "packs" | "due" | "push" | { pack: string };

export function ReminderSheet({
  open,
  onClose,
  bag,
  initialPackId,
  onFocusItem,
}: {
  open: boolean;
  onClose: () => void;
  bag: Bag;
  initialPackId?: string | null;
  // 마감일 목록에서 아이템을 누르면 시트를 닫고 그 아이템으로
  onFocusItem?: (packId: string, itemId: string) => void;
}) {
  const { user, profile, updateBagReminder, setBagPushMuted, setBagPushOff, isOfflineMode } = useAuth();
  const { show } = useToast();
  const saved = profile?.bagReminders?.[bag.id];
  const [draft, setDraft] = useState<BagReminder>(saved ?? {});
  const [draftFor, setDraftFor] = useState<string | null>(open ? `${bag.id}|${initialPackId ?? ""}` : null);
  const [view, setView] = useState<View>(open && initialPackId ? { pack: initialPackId } : "home");
  const [denied, setDenied] = useState(false);
  const [asked, setAsked] = useState(false);

  // 열릴 때마다(또는 다른 가방으로 바뀌면) 저장된 값으로 다시 시작
  const key = open ? `${bag.id}|${initialPackId ?? ""}` : null;
  if (key !== draftFor) {
    setDraftFor(key);
    if (key) {
      setDraft(saved ?? {});
      setView(initialPackId ? { pack: initialPackId } : "home");
      setAsked(false);
    }
  }

  const packs = bag.packs.filter((p) => p.type !== "folder");
  const viewPack = typeof view === "object" ? packs.find((p) => p.id === view.pack) ?? null : null;
  const hasTravelDate = !!bag.travelDate;

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

  const save = () => {
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
  };
  const close = () => {
    save();
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
  const dueItems = packs
    .flatMap((p) => p.items.filter((i) => i.type === "check" && !i.checked && /^\d{4}-\d{2}-\d{2}$/.test(i.dueDate ?? "")).map((i) => ({ pack: p, item: i })))
    .sort((a, b) => a.item.dueDate!.localeCompare(b.item.dueDate!));
  const toggleDue = (o: number) =>
    update({ ...draft, itemDue: { offsets: due.offsets.includes(o) ? due.offsets.filter((x) => x !== o) : [...due.offsets, o], time: due.time } });

  // "이렇게 와요": 이 화면 설정만 남겨 실제 계획 함수로 첫 알림을 뽑는다
  const lock = nativeLockFilter(profile?.privateLock);
  const preview = (only: BagReminder, pick: (p: { packId?: string; itemId?: string }) => boolean) =>
    planBagNotifications(
      [bag],
      { [bag.id]: { itemDue: { offsets: [] }, ...only } },
      new Date(),
      { bagIds: lock.lockedBagIds, packKeys: lock.lockedPackKeys, libraryIds: lock.lockedLibraryIds },
      user?.uid,
    ).find(pick) ?? null;

  const packOnNames = packs.filter((p) => timesSummary(draft.packs?.[p.id], hasTravelDate)).map((p) => p.name || "팩");
  const back = (to: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(to)}
      className="-mt-2 flex items-center gap-1 self-start bg-transparent text-caption font-semibold text-sub"
    >
      <IconChevronLeft size={16} stroke={2} aria-hidden="true" />
      {label}
    </button>
  );

  const title =
    view === "home"
      ? "알림"
      : view === "bag"
        ? "가방 전체 알림"
        : view === "packs"
          ? "팩마다 알림"
          : view === "due"
            ? "아이템 마감일 알림"
            : view === "push"
              ? "함께 쓰는 사람 소식"
              : `${viewPack?.name || "팩"} 알림`;

  return (
    <Sheet open={open} onClose={close} title={title}>
      <div className="flex flex-col gap-5">
        {denied && (
          <p className="m-0 rounded-card bg-fill px-4 py-3 text-caption text-sub">
            알림이 꺼져 있어요. {notificationSettingsPath()}에서 허용해 주세요.
          </p>
        )}

        {view === "home" && (
          <>
            <div className="flex flex-col rounded-card border border-line bg-card px-4">
              <HomeRow
                icon={<IconBriefcase size={20} stroke={1.75} />}
                label="가방 전체"
                value={timesSummary(draft, hasTravelDate) ?? "꺼짐"}
                onClick={() => setView("bag")}
              />
              {packs.length > 0 && (
                <HomeRow
                  icon={<IconPackage size={20} stroke={1.75} />}
                  label="팩마다"
                  value={packOnNames.length > 0 ? `${packOnNames.length}개 켜짐 · ${packOnNames.join(", ")}` : "꺼짐"}
                  onClick={() => setView("packs")}
                />
              )}
              <HomeRow
                icon={<IconCalendarDue size={20} stroke={1.75} />}
                label="아이템 마감일"
                value={itemDueSummary(draft) ? `${itemDueSummary(draft)} · ${dueItems.length}개` : "꺼짐"}
                onClick={() => setView("due")}
              />
              {showPush && (
                <HomeRow
                  icon={<IconUsers size={20} stroke={1.75} />}
                  label="함께 쓰는 사람 소식"
                  value={push.master ? masterDescription : "꺼짐"}
                  onClick={() => setView("push")}
                />
              )}
            </div>
            <p className="m-0 text-micro text-faint">
              내 계정에만 저장돼요. 함께 쓰는 멤버의 알림은 바뀌지 않아요. 같은 계정으로 로그인한 휴대폰 · 태블릿 앱에서 받아요.
            </p>
          </>
        )}

        {view === "bag" && (
          <>
            {back("home", "알림")}
            <p className="m-0 -mt-2 text-caption text-sub">가방에 남은 것 · 내가 맡은 것을 알려 드려요</p>
            <TimesEditor value={draft} onChange={setBagTimes} travelDate={bag.travelDate} target="가방" />
            <Preview notification={preview({ ...draftTimes(draft) }, (p) => !p.packId && !p.itemId)} empty="알림을 고르면 어떻게 오는지 보여 드려요" />
          </>
        )}

        {view === "packs" && (
          <>
            {back("home", "알림")}
            <p className="m-0 -mt-2 text-caption text-sub">팩마다 다른 때 알려 드려요. 누르면 그 팩으로 바로 가요</p>
            <div className="flex flex-col rounded-card border border-line bg-card px-4">
              {packs.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setView({ pack: p.id })}
                  className={cx("flex min-h-13 w-full items-center gap-3 bg-transparent text-left text-body", i > 0 && "border-t border-line")}
                >
                  <span className="min-w-0 flex-1 truncate">{p.kind === "editor" ? `메모: ${p.name || "메모"}` : p.name || "팩"}</span>
                  <span className="truncate text-caption text-sub">{timesSummary(draft.packs?.[p.id], hasTravelDate) ?? "꺼짐"}</span>
                  <IconChevronRight size={18} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="m-0 text-micro text-faint">팩 길게 누르기 › 알림에서도 바로 열려요. 가방 전체 알림과 같은 시각이면 가방 알림에서는 그 팩을 빼요.</p>
          </>
        )}

        {viewPack && (
          <>
            {back("packs", "팩마다")}
            <TimesEditor
              value={draft.packs?.[viewPack.id] ?? {}}
              onChange={(t) => setPackTimes(viewPack.id, t)}
              travelDate={bag.travelDate}
              target="팩"
            />
            <Preview
              notification={preview({ packs: { [viewPack.id]: draft.packs?.[viewPack.id] ?? {} } }, (p) => p.packId === viewPack.id && !p.itemId)}
              empty="알림을 고르면 어떻게 오는지 보여 드려요"
            />
          </>
        )}

        {view === "due" && (
          <>
            {back("home", "알림")}
            <p className="m-0 -mt-2 text-caption text-sub">
              아이템을 길게 눌러 마감일을 정하면 그 아이템을 알려 드려요. 다른 사람이 맡은 건 빼요. 아이템마다 다르게 하려면 그 아이템을 길게 눌러 “이 아이템만 따로”
            </p>
            <Box icon={<IconCalendarDue size={20} stroke={1.75} />} title="언제">
              <div className="flex flex-wrap gap-2">
                {ITEM_DUE_PRESETS.map((o) => (
                  <Chip key={o} label={o === 0 ? "마감 당일" : "마감 전날"} selected={due.offsets.includes(o)} onClick={() => toggleDue(o)} />
                ))}
              </div>
              {due.offsets.length > 0 ? (
                <TimeRow
                  label="아이템 마감 알림 시간"
                  value={due.time}
                  onChange={(time) => setDraft({ ...draft, itemDue: { offsets: due.offsets, time } })}
                />
              ) : (
                <p className="m-0 text-caption text-faint">꺼져 있어요 · 고르면 받을 시간이 나와요</p>
              )}
            </Box>
            <div className="flex flex-col gap-2">
              <span className="text-caption font-semibold text-sub">
                {dueItems.length > 0 ? `마감일이 있는 아이템 ${dueItems.length}개` : "마감일이 있는 아이템이 없어요"}
              </span>
              {dueItems.length > 0 && (
                <div className="flex flex-col rounded-card border border-line bg-card px-4">
                  {dueItems.map(({ pack, item }, i) => {
                    const [, m, d] = item.dueDate!.split("-").map(Number);
                    const row = (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.text || "아이템"}</span>
                        <span className="shrink-0 text-caption text-sub">
                          {m}/{d} · {pack.name || "팩"}
                          {draft.items?.[item.id] ? " · 따로" : ""}
                        </span>
                        {onFocusItem && <IconChevronRight size={18} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />}
                      </>
                    );
                    const cls = cx("flex min-h-13 w-full items-center gap-3 bg-transparent text-left text-body", i > 0 && "border-t border-line");
                    return onFocusItem ? (
                      <button
                        key={item.id}
                        type="button"
                        className={cls}
                        onClick={() => {
                          close();
                          onFocusItem(pack.id, item.id);
                        }}
                      >
                        {row}
                      </button>
                    ) : (
                      <div key={item.id} className={cls}>
                        {row}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Preview
              notification={due.offsets.length > 0 ? preview({ itemDue: due }, () => true) : null}
              empty={due.offsets.length === 0 ? "꺼져 있어요" : "마감일을 정한 아이템이 생기면 보여 드려요"}
            />
          </>
        )}

        {view === "push" && (
          <>
            {back("home", "알림")}
            <p className="m-0 -mt-2 text-caption text-sub">다른 사람이 이 가방에서 한 일을 알려 드려요</p>
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
          </>
        )}
      </div>
    </Sheet>
  );
}

const draftTimes = (r: BagReminder): ReminderTimes => ({
  ddayOffsets: r.ddayOffsets,
  ddayTime: r.ddayTime,
  repeatDays: r.repeatDays,
  repeatTime: r.repeatTime,
});

function HomeRow({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-15 w-full items-center gap-3 border-b border-line bg-transparent py-2 text-left last:border-b-0"
    >
      <span className="shrink-0 text-sub" aria-hidden="true">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body text-ink">{label}</span>
        <span className="truncate text-caption text-sub">{value}</span>
      </span>
      <IconChevronRight size={18} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />
    </button>
  );
}

function Box({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-card p-4">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-body font-semibold text-ink">
          <span className="text-sub" aria-hidden="true">
            {icon}
          </span>
          {title}
        </span>
        {sub && <span className="pl-7 text-micro text-faint">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function Preview({ notification, empty }: { notification: { title: string; body: string } | null; empty: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption font-semibold text-sub">이렇게 와요</span>
      {notification ? (
        <div className="flex flex-col gap-1 rounded-card bg-brand-soft px-4 py-3 text-caption text-brand">
          <span className="font-semibold">{notification.title}</span>
          <span>{notification.body}</span>
        </div>
      ) : (
        <p className="m-0 text-caption text-faint">{empty}</p>
      )}
    </div>
  );
}

function TimeRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex min-h-12 items-center justify-between border-t border-line pt-3">
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

// D-Day 알림 · 매주 반복 알림 두 상자(가방과 팩이 같이 쓴다). 받을 시간은 상자마다, 하나라도 골랐을 때만
function TimesEditor({
  value,
  onChange,
  travelDate,
  target,
}: {
  value: ReminderTimes;
  onChange: (next: ReminderTimes) => void;
  travelDate: string | undefined;
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
  const [, tm, td] = (travelDate ?? "").split("-").map(Number);

  return (
    <>
      <Box
        icon={<IconPlaneDeparture size={20} stroke={1.75} />}
        title="D-Day 알림"
        sub={travelDate && tm && td ? `${tm}월 ${td}일 D-Day 기준 · 한 번씩` : undefined}
      >
        {travelDate ? (
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
                <span className="text-body">일 전</span>
                <Button size="sm" variant="secondary" leading={<IconPlus size={16} stroke={2} />} onClick={addCustom}>
                  추가
                </Button>
              </div>
            )}
            {offsets.length > 0 ? (
              <TimeRow label={`${target} D-Day 알림 시간`} value={value.ddayTime ?? DEFAULT_DDAY_TIME} onChange={(ddayTime) => pick({ ddayTime })} />
            ) : (
              <p className="m-0 text-caption text-faint">고르면 받을 시간이 나와요</p>
            )}
          </>
        ) : (
          <p className="m-0 text-caption text-faint">D-Day가 없어요 · 가방 더보기에서 D-Day를 정하면 쓸 수 있어요</p>
        )}
      </Box>

      <Box icon={<IconRepeat size={20} stroke={1.75} />} title="매주 반복 알림" sub="D-Day와 상관없이 매주">
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
        {days.length > 0 ? (
          <TimeRow label={`${target} 반복 알림 시간`} value={value.repeatTime ?? DEFAULT_REPEAT_TIME} onChange={(repeatTime) => pick({ repeatTime })} />
        ) : (
          <p className="m-0 text-caption text-faint">요일을 고르면 받을 시간이 나와요</p>
        )}
      </Box>
    </>
  );
}
