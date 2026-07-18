"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconPencil, IconSend2, IconTrash, IconX } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import Avatar from "@/components/Avatar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { BagComment, BagReactionDoc, CommentTargetType, ReactionEmoji } from "@/lib/types";
import {
  createComment,
  deleteComment,
  subscribeToComments,
  updateCommentText,
} from "@/lib/commentsService";
import { subscribeToReactions, toggleReaction } from "@/lib/reactionsService";
import ReactionBar from "@/components/ReactionBar";
import MentionInput, { MentionMember } from "@/components/MentionInput";
import { extractMentionedUids } from "@/lib/mentions";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 짐(item) 또는 가방 전체(bag) 댓글 스레드 - 공용 컴포넌트. targetType='item'일 때만
// 상단에 즉시 반응용 이모지 리액션 줄을 둔다(가방 전체는 리액션 대상이 아님). 그 아래
// 댓글 목록 + @멘션 자동완성이 되는 입력창을 둔다. bagId 하나에 대해서만 실시간
// 구독하고(전체 comments/reactions 서브컬렉션), 화면에서는 이 targetId에 해당하는
// 것만 걸러서 보여준다 - presence/comments 서비스와 동일하게 복합 인덱스 없이
// 가볍게 구현하려는 목적.
export default function ItemThreadSheet({
  bagId,
  targetType = "item",
  targetId,
  packId,
  title,
  currentUid,
  currentNickname,
  currentAvatarId,
  members,
  onClose,
}: {
  bagId: string;
  targetType?: CommentTargetType;
  targetId: string; // targetType='item'이면 짐 id, 'bag'이면 bagId 자체
  packId?: string;
  title: string;
  currentUid: string;
  currentNickname: string;
  currentAvatarId: string;
  // @멘션 자동완성용 가방 멤버 목록(본인 제외). 없으면 멘션 자동완성 없이 일반 입력창.
  members?: MentionMember[];
  onClose: () => void;
}) {
  const [allComments, setAllComments] = useState<BagComment[]>([]);
  const [allReactions, setAllReactions] = useState<BagReactionDoc[]>([]);
  const [draft, setDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // 본인이 쓴 댓글을 수정 중이면 그 댓글 id, 아니면 null.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeToComments(bagId, setAllComments), [bagId]);
  useEffect(() => subscribeToReactions(bagId, setAllReactions), [bagId]);

  const comments = useMemo(
    () => allComments.filter((c) => c.targetType === targetType && c.targetId === targetId),
    [allComments, targetType, targetId]
  );
  const reactionDoc = allReactions.find((r) => r.id === `item_${targetId}`);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [comments.length]);

  const handleToggleReaction = (emoji: ReactionEmoji, currentlyReacted: boolean) => {
    toggleReaction(bagId, "item", targetId, currentUid, emoji, currentlyReacted).catch((err) => {
      console.error("[팩인백] 리액션 실패:", err);
    });
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    try {
      const mentions = members ? extractMentionedUids(text, members) : [];
      await createComment(bagId, {
        targetType,
        targetId,
        packId,
        authorUid: currentUid,
        authorNickname: currentNickname,
        authorAvatarId: currentAvatarId,
        text,
        mentions,
        mentionTargetLabel: title,
      });
    } catch (err) {
      console.error("[팩인백] 댓글 작성 실패:", err);
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const handleStartEdit = (c: BagComment) => {
    setEditingId(c.id);
    setEditDraft(c.text);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const text = editDraft.trim();
    const id = editingId;
    setEditingId(null);
    if (!text) return;
    try {
      await updateCommentText(bagId, id, text);
    } catch (err) {
      console.error("[팩인백] 댓글 수정 실패:", err);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[85] flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl md:max-w-4xl rounded-t-2xl bg-background flex flex-col overflow-hidden"
          style={{ maxHeight: "80vh" }}
        >
          <div className="flex items-center justify-between gap-2 p-4 pb-2 shrink-0 border-b border-border">
            <p className="text-[14px] font-medium truncate min-w-0">{title}</p>
            <button onClick={onClose} aria-label="닫기" className="shrink-0 -m-2 p-2">
              <IconX size={18} stroke={1.75} />
            </button>
          </div>

          {targetType === "item" && (
            <div className="px-4 py-3 shrink-0 border-b border-border">
              <ReactionBar
                reactionDoc={reactionDoc}
                currentUid={currentUid}
                onToggle={handleToggleReaction}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {comments.length === 0 ? (
              <p className="text-[12px] text-text-muted text-center py-6">
                아직 댓글이 없어요. 첫 댓글을 남겨보세요.
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <Avatar avatarId={c.authorAvatarId} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-medium">{c.authorNickname}</span>
                      <span className="text-[9px] text-text-muted shrink-0">
                        {formatTime(c.createdAt)}
                        {c.updatedAt ? " (수정됨)" : ""}
                      </span>
                    </div>
                    {editingId === c.id ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          autoFocus
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveEdit();
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                          maxLength={500}
                          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-[13px] outline-none"
                        />
                        <button
                          onClick={handleSaveEdit}
                          aria-label="수정 완료"
                          className="shrink-0 -m-1 p-1"
                        >
                          <IconCheck size={16} stroke={2} color="var(--accent)" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          aria-label="수정 취소"
                          className="shrink-0 -m-1 p-1"
                        >
                          <IconX size={16} stroke={1.75} color="var(--text-muted)" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-[13px] whitespace-pre-wrap break-words" style={{ color: "var(--text-secondary)" }}>
                        {c.text}
                      </p>
                    )}
                  </div>
                  {c.authorUid === currentUid && editingId !== c.id && (
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(c)}
                        aria-label="댓글 수정"
                        className="-m-1.5 p-1.5"
                      >
                        <IconPencil size={14} stroke={1.75} color="var(--text-muted)" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(c.id)}
                        aria-label="댓글 삭제"
                        className="-m-1.5 p-1.5"
                      >
                        <IconTrash size={14} stroke={1.75} color="var(--text-muted)" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={listEndRef} />
          </div>

          <div
            className="flex items-center gap-2 p-3 shrink-0 border-t border-border"
            style={{ paddingBottom: "max(12px, calc(env(safe-area-inset-bottom) + 6px))" }}
          >
            {members && members.length > 0 ? (
              <MentionInput
                members={members}
                value={draft}
                onChange={setDraft}
                onSubmit={handleSend}
                placeholder="댓글을 입력해요 (@로 멘션)"
              />
            ) : (
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="댓글을 입력해요"
                maxLength={500}
                className="min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-4 py-2.5 text-[13px] outline-none"
              />
            )}
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              aria-label="댓글 보내기"
              className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              <IconSend2 size={16} stroke={1.75} color="#fff" />
            </button>
          </div>
        </div>
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title="댓글을 삭제할까요?"
          message="삭제하면 되돌릴 수 없어요."
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => {
            const id = confirmDeleteId;
            setConfirmDeleteId(null);
            deleteComment(bagId, id).catch((err) => {
              console.error("[팩인백] 댓글 삭제 실패:", err);
            });
          }}
        />
      )}
    </Portal>
  );
}
