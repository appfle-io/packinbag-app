"use client";

import { useRef, useState } from "react";
import { IconCalendar, IconChecklist, IconNotes, IconPhoto, IconClipboardText, IconSearch, IconCloudRain, IconLock, IconHelpCircle, IconBell, IconChevronRight } from "@tabler/icons-react";
import type { Bag } from "@/lib/types";
import { formatDDayLabel } from "@/lib/dday";
import { Button, SectionHeader, Sheet, Toggle } from "@/components/v2/ui";
import { useOnlineGuard } from "@/components/v2/shell/useOnlineGuard";
import { useAuth } from "@/contexts/AuthProvider";
import { isLocalNotificationsAvailable, reminderSummary } from "@/lib/v2/bagReminders";
import { ReminderSheet } from "./ReminderSheet";

// 가방 더보기: 날짜 · 설명 한 줄 · 새 팩/메모 · 사진·파일 · 추천(날씨) · AI(가져오기, 빠진 것 확인) · 삭제/나가기
export function MoreSheet({
  open,
  onClose,
  bag,
  isOwner,
  aiAvailable,
  uploading,
  onSetTravelDate,
  onSetNotice,
  onAddChecklist,
  onAddMemo,
  onAddFiles,
  onImportClipboard,
  onAudit,
  onDeleteOrLeave,
  weather,
  onGuide,
  keepScreenOn,
}: {
  open: boolean;
  onClose: () => void;
  bag: Bag;
  isOwner: boolean;
  aiAvailable: boolean;
  uploading: boolean;
  onSetTravelDate: (date: string | undefined) => void;
  onSetNotice: (notice: string) => void;
  onAddChecklist: () => void;
  onAddMemo: () => void;
  onAddFiles: (files: FileList | null) => void;
  onImportClipboard: () => void;
  onAudit: () => void;
  onDeleteOrLeave: () => void;
  // 날씨로 준비물 추천(온라인일 때만). locked면 자물쇠 표시(눌러도 프리미엄 안내가 뜨도록 onOpen은 그대로 부른다)
  weather?: { locked: boolean; onOpen: () => void } | null;
  // 사용 가이드(코치마크 투어) 다시 보기
  onGuide?: () => void;
  // 화면 켜두기(구 UI 집중 패킹 모드). 이 기기에 기억
  keepScreenOn?: { on: boolean; onChange: (on: boolean) => void };
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  // 사진·파일 올리기는 인터넷이 필요하다(오프라인 모드는 이 기기에 저장하므로 그대로 된다)
  const { guard } = useOnlineGuard();
  const { profile } = useAuth();
  // 알림은 iOS 앱(로컬 알림 플러그인이 든 1.5 이상)에서만 보인다
  const [notificationsAvailable] = useState(isLocalNotificationsAvailable);
  const [reminderOpen, setReminderOpen] = useState(false);
  const reminderText = reminderSummary(profile?.bagReminders?.[bag.id], !!bag.travelDate);
  const [notice, setNotice] = useState(bag.notice ?? "");
  const [editingNoticeFor, setEditingNoticeFor] = useState(bag.id);
  // 다른 가방으로 바뀌면 입력칸 초기화
  if (editingNoticeFor !== bag.id) {
    setEditingNoticeFor(bag.id);
    setNotice(bag.notice ?? "");
  }

  const row = "flex min-h-13 w-full items-center gap-3 border-b border-line bg-transparent text-left text-body";
  const dday = bag.travelDate ? formatDDayLabel(bag.travelDate, !!bag.ddayCountTodayAsDayOne) : null;
  const close = () => {
    if ((bag.notice ?? "") !== notice) onSetNotice(notice.trim());
    onClose();
  };

  return (
    <>
    <Sheet open={open} onClose={close} title={bag.name}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <SectionHeader>가방 정보</SectionHeader>
          {/* label로 감싸면 iOS에서 '지우기'를 눌러도 날짜 입력으로 누름이 넘어가 지워지지 않았다 - 줄은 div, 입력에만 aria-label */}
          <div className="flex min-h-13 items-center justify-between gap-3 border-b border-line">
            <span className="flex items-center gap-3 text-body">
              <IconCalendar size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
              D-Day
              {dday && <span className="text-caption font-semibold text-brand">{dday}</span>}
            </span>
            <span className="flex items-center gap-2">
              <input
                type="date"
                aria-label="D-Day 날짜"
                value={bag.travelDate ?? ""}
                onChange={(e) => onSetTravelDate(e.target.value || undefined)}
                className="h-10 rounded-field border border-line bg-card px-2 text-caption outline-none"
              />
              {bag.travelDate && (
                <Button
                  variant="text"
                  size="sm"
                  className="px-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSetTravelDate(undefined);
                  }}
                >
                  지우기
                </Button>
              )}
            </span>
          </div>
          <label className="flex flex-col gap-2 pt-2">
            <span className="text-caption text-sub">설명 한 줄 (예: 공항 6시 출발)</span>
            <input
              value={notice}
              maxLength={80}
              onChange={(e) => setNotice(e.target.value)}
              onBlur={() => (bag.notice ?? "") !== notice && onSetNotice(notice.trim())}
              className="h-11 rounded-field border border-line bg-card px-3 text-body outline-none focus:border-ink"
            />
          </label>
        </section>

        {(keepScreenOn || notificationsAvailable) && (
          <section className="flex flex-col">
            <SectionHeader>챙길 때</SectionHeader>
            {notificationsAvailable && (
              <button type="button" className={row} onClick={() => (close(), window.setTimeout(() => setReminderOpen(true), 300))}>
                <IconBell size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
                <span className="min-w-0 flex-1">알림</span>
                <span className="truncate text-caption text-sub">{reminderText ?? "꺼짐"}</span>
                <IconChevronRight size={18} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />
              </button>
            )}
            {keepScreenOn && (
              <Toggle
                checked={keepScreenOn.on}
                onChange={keepScreenOn.onChange}
                label="화면 켜두기"
                description="가방을 보는 동안 화면이 꺼지지 않아요 · 이 기기에만 적용"
                className="border-b border-line"
              />
            )}
          </section>
        )}

        <section className="flex flex-col">
          <SectionHeader>추가</SectionHeader>
          <button type="button" className={row} onClick={() => (onAddChecklist(), onClose())}>
            <IconChecklist size={20} stroke={1.75} className="text-sub" aria-hidden="true" />새 팩
          </button>
          <button type="button" className={row} onClick={() => (onAddMemo(), onClose())}>
            <IconNotes size={20} stroke={1.75} className="text-sub" aria-hidden="true" />새 메모
          </button>
          <button type="button" className={row} disabled={uploading} onClick={() => guard(() => fileRef.current?.click(), { localOk: true })}>
            <IconPhoto size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
            {uploading ? "올리는 중…" : "사진 · 파일 첨부"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            hidden
            onChange={(e) => {
              onAddFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </section>

        {weather && (
          <section className="flex flex-col">
            <SectionHeader>추천</SectionHeader>
            <button type="button" className={row} onClick={() => (weather.onOpen(), onClose())}>
              <IconCloudRain size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
              <span className="min-w-0 flex-1">날씨로 준비물 추천</span>
              {weather.locked && <IconLock size={16} stroke={1.9} className="text-faint" aria-label="프리미엄" />}
            </button>
          </section>
        )}

        {aiAvailable && (
          <section className="flex flex-col">
            <SectionHeader>AI</SectionHeader>
            <button type="button" className={row} onClick={() => (onImportClipboard(), onClose())}>
              <IconClipboardText size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
              가져오기 (복사한 글·메모)
            </button>
            <button type="button" className={row} onClick={() => (onAudit(), onClose())}>
              <IconSearch size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
              빠진 것 확인
            </button>
          </section>
        )}

        {onGuide && (
          <section className="flex flex-col">
            <SectionHeader>도움말</SectionHeader>
            <button type="button" className={row} onClick={() => (close(), onGuide())}>
              <IconHelpCircle size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
              사용 가이드
            </button>
          </section>
        )}

        <Button variant="danger" className="self-start px-0" onClick={() => (onDeleteOrLeave(), onClose())}>
          {isOwner ? "가방 삭제" : "이 가방에서 나가기"}
        </Button>
      </div>
    </Sheet>
    {notificationsAvailable && <ReminderSheet open={reminderOpen} onClose={() => setReminderOpen(false)} bag={bag} />}
    </>
  );
}