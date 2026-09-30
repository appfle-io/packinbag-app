"use client";

import { IconChecklist, IconFolderPlus, IconNotes } from "@tabler/icons-react";
import { Sheet } from "@/components/v2/ui";

// + 버튼: 지금 보고 있는 폴더 안에 팩 · 메모 · 폴더 만들기
export function AddSheet({
  open,
  onClose,
  where,
  onPack,
  onMemo,
  onFolder,
}: {
  open: boolean;
  onClose: () => void;
  // "여행 › 해외" 처럼 어디에 만들어지는지
  where: string;
  onPack: () => void;
  onMemo: () => void;
  onFolder: () => void;
}) {
  const row = "flex min-h-16 w-full items-center gap-4 border-b border-line bg-transparent text-left active:bg-fill";
  const icon = "flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-ink";
  const pick = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Sheet open={open} onClose={onClose} title="새로 만들기">
      <div className="flex flex-col">
        <p className="m-0 pb-2 text-caption text-faint">{where}에 만들어요</p>
        <button type="button" className={row} onClick={pick(onPack)}>
          <span className={icon}>
            <IconChecklist size={20} stroke={1.9} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-body font-semibold">팩</span>
            <span className="text-caption text-sub">체크할 아이템 목록</span>
          </span>
        </button>
        <button type="button" className={row} onClick={pick(onMemo)}>
          <span className={icon}>
            <IconNotes size={20} stroke={1.9} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-body font-semibold">메모</span>
            <span className="text-caption text-sub">글 · 표 · 체크박스를 자유롭게</span>
          </span>
        </button>
        <button type="button" className={row} onClick={pick(onFolder)}>
          <span className={icon}>
            <IconFolderPlus size={20} stroke={1.9} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-body font-semibold">폴더</span>
            <span className="text-caption text-sub">팩을 묶어 정리 · 폴더 안에 폴더도 돼요</span>
          </span>
        </button>
      </div>
    </Sheet>
  );
}
