import { IconMessages } from "@tabler/icons-react";
import { BagComment, BagReactionDoc, ReactionEmoji } from "@/lib/types";
import Avatar from "@/components/Avatar";
import ReactionPillRow from "@/components/ReactionPillRow";
import MentionText from "@/components/MentionText";

// 가방 공지 메모(BagNotice) 바로 아래에 두는 "가방 대화" 미리보기. 댓글이 있으면
// 최신순으로 최대 3개까지, 아바타+닉네임+내용을 전부 한 줄로 이어서 보여준다
// (절대 두 줄로 나누지 않는다). 닉네임과 내용은 배경 하나로 뭉치지 않고, 각자
// 다른 배경(닉네임=알약 배지, 내용=말풍선)을 가진 별개의 박스로 나눠서 한눈에
// 구분되게 한다.
// 리액션(+포함)은 내용 말풍선의 오른쪽 끝, 맨 아래에 배경과 겹치도록 절대배치한다 -
// 말풍선은 내용 길이만큼만(max-w 한도 내) 폭을 차지하므로, 이 relative 컨테이너
// 기준 right-0로 고정하면 텍스트 길이가 달라져도 항상 그 말풍선의 실제 오른쪽
// 끝에서 걸쳐 보인다.
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
      <div className="flex flex-col gap-1.5">
        {latest.map((c) => {
          const commentReactionDoc = allReactions?.find((r) => r.id === `comment_${c.id}`);
          const showReactions = !!(currentUid && onToggleCommentReaction && onOpenCommentReactionPicker);
          return (
            <div key={c.id} className="flex items-center gap-1.5 w-full">
              <Avatar avatarId={c.authorAvatarId} size={16} />

              {/* 아바타 옆으로 닉네임 배지 + 내용 말풍선이 한 줄로 이어진다 (배경을
                  서로 다르게 줘서 별개 박스로 구분되게 함).
                  flex-1이 있어야 이 줄이 실제 가용 너비를 다 차지해서,
                  말풍선의 max-w-[60%]가 그 "가용 너비의 60%"로 정확히 계산된다.
                  flex-1이 없으면 이 div가 콘텐츠 크기만큼만 좁게 잡히고, 그
                  좁은 너비의 60%가 계산되어 우측에 여백이 남았는데도 일찍
                  잘리는 문제가 생긴다. */}
              <div onClick={onOpen} className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer">
                <span
                  className="shrink-0 inline-flex items-center h-5 rounded-full px-1.5 text-[10.5px] font-medium leading-none"
                  style={{ background: "var(--surface-3, var(--border))", color: "var(--text-secondary)" }}
                >
                  {c.authorNickname}
                </span>

                {/* relative 컨테이너 - 말풍선 실제 크기(내용 길이만큼)를 그대로 감싸서,
                    리액션을 이 컨테이너 기준 right-0로 고정하면 항상 말풍선 오른쪽 끝에 걸린다 */}
                <div className="relative min-w-0 max-w-[60%] shrink mb-1.5">
                  <span
                    className="flex items-center h-5 min-w-0 truncate rounded-lg rounded-tl-sm px-2 text-[12.5px] font-normal leading-none"
                    style={{ background: "var(--surface-2)", color: "var(--foreground)" }}
                  >
                    <MentionText text={c.text} />
                  </span>

                  {showReactions && (
                    <div className="absolute right-0 z-[1]" style={{ bottom: -5 }}>
                      <ReactionPillRow
                        reactionDoc={commentReactionDoc}
                        currentUid={currentUid!}
                        overlap={false}
                        onToggle={(emoji, mine) => onToggleCommentReaction!(c.id, emoji, mine)}
                        onOpenPicker={() => onOpenCommentReactionPicker!(c.id, c.authorNickname)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
