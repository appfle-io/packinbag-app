"use client";

import { BagReactionDoc, REACTION_EMOJIS, ReactionEmoji } from "@/lib/types";

// 짐/팩/가방 어디서든 재사용하는 프리셋 이모지 리액션 줄. 무한 이모지피커 대신
// 자주 쓸 법한 5개만 고정 제공해서, 댓글을 안 쓰고도 바로 반응만 남길 수 있게 한다.
export default function ReactionBar({
  reactionDoc,
  currentUid,
  onToggle,
  size = "md",
}: {
  reactionDoc: BagReactionDoc | undefined;
  currentUid: string;
  onToggle: (emoji: ReactionEmoji, currentlyReacted: boolean) => void;
  size?: "sm" | "md";
}) {
  const isSm = size === "sm";
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {REACTION_EMOJIS.map((emoji) => {
        const uids = reactionDoc?.reactions?.[emoji] ?? [];
        const mine = uids.includes(currentUid);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji, mine)}
            className="flex items-center gap-1 rounded-full shrink-0"
            style={{
              background: mine ? "var(--accent-soft)" : "var(--surface-2)",
              border: mine ? "1px solid var(--accent)" : "1px solid transparent",
              padding: isSm ? "3px 7px" : "5px 10px",
            }}
          >
            <span style={{ fontSize: isSm ? 14 : 17, lineHeight: 1 }}>{emoji}</span>
            {uids.length > 0 && (
              <span
                className="text-[11px] font-medium"
                style={{ color: mine ? "var(--accent)" : "var(--text-secondary)" }}
              >
                {uids.length}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
