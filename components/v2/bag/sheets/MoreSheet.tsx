"use client";

import { useRef, useState } from "react";
import { IconCalendar, IconChecklist, IconNotes, IconPhoto, IconClipboardText, IconSearch } from "@tabler/icons-react";
import type { Bag } from "@/lib/types";
import { Button, SectionHeader, Sheet } from "@/components/v2/ui";

// 가방 더보기: 날짜 · 설명 한 줄 · 새 팩/메모 · 사진·파일 · AI(가져오기, 빠진 것 확인) · 삭제/나가기
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
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState(bag.notice ?? "");
  const [editingNoticeFor, setEditingNoticeFor] = useState(bag.id);
  // 다른 가방으로 바뀌면 입력칸 초기화
  if (editingNoticeFor !== bag.id) {
    setEditingNoticeFor(bag.id);
    setNotice(bag.notice ?? "");
  }

  const row = "flex min-h-13 w-full items-center gap-3 border-b border-line bg-transparent text-left text-body";
  const close = () => {
    if ((bag.notice ?? "") !== notice) onSetNotice(notice.trim());
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={bag.name}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <SectionHeader>가방 정보</SectionHeader>
          <label className="flex min-h-13 items-center justify-between gap-3 border-b border-line">
            <span className="flex items-center gap-3 text-body">
              <IconCalendar size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
              출발 날짜
            </span>
            <span className="flex items-center gap-2">
              <input
                type="date"
                value={bag.travelDate ?? ""}
                onChange={(e) => onSetTravelDate(e.target.value || undefined)}
                className="h-10 rounded-field border border-line bg-card px-2 text-caption outline-none"
              />
              {bag.travelDate && (
                <Button variant="text" size="sm" className="px-2" onClick={() => onSetTravelDate(undefined)}>
                  지우기
                </Button>
              )}
            </span>
          </label>
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

        <section className="flex flex-col">
          <SectionHeader>추가</SectionHeader>
          <button type="button" className={row} onClick={() => (onAddChecklist(), onClose())}>
            <IconChecklist size={20} stroke={1.75} className="text-sub" aria-hidden="true" />새 팩
          </button>
          <button type="button" className={row} onClick={() => (onAddMemo(), onClose())}>
            <IconNotes size={20} stroke={1.75} className="text-sub" aria-hidden="true" />새 메모
          </button>
          <button type="button" className={row} disabled={uploading} onClick={() => fileRef.current?.click()}>
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

        <Button variant="danger" className="self-start px-0" onClick={() => (onDeleteOrLeave(), onClose())}>
          {isOwner ? "가방 삭제" : "이 가방에서 나가기"}
        </Button>
      </div>
    </Sheet>
  );
}