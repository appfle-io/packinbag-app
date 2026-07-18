"use client";

import { BagReactionDoc, ReactionEmoji } from "@/lib/types";

// 팀즈처럼 짐(항목)에 달린 이모지 반응을 아이템 바로 아래쪽에 살짝 겹쳐서 떠있는
// 작은 알약 모양들로 보여준다. 최대 3개 이모지 종류까지만 보여주고(우리 앱은 팀즈보다
// 단순하게 가려는 의도), 탭하면 바로 그 자리에서 토글된다(댓글 스레드에 안 들어가도 됨).
// 끝에 있는 "+" 알약을 누르면 전체 프리셋에서 고를 수 있는 팝업이 뜬다.
export default function ReactionPillRow({
  reactionDoc,
  currentUid,
  onToggle,
  onOpenPicker,
}: {
  reactionDoc: BagReactionDoc | undefined;
  currentUid: string;
  onToggle: (emoji: ReactionEmoji, currentlyReacted: boolean) => void;
  onOpenPicker: () => void;
}) {
  const entries = Object.entries(reactionDoc?.reactions ?? {}).filter(
    ([, uids]) => (uids?.length ?? 0) > 0
  ) as [ReactionEmoji, string[]][];
  const shown = entries.slice(0, 3);

  return (
    <div
      className="relative z-[1] flex items-center gap-0.5 pl-2"
      style={{ marginTop: -6, marginBottom: shown.length > 0 ? 1 : -4 }}
    >
      {shown.map(([emoji, uids]) => {
        const mine = uids.includes(currentUid);
        return (
          <button
            key={emoji}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(emoji, mine);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 rounded-full shadow-sm"
            style={{
              background: mine ? "var(--accent-soft)" : "var(--surface)",
              border: mine ? "1px solid var(--accent)" : "1px solid var(--border)",
              padding: "0px 4px",
            }}
          >
            <span style={{ fontSize: 9, lineHeight: 1.6 }}>{emoji}</span>
            <span
              className="text-[8.5px] font-medium"
              style={{ color: mine ? "var(--accent)" : "var(--text-secondary)" }}
            >
              {uids.length}
            </span>
          </button>
        );
      })}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenPicker();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="반응 추가"
        className="flex items-center justify-center rounded-full shadow-sm"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          width: 14,
          height: 14,
        }}
      >
        <span style={{ fontSize: 8, lineHeight: 1, color: "var(--text-muted)" }}>+</span>
      </button>
    </div>
  );
}
