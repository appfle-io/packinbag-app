"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconX,
  IconSquareCheck,
  IconAlignLeft,
  IconBold,
  IconStrikethrough,
  IconCalendarEvent,
  IconSend2,
  IconPencil,
  IconTrash,
  IconCheck,
} from "@tabler/icons-react";
import Portal from "@/components/Portal";
import PackChipBar from "@/components/PackChipBar";
import Avatar from "@/components/Avatar";
import ConfirmDialog from "@/components/ConfirmDialog";
import MentionInput, { MentionMember } from "@/components/MentionInput";
import MentionText from "@/components/MentionText";
import ReactionPillRow from "@/components/ReactionPillRow";
import ReactionPickerPopover from "@/components/ReactionPickerPopover";
import { extractMentionedUids } from "@/lib/mentions";
import { BagComment, BagReactionDoc, ItemType, Pack, ReactionEmoji } from "@/lib/types";
import {
  createComment,
  deleteComment,
  subscribeToComments,
  updateCommentText,
} from "@/lib/commentsService";
import { subscribeToReactions, toggleReaction } from "@/lib/reactionsService";
import { TEXT_COLORS } from "@/components/ItemRow";

export interface ItemFormSaveData {
  type: ItemType;
  text: string;
  bold?: boolean;
  strike?: boolean;
  color?: string;
  dueDate?: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 모바일 키보드가 올라오면 iOS는 레이아웃 뷰포트는 그대로 두고 비주얼 뷰포트만
// 줄인다. 모달을 레이아웃 뷰포트 기준(fixed inset-0)으로 두면 브라우저가 포커스된
// 입력창을 보여주려고 자동 스크롤하면서 모달이 밀리거나 잘리는 핑퐁 현상이 생긴다.
// 그래서 브라우저의 자동 스크롤과 싸우지 않고, 대신 visualViewport의 실제
// height/offsetTop을 그대로 읽어서 모달 컨테이너 크기를 거기에 맞춰버린다.
function useVisualViewport() {
  const getRect = () => {
    if (typeof window === "undefined") return { height: 0, offsetTop: 0 };
    const vv = window.visualViewport;
    return vv ? { height: vv.height, offsetTop: vv.offsetTop } : { height: window.innerHeight, offsetTop: 0 };
  };

  const [rect, setRect] = useState(getRect);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setRect({ height: vv.height, offsetTop: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return rect;
}

// 짐 추가/수정 + 댓글을 한 화면에서 같이 보여주는 통합 모달(2026-07~).
// 예전엔 수정(ItemFormModal)과 댓글(ItemThreadSheet)이 서로 다른 진입점(스와이프/더블탭)
// 으로 열리는 별도 모달이었는데, 댓글 버튼이 짐 목록 폭을 차지해 내용이 잘려 보이는
// 문제 + 두 창을 오가야 하는 불편 때문에 하나로 합쳤다. thread prop이 있으면(=가방
// 맥락이 있는 곳) 수정 필드 아래에 댓글 섹션이 함께 뜨고, 없으면(팩 보관함 편집처럼
// 가방/댓글 개념이 없는 곳) 예전처럼 수정 필드만 보여준다.
// - selectionMode="single": 가방 속 팩 편집 - 담을 팩을 하나만 고른다(라디오형).
// - selectionMode="multi": 팩 보관함 편집 - 보관함의 모든 팩을 체크박스로
//   보여주고, 체크된 모든 팩에 동시에 추가/복사된다.
// 삭제는 이 모달의 책임이 아니다 - 짐 목록의 왼쪽 스와이프 삭제로만 가능하고,
// 이 모달에서는 필수값(텍스트/팩 선택)이 비어있으면 저장을 막고 안내만 보여준다.
export default function ItemEditModal({
  packs,
  selectionMode,
  initialSelectedPackIds,
  mode,
  initialType,
  initialText = "",
  initialBold = false,
  initialStrike = false,
  initialColor = "",
  initialDueDate,
  onClose,
  onSave,
  thread,
}: {
  packs: Pack[];
  selectionMode: "single" | "multi";
  initialSelectedPackIds: string[];
  mode: "add" | "edit";
  initialType: ItemType;
  initialText?: string;
  initialBold?: boolean;
  initialStrike?: boolean;
  initialColor?: string;
  initialDueDate?: string;
  onClose: () => void;
  onSave: (targetPackIds: string[], data: ItemFormSaveData) => void;
  // 있으면 이 짐의 댓글 스레드를 수정 필드 아래에 함께 보여준다.
  thread?: {
    bagId: string;
    targetId: string; // itemId
    packId?: string;
    currentUid: string;
    currentNickname: string;
    currentAvatarId: string;
    // @멘션 자동완성용 가방 멤버 목록(본인 제외). 없으면 멘션 자동완성 없이 일반 입력창.
    members?: MentionMember[];
  };
}) {
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>(initialSelectedPackIds);
  const [type, setType] = useState<ItemType>(initialType);
  const [text, setText] = useState(initialText);
  const [bold, setBold] = useState(initialBold);
  const [strike, setStrike] = useState(initialStrike);
  const [color, setColor] = useState(initialColor);
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { height: viewportHeight, offsetTop: viewportOffsetTop } = useVisualViewport();

  const handleSelectPack = (packId: string) => {
    if (selectionMode === "single") {
      setSelectedPackIds([packId]);
      return;
    }
    setSelectedPackIds((prev) =>
      prev.includes(packId) ? prev.filter((id) => id !== packId) : [...prev, packId]
    );
  };

  const textEmpty = text.trim() === "";
  const noPackSelected = selectedPackIds.length === 0;
  const canSave = !textEmpty && !noPackSelected;

  const handleSave = () => {
    if (!canSave) return;
    onSave(selectedPackIds, {
      type,
      text,
      dueDate: dueDate || undefined,
      ...(type === "text" ? { bold, strike, color: color || undefined } : {}),
    });
    // "추가" 모드일 때만 저장 후 모달을 닫지 않고 텍스트/서식만 초기화해서 연달아
    // 여러 개를 넣을 수 있게 한다(팀 선택은 그대로 유지 - 같은 패들에 계속 추가하는
    // 경우가 많아서). 닫거나 멈추려면 사용자가 직접 취소/X를 누르면 된다. 수정(edit)
    // 모드는 부모(handleModalSave)가 대신 모달을 닫는다.
    if (mode === "add") {
      setText("");
      setBold(false);
      setStrike(false);
      setColor("");
      setDueDate("");
      textareaRef.current?.focus();
    }
  };

  // --- 댓글 스레드 (thread prop이 있을 때만 동작) ---------------------------
  const [allComments, setAllComments] = useState<BagComment[]>([]);
  const [allReactions, setAllReactions] = useState<BagReactionDoc[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentDraft, setEditCommentDraft] = useState("");
  const [reactionPickerCommentTarget, setReactionPickerCommentTarget] = useState<{
    commentId: string;
    authorNickname: string;
  } | null>(null);

  useEffect(() => {
    if (!thread) return;
    return subscribeToComments(thread.bagId, setAllComments);
  }, [thread?.bagId]);
  useEffect(() => {
    if (!thread) return;
    return subscribeToReactions(thread.bagId, setAllReactions);
  }, [thread?.bagId]);

  const comments = useMemo(() => {
    if (!thread) return [];
    return allComments.filter((c) => c.targetType === "item" && c.targetId === thread.targetId);
  }, [allComments, thread]);

  const handleToggleCommentReaction = (
    commentId: string,
    emoji: ReactionEmoji,
    currentlyReacted: boolean
  ) => {
    if (!thread) return;
    toggleReaction(thread.bagId, "comment", commentId, thread.currentUid, emoji, currentlyReacted).catch(
      (err) => {
        console.error("[팩인백] 댓글 리액션 실패:", err);
      }
    );
  };

  const handleSendComment = async () => {
    if (!thread) return;
    const value = commentDraft.trim();
    if (!value || sendingComment) return;
    setSendingComment(true);
    setCommentDraft("");
    try {
      const mentions = thread.members ? extractMentionedUids(value, thread.members) : [];
      await createComment(thread.bagId, {
        targetType: "item",
        targetId: thread.targetId,
        packId: thread.packId,
        authorUid: thread.currentUid,
        authorNickname: thread.currentNickname,
        authorAvatarId: thread.currentAvatarId,
        text: value,
        mentions,
        mentionTargetLabel: text || "짐",
      });
    } catch (err) {
      console.error("[팩인백] 댓글 작성 실패:", err);
      setCommentDraft(value);
    } finally {
      setSendingComment(false);
    }
  };

  const handleStartEditComment = (c: BagComment) => {
    setEditingCommentId(c.id);
    setEditCommentDraft(c.text);
  };

  const handleSaveEditComment = async () => {
    if (!thread || !editingCommentId) return;
    const value = editCommentDraft.trim();
    const id = editingCommentId;
    setEditingCommentId(null);
    if (!value) return;
    try {
      await updateCommentText(thread.bagId, id, value);
    } catch (err) {
      console.error("[팩인백] 댓글 수정 실패:", err);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-x-0 z-[90] flex items-center justify-center p-4"
        style={{ top: viewportOffsetTop, height: viewportHeight, background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-surface p-4 flex flex-col gap-4 overflow-y-auto"
          style={{ maxHeight: "100%" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-medium">
              {mode === "add" ? "짐 추가" : "짐 수정"}
            </span>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {selectionMode === "single" ? (
              <>
                <span className="text-[12px] text-text-muted pl-1">담을 팩</span>
                <select
                  value={selectedPackIds[0] ?? ""}
                  onChange={(e) => handleSelectPack(e.target.value)}
                  aria-label="담을 팩"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] outline-none"
                >
                  {packs.length === 0 && <option value="">팩이 없어요</option>}
                  {packs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || "팩"}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <PackChipBar
                packs={packs}
                label="담을 팩 (여러개 선택 가능)"
                onSelectPack={handleSelectPack}
                getState={(packId) =>
                  selectedPackIds.includes(packId) ? "selected" : "normal"
                }
              />
            )}
            {noPackSelected && (
              <p className="text-[11px] pl-1" style={{ color: "var(--danger)" }}>
                담을 팩을 선택해주세요.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setType("check")}
              aria-label="체크항목"
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{
                background: type === "check" ? "var(--accent)" : "var(--surface-2)",
                color: type === "check" ? "#fff" : "var(--text-secondary)",
                width: 38,
                height: 38,
              }}
            >
              <IconSquareCheck size={18} stroke={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setType("text")}
              aria-label="텍스트"
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{
                background: type === "text" ? "var(--accent)" : "var(--surface-2)",
                color: type === "text" ? "#fff" : "var(--text-secondary)",
                width: 38,
                height: 38,
              }}
            >
              <IconAlignLeft size={18} stroke={1.75} />
            </button>
            <span
              className="shrink-0"
              style={{ width: 1, height: 22, background: "var(--border)" }}
            />
            <IconCalendarEvent size={16} stroke={1.75} color="var(--text-secondary)" className="shrink-0" />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2 py-2 text-[13px] outline-none"
            />
            {dueDate && (
              <button onClick={() => setDueDate("")} aria-label="마감일 삭제" className="shrink-0 p-1">
                <IconX size={14} stroke={1.75} color="var(--text-muted)" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <textarea
              ref={textareaRef}
              autoFocus
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={type === "check" ? "짐 이름" : "텍스트 입력"}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[15px] outline-none resize-none"
              style={{
                fontWeight: type === "text" && bold ? 700 : 400,
                textDecoration: type === "text" && strike ? "line-through" : "none",
                color: type === "text" ? color || "var(--foreground)" : "var(--foreground)",
              }}
            />
            {textEmpty && (
              <p className="text-[11px] pl-1" style={{ color: "var(--danger)" }}>
                텍스트를 입력해주세요.
              </p>
            )}
          </div>

          {type === "text" && (
            <div className="flex items-center flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setBold((b) => !b)}
                aria-label="굵게"
                className="flex items-center justify-center rounded shrink-0"
                style={{
                  background: bold ? "var(--accent)" : "var(--surface-2)",
                  color: bold ? "#fff" : "var(--text-secondary)",
                  width: 30,
                  height: 30,
                }}
              >
                <IconBold size={16} stroke={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setStrike((s) => !s)}
                aria-label="취소선"
                className="flex items-center justify-center rounded shrink-0"
                style={{
                  background: strike ? "var(--accent)" : "var(--surface-2)",
                  color: strike ? "#fff" : "var(--text-secondary)",
                  width: 30,
                  height: 30,
                }}
              >
                <IconStrikethrough size={16} stroke={2.25} />
              </button>
              <span
                className="shrink-0"
                style={{ width: 1, height: 18, background: "var(--border)" }}
              />
              {TEXT_COLORS.map((c) => (
                <button
                  key={c || "default"}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c ? `색상 ${c}` : "기본 색상"}
                  className="rounded-full shrink-0"
                  style={{
                    background: c || "var(--surface-2)",
                    border:
                      color === c
                        ? "1.5px solid var(--foreground)"
                        : "1.5px solid var(--border-strong)",
                    width: 24,
                    height: 24,
                  }}
                />
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg py-2.5 text-[14px] font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 rounded-lg py-2.5 text-[14px] font-medium"
              style={{
                background: canSave ? "var(--accent)" : "var(--surface-2)",
                color: canSave ? "#fff" : "var(--text-muted)",
              }}
            >
              저장
            </button>
          </div>

          {/* 댓글 섹션 - thread가 있을 때만(=가방 맥락). 예전엔 별도 모달(ItemThreadSheet)
              이었는데, 수정과 한 화면에서 같이 보고 쓸 수 있도록 여기로 옮겨왔다. */}
          {thread && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-[12.5px] font-medium text-text-secondary">
                댓글{comments.length > 0 ? ` ${comments.length}` : ""}
              </p>

              <div className="flex flex-col gap-2.5 max-h-52 overflow-y-auto overflow-x-hidden">
                {comments.length === 0 ? (
                  <p className="text-[11.5px] text-text-muted py-2 text-center">
                    아직 댓글이 없어요. 첫 댓글을 남겨보세요.
                  </p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2">
                      <Avatar avatarId={c.authorAvatarId} size={24} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium">{c.authorNickname}</span>
                          <span className="text-[9px] text-text-muted shrink-0">
                            {formatTime(c.createdAt)}
                            {c.updatedAt ? " (수정됨)" : ""}
                          </span>
                        </div>
                        {editingCommentId === c.id ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <input
                              autoFocus
                              value={editCommentDraft}
                              onChange={(e) => setEditCommentDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSaveEditComment();
                                } else if (e.key === "Escape") {
                                  setEditingCommentId(null);
                                }
                              }}
                              maxLength={500}
                              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-[12.5px] outline-none"
                            />
                            <button
                              onClick={handleSaveEditComment}
                              aria-label="수정 완료"
                              className="shrink-0 -m-1 p-1"
                            >
                              <IconCheck size={15} stroke={2} color="var(--accent)" />
                            </button>
                            <button
                              onClick={() => setEditingCommentId(null)}
                              aria-label="수정 취소"
                              className="shrink-0 -m-1 p-1"
                            >
                              <IconX size={15} stroke={1.75} color="var(--text-muted)" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-end gap-2 flex-wrap">
                            <p
                              className="max-w-[75%] min-w-0 shrink text-[12.5px] whitespace-pre-wrap break-words"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              <MentionText text={c.text} />
                            </p>
                            <div className="shrink-0">
                              <ReactionPillRow
                                reactionDoc={allReactions.find((r) => r.id === `comment_${c.id}`)}
                                currentUid={thread.currentUid}
                                overlap={false}
                                onToggle={(emoji, mine) => handleToggleCommentReaction(c.id, emoji, mine)}
                                onOpenPicker={() =>
                                  setReactionPickerCommentTarget({
                                    commentId: c.id,
                                    authorNickname: c.authorNickname,
                                  })
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {c.authorUid === thread.currentUid && editingCommentId !== c.id && (
                        <div className="shrink-0 flex items-center gap-1">
                          <button
                            onClick={() => handleStartEditComment(c)}
                            aria-label="댓글 수정"
                            className="-m-1.5 p-1.5"
                          >
                            <IconPencil size={13} stroke={1.75} color="var(--text-muted)" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteCommentId(c.id)}
                            aria-label="댓글 삭제"
                            className="-m-1.5 p-1.5"
                          >
                            <IconTrash size={13} stroke={1.75} color="var(--text-muted)" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2">
                {thread.members && thread.members.length > 0 ? (
                  <MentionInput
                    members={thread.members}
                    value={commentDraft}
                    onChange={setCommentDraft}
                    onSubmit={handleSendComment}
                    placeholder="댓글을 입력해요 (@로 멘션)"
                  />
                ) : (
                  <input
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendComment();
                      }
                    }}
                    placeholder="댓글을 입력해요"
                    maxLength={500}
                    className="min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-4 py-2 text-[13px] outline-none"
                  />
                )}
                <button
                  onClick={handleSendComment}
                  disabled={!commentDraft.trim() || sendingComment}
                  aria-label="댓글 보내기"
                  className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center disabled:opacity-40"
                  style={{ background: "var(--accent)" }}
                >
                  <IconSend2 size={14} stroke={1.75} color="#fff" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {thread && confirmDeleteCommentId && (
        <ConfirmDialog
          title="댓글을 삭제할까요?"
          message="삭제하면 되돌릴 수 없어요."
          onCancel={() => setConfirmDeleteCommentId(null)}
          onConfirm={() => {
            const id = confirmDeleteCommentId;
            setConfirmDeleteCommentId(null);
            deleteComment(thread.bagId, id).catch((err) => {
              console.error("[팩인백] 댓글 삭제 실패:", err);
            });
          }}
        />
      )}

      {thread && reactionPickerCommentTarget && (
        <ReactionPickerPopover
          title={`${reactionPickerCommentTarget.authorNickname}님의 댓글에 반응`}
          reactionDoc={allReactions.find((r) => r.id === `comment_${reactionPickerCommentTarget.commentId}`)}
          currentUid={thread.currentUid}
          onToggle={(emoji, currentlyReacted) => {
            handleToggleCommentReaction(reactionPickerCommentTarget.commentId, emoji, currentlyReacted);
          }}
          onClose={() => setReactionPickerCommentTarget(null)}
        />
      )}
    </Portal>
  );
}
