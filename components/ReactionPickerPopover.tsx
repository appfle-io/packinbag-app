"use client";

import { IconX } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { BagReactionDoc, ReactionEmoji } from "@/lib/types";
import ReactionBar from "@/components/ReactionBar";

// ColorPickerPopover와 동일한 전체화면 딤 + 중앙 카드 패턴. 팩(등 댓글이 없는 대상)에
// 댓글 없이 즉시 반응만 남기고 싶을 때 쓰는 가벼운 팝업이다.
export default function ReactionPickerPopover({
  title,
  reactionDoc,
  currentUid,
  onToggle,
  onClose,
}: {
  title: string;
  reactionDoc: BagReactionDoc | undefined;
  currentUid: string;
  onToggle: (emoji: ReactionEmoji, currentlyReacted: boolean) => void;
  onClose: () => void;
}) {
  return (
    <Portal>
      <div
        className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-6"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-medium truncate min-w-0">{title}</p>
            <button onClick={onClose} aria-label="닫기" className="shrink-0">
              <IconX size={18} stroke={1.75} />
            </button>
          </div>
          <ReactionBar reactionDoc={reactionDoc} currentUid={currentUid} onToggle={onToggle} />
        </div>
      </div>
    </Portal>
  );
}
