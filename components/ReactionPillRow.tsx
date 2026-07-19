"use client";

import { BagReactionDoc, ReactionEmoji } from "@/lib/types";

// 짐(항목)에 달린 이모지 반응을 아이템 바로 아래쪽에 살짝 겹쳐서 떠있는
// 작은 알약 모양들로 보여준다. 최대 3개 이모지 종류까지만 보여주고(우리 앱은 팀즈보다
// 단순하게 가려는 의도), 탭하면 바로 그 자리에서 토글된다(댓글 스레드에 안 들어가도 됨).
// 끝에 있는 "+" 알약을 누르면 전체 프리셋에서 고를 수 있는 팝업이 뜬다.
// overlap(기본 true)이 false면 짐 위에 겹쳐 띄우는 음수 마진을 빼고 일반 인라인
// 요소로 그린다 - 댓글 말풍선 옆에 나란히 붙일 때 쓴다(BagChatPreview/ItemThreadSheet).
export default function ReactionPillRow({
  reactionDoc,
  currentUid,
  onToggle,
  onOpenPicker,
  overlap = true,
}: {
  reactionDoc: BagReactionDoc | undefined;
  currentUid: string;
  onToggle: (emoji: ReactionEmoji, currentlyReacted: boolean) => void;
  onOpenPicker: () => void;
  overlap?: boolean;
}) {
  const entries = Object.entries(reactionDoc?.reactions ?? {}).filter(
    ([, uids]) => (uids?.length ?? 0) > 0
  ) as [ReactionEmoji, string[]][];
  const shown = entries.slice(0, 3);

  return (
    <div
      className={
        overlap
          ? "relative z-[1] flex items-center gap-0.5 pl-2 flex-wrap"
          : "flex items-center gap-0.5 flex-wrap shrink-0"
      }
      style={overlap ? { marginTop: -6, marginBottom: shown.length > 0 ? 1 : -4 } : undefined}
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
              padding: "0px 3px",
            }}
          >
            <span style={{ fontSize: 7, lineHeight: 1.6 }}>{emoji}</span>
            <span
              className="text-[7px] font-medium"
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
        className="flex items-center justify-center rounded-full shadow-sm shrink-0"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          width: 10,
          height: 10,
        }}
      >
        <span style={{ fontSize: 7, lineHeight: 1, color: "var(--text-muted)" }}>+</span>
      </button>
    </div>
  );
}
