"use client";

import { IconClipboardText, IconPlus, IconTicket } from "@tabler/icons-react";
import { Sheet } from "@/components/v2/ui";

// 새 가방: 빈 가방 · 메모/글로 채우기(AI) · 초대 코드로 참여. 오프라인에서는 빈 가방만.
export function NewBagSheet({
  open,
  onClose,
  offline,
  onBlank,
  onFromNote,
  onJoin,
}: {
  open: boolean;
  onClose: () => void;
  offline: boolean;
  onBlank: () => void;
  onFromNote: () => void;
  onJoin: () => void;
}) {
  const row = "flex min-h-16 w-full items-center gap-4 border-b border-line bg-transparent text-left active:bg-fill";
  const icon = "flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-ink";
  const pick = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <Sheet open={open} onClose={onClose} title="새 가방">
      <div className="flex flex-col">
        <button type="button" className={row} onClick={pick(onBlank)}>
          <span className={icon}>
            <IconPlus size={20} stroke={1.9} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-body font-semibold">빈 가방</span>
            <span className="text-caption text-sub">팩을 불러오거나 바로 적어 채워요</span>
          </span>
        </button>
        {!offline && (
          <>
            <button type="button" className={row} onClick={pick(onFromNote)}>
              <span className={icon}>
                <IconClipboardText size={20} stroke={1.9} aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-body font-semibold">메모 · 글로 채우기</span>
                <span className="text-caption text-sub">복사한 준비물 목록을 AI가 팩으로 나눠 담아요</span>
              </span>
            </button>
            <button type="button" className={row} onClick={pick(onJoin)}>
              <span className={icon}>
                <IconTicket size={20} stroke={1.9} aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-body font-semibold">초대 코드로 참여</span>
                <span className="text-caption text-sub">받은 코드로 함께 챙기는 가방에 들어가요</span>
              </span>
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
