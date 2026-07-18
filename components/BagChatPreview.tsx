import { IconMessages } from "@tabler/icons-react";
import { BagComment, BagReactionDoc, ReactionEmoji } from "@/lib/types";
import Avatar from "@/components/Avatar";
import ReactionPillRow from "@/components/ReactionPillRow";

// 가방 공지 메모(BagNotice) 바로 아래에 두는 "가방 대화" 미리보기. 댓글이 있으면
// 최신순으로 최대 3개까지, 진짜 댓글처럼 아바타+닉네임+말풍선 형태로 보여준다.
// 어차피 여기서는 읽기만 하고(수정은 스레드 안에서) 화면 공간을 많이 차지하면 안 되니
// 줄 간격은 최대한 좁게 유지한다. 댓글이 하나도 없으면 아이콘만 보여준다 - 단,
// hideEmptyPrompt가 true면 그마저도 숨긴다(BagQuickAddRow가 대신 "댓글 추가 +" 트리거를
// 보여줄 때 씀). 탭하면 항상 가방 대화 스레드(ItemThreadSheet, targetType="bag")를 연다.
export default function BagChatPreview({
  comments,
  onOpen,
  hideEmptyPrompt,
  currentUid,
  allReactions,
  onToggleCommentReaction,
  onOpenCommentReactionPicker,
}: {
  comments: BagComment[];
  onOpen: () => void;
  hideEmptyPrompt?: boolean;
  currentUid?: string;
  allReactions?: BagReactionDoc[];
  onToggleCommentReaction?: (commentId: string, emoji: ReactionEmoji, currentlyReacted: boolean) => void;
  onOpenCommentReactionPicker?: (commentId: string, authorNickname: string) => void;
}) {
  if (comments.length === 0) {
    if (hideEmptyPrompt) return null;
    return (
      <button
        onClick={onOpen}
        className="flex items-center gap-1 text-[12px] mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        <IconMessages size={13} stroke={1.75} />
        댓글 추가 +
      </button>
    );
  }

  const sorted = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latest = sorted.slice(-3).reverse();

  return (
    <div className="block w-full mb-3">
      <div className="flex flex-col gap-1">
        {latest.map((c) => {
          const commentReactionDoc = allReactions?.find((r) => r.id === `comment_${c.id}`);
          return (
            <div key={c.id} className="flex flex-col gap-0 py-0.5">
              <div className="flex items-center gap-1.5 w-full">
                {/* 아바타와 말풍선을 감싼 영역만 클릭 시 대화창 열기 */}
                <div onClick={onOpen} className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer">
                  <Avatar avatarId={c.authorAvatarId} size={16} />
                  <div
                    className="min-w-0 flex-1 rounded-lg rounded-tl-sm px-2 py-1"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <span className="text-[10.5px] font-medium mr-1.5" style={{ color: "var(--text-secondary)" }}>
                      {c.authorNickname}
                    </span>
                    <span className="text-[12.5px] break-words font-normal" style={{ color: "var(--foreground)" }}>
                      {c.text}
                    </span>
                  </div>
                </div>
              </div>

              {/* 리액션 필 (Pill) 노출 */}
              {currentUid && onToggleCommentReaction && onOpenCommentReactionPicker && (
                <div className="pl-5 -mt-1">
                  <ReactionPillRow
                    reactionDoc={commentReactionDoc}
                    currentUid={currentUid}
                    onToggle={(emoji, mine) => onToggleCommentReaction(c.id, emoji, mine)}
                    onOpenPicker={() => onOpenCommentReactionPicker(c.id, c.authorNickname)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
