"use client";

import { useRef, useState } from "react";
import { IconBold, IconMessageCircle2, IconStrikethrough } from "@tabler/icons-react";
import { /* BagReactionDoc, */ Item, /* ReactionEmoji */ } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "./Toast";
// import ReactionPillRow from "./ReactionPillRow";

const DELETE_SWIPE_THRESHOLD = -30;
const DELETE_SWIPE_MAX = -60;
const EDIT_SWIPE_THRESHOLD = 30;
const EDIT_SWIPE_MAX = 60;
const SWIPE_BUTTON_WIDTH = 60;

// 스와이프로 판정되려면 필요한 최소 가로 이동거리 / 세로 대비 배율.
// 가로 이동이 이 거리 이상이면서 세로보다 이 배율만큼 커야만 짐이 슬라이드된다 -
// 스크롤하려고 손가락을 내릴 때 생기는 미세한 가로 흔들림을 걸러내기 위한 값이다.
const SWIPE_INTENT_MIN_PX = 12;
const SWIPE_INTENT_RATIO = 1.6;

// 짐을 다른 팩으로 옮기거나 순서를 바꿀 때 쓰는 롱프레스 드래그 설정.
// 이 시간(ms) 이상 큰 움직임 없이 누르고 있으면 드래그 모드로 진입하고,
// 그전에 손가락이 옆으로 움직이면(스와이프 의도로 판단) 롱프레스를 취소한다.
const LONG_PRESS_MS = 420;
const LONG_PRESS_MOVE_CANCEL_PX = 8;

// 롱프레스 드래그 판정 중에 위/아래로 크게 움직이면 "스크롤하려는 의도"로 보고,
// 이 요소 자체는 touch-action: none이라 브라우저가 자동으로 스크롤해주지 않으므로
// 대신 가장 가까운 스크롤 가능한 조상 엘리먼트를 찾아 수동으로 스크롤시켜준다.
const getScrollParent = (el: HTMLElement | null): HTMLElement | null => {
  let node = el?.parentElement ?? null;
  while (node) {
    const style = window.getComputedStyle(node);
    const canScrollY =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight;
    if (canScrollY) return node;
    node = node.parentElement;
  }
  return null;
};

// touch-action: none 때문에 브라우저가 자체적으로 관성(모멘텀) 스크롤을 붙여주지
// 않아서, 손가락을 떼는 순간 스크롤이 뚝 끊기는 문제가 있었다. 아래는 손가락을 뗄 때
// 마지막 속도를 이용해 감속하며 계속 스크롤되는 모멘텀을 직접 흉내내는 로직이다.
// 스크롤 부모(HTMLElement)별로 진행 중인 애니메이션 프레임 id를 저장해서, 같은
// 컨테이너에서 새 스크롤/플릭이 시작되면 이전 모멘텀을 취소하고 이어받는다.
const momentumFrames = new WeakMap<HTMLElement, number>();

const MOMENTUM_MIN_START_VELOCITY = 0.02; // px/ms - 이보다 느리면 모멘텀 시작 안함
const MOMENTUM_MIN_STOP_VELOCITY = 0.01; // px/ms - 이보다 느려지면 모멘텀 종료
const MOMENTUM_MAX_VELOCITY = 3.5; // px/ms - 너무 빠른 튐 방지용 상한
const MOMENTUM_FRICTION_PER_16MS = 0.94; // 한 프레임(약 16ms)당 남는 속도 비율

const cancelMomentumScroll = (parent: HTMLElement | null | undefined) => {
  if (!parent) return;
  const existing = momentumFrames.get(parent);
  if (existing !== undefined) {
    cancelAnimationFrame(existing);
    momentumFrames.delete(parent);
  }
};

const startMomentumScroll = (parent: HTMLElement, initialVelocity: number) => {
  cancelMomentumScroll(parent);
  const clamped = Math.max(
    -MOMENTUM_MAX_VELOCITY,
    Math.min(MOMENTUM_MAX_VELOCITY, initialVelocity)
  );
  if (Math.abs(clamped) < MOMENTUM_MIN_START_VELOCITY) return;

  let velocity = clamped;
  let lastTime = performance.now();

  const step = (now: number) => {
    const dt = Math.min(now - lastTime, 48); // 탭 전환 등으로 인한 큰 dt 스파이크 방지
    lastTime = now;

    parent.scrollTop += velocity * dt;
    velocity *= Math.pow(MOMENTUM_FRICTION_PER_16MS, dt / 16.67);

    if (Math.abs(velocity) < MOMENTUM_MIN_STOP_VELOCITY) {
      momentumFrames.delete(parent);
      return;
    }
    momentumFrames.set(parent, requestAnimationFrame(step));
  };

  momentumFrames.set(parent, requestAnimationFrame(step));
};

// 텍스트 항목 색상 팔레트. "" 는 기본 색상(리셋)을 의미.
// 짐 추가/수정 모달(ItemFormModal)에서도 동일 팔레트를 써서 export.
export const TEXT_COLORS = ["", "#ef4444", "#f97316", "#22c55e", "#3b82f6", "#a855f7"];

// 설정 > 화면설정 > 팩 크기(--pack-card-scale)에 맞춰 패딩/아이콘/체크박스 크기를
// 조절한다. 글자 크기는 별도인 --pack-card-font-scale(설정 > 팩 카드 글씨 크기)을
// 따로 곱해서 카드 크기와 독립적으로 조절할 수 있다 (둘 다 --font-scale-factor(설정 >
// 글자 크기)까지 같이 곱해진다).
export default function ItemRow({
  item,
  onToggle,
  onChangeText,
  onDelete,
  onEdit,
  onStartDrag,
  isDragSource,
  isDragOverTarget,
  dragOverPosition,
  noBackground,
  roundCheckbox,
  disabled,
  onRowTap,
  commentCount,
  onOpenThread,
  /*
  reactionDoc,
  currentUid,
  onToggleReaction,
  onOpenReactionPicker,
  */
}: {
  item: Item;
  onToggle?: () => void;
  onChangeText: (
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string }
  ) => void;
  onDelete: () => void;
  onEdit?: () => void;
  onStartDrag?: (clientX: number, clientY: number) => void;
  isDragSource?: boolean;
  isDragOverTarget?: boolean;
  dragOverPosition?: "before" | "after" | null;
  noBackground?: boolean;
  // true면 체크박스를 사각형 대신 아이폰 메모장처럼 얻은 둘레 모양으로 보여준다.
  // 메모장뷰(NotebookPackSection)에서만 쓴다.
  roundCheckbox?: boolean;
  disabled?: boolean;
  onRowTap?: () => void;
  // 이 짐에 달린 댓글 수(0이면 아이콘만, 있으면 숫자 배지). 없으면(undefined) 댓글
  // 버튼 자체를 숨긴다 - 다중선택 등 이 버튼이 없어야 하는 맥락에서 그냥 prop을 안 넘기면 된다.
  // 이 짐에 달린 댓글 수(0이면 아이콘만, 있으면 숫자 배지). 없으면(undefined) 댓글
  // 버튼 자체를 숨긴다 - 다중선택 등 이 버튼이 없어야 하는 맥락에서 그냥 prop을 안 넘기면 된다.
  commentCount?: number;
  onOpenThread?: () => void;
  // 팀즈 스타일로 짐 바로 아래 겹쳐 보여줄 이모지 리액션. 셋 다 있어야 렌더링된다.
  /*
  reactionDoc?: BagReactionDoc;
  currentUid?: string;
  onToggleReaction?: (emoji: ReactionEmoji, currentlyReacted: boolean) => void;
  onOpenReactionPicker?: () => void;
  */
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(!onEdit && item.text === "");
  const [draft, setDraft] = useState(item.text);
  const [draftBold, setDraftBold] = useState(!!item.bold);
  const [draftStrike, setDraftStrike] = useState(!!item.strike);
  const [draftColor, setDraftColor] = useState(item.color || "");
  const { profile } = useAuth();
  const { show: showToast } = useToast();
  // 설정 > 팩 설정에서 고르는 짐 최대 표시 줄 수(1~3, 없으면 1줄 기본값)와
  // 더블클릭 복사 토스트 노출 시간(3~7초, 없으면 3초 기본값). 모든 짐에 공통 적용된다.
  const itemMaxLines = profile?.packSettings?.itemMaxLines ?? 1;
  const copyToastSeconds = profile?.packSettings?.itemCopyToastSeconds ?? 3;
  const lineClampClass =
    itemMaxLines === 3 ? "line-clamp-3" : itemMaxLines === 2 ? "line-clamp-2" : "line-clamp-1";

  // 다중선택 모드 중엔 같은 짐을 빠르게 두 번 누르면(더블클릭 속도) 두 번째 탭을 무시한다 -
  // 안 그러면 선택->선택해제가 순식간에 일어나 다중선택 모드가 풀리면서, 동시에 아래
  // handleDoubleClick(복사)까지 겹쳐 실행되는 문제가 있었다.
  const lastTapTimeRef = useRef(0);
  const RAPID_TAP_GUARD_MS = 350;

  // 짐을 더블클릭하면 내용을 클립보드에 복사하고, 무슨 내용이 복사됐는지 토스트로 알려준다.
  // 다중선택 모드(disabled) 중에는 복사 대신 선택 토글이 우선이므로 더블클릭 복사를 막는다.
  const handleDoubleClick = () => {
    if (disabled) return;
    if (!item.text) return;
    navigator.clipboard
      .writeText(item.text)
      .then(() => {
        showToast(`"${item.text}" 복사됨`, { durationMs: copyToastSeconds * 1000 });
      })
      .catch(() => {
        showToast("복사 실패", { durationMs: copyToastSeconds * 1000 });
      });
  };
  const startX = useRef(0);
  const startY = useRef(0);
  const lastY = useRef(0);
  const baseOffset = useRef(0);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const scrollParentRef = useRef<HTMLElement | null | undefined>(undefined);
  const scrollingRef = useRef(false);
  // 스크롤 중 손가락 속도(px/ms)를 추적해서, 손을 뗄 때 모멘텀 스크롤에 넘겨준다.
  const velocityRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  // 마우스(웹)로 스와이프한 직후, pointerup 다음에 브라우저가 같은 엘리먼트 위에서
  // 자동으로 click 이벤트를 한 번 더 발생시킨다 (터치와 달리 마우스는 드래그 후에도
  // click이 억제되지 않음). 이 click이 그대로 하단 버튼의 onClick(닫기/탭 처리)으로
  // 이어져서, 스와이프로 열어놓은 수정/삭제 버튼이 열리자마자 다시 닫혀버리는
  // 문제가 있었다. 실제 스와이프 동작이 있었는지를 이 ref로 기록해뒀다가, 뒤이어
  // 오는 click 한 번은 무시하도록 한다.
  const swipedRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (editing) return;
    if (disabled) {
      // 다중선택 모드 중에도 롱프레스만은 감지한다(스와이프는 여전히 막은 채로) -
      // 이미 선택된 항목이면 그룹 이동 시작용으로, 아니면 선택 추가용으로 부모가 판단한다.
      // 이 행 자체가 touch-action: none이라 브라우저가 세로 스크롤을 대신 해주지
      // 않으므로, 아래 handlePointerMove의 disabled 분기에서 수동 스크롤을 처리할 수
      // 있도록 관련 ref들도 여기서 같이 초기화해둔다 (안 하면 다중선택 모드에서 해당
      // 팩만 스크롤이 안 되는 문제가 있었다).
      startX.current = e.clientX;
      startY.current = e.clientY;
      lastY.current = e.clientY;
      lastMoveTimeRef.current = e.timeStamp;
      velocityRef.current = 0;
      scrollingRef.current = false;
      scrollParentRef.current = undefined;
      longPressTriggered.current = false;
      if (onStartDrag) {
        const x = e.clientX;
        const y = e.clientY;
        longPressTimer.current = window.setTimeout(() => {
          longPressTriggered.current = true;
          onStartDrag(x, y);
        }, LONG_PRESS_MS);
      }
      return;
    }
    startX.current = e.clientX;
    startY.current = e.clientY;
    lastY.current = e.clientY;
    lastMoveTimeRef.current = e.timeStamp;
    velocityRef.current = 0;
    baseOffset.current = dragX;
    setDragging(true);
    longPressTriggered.current = false;
    scrollingRef.current = false;
    scrollParentRef.current = undefined;
    // 새 제스처가 시작되면 이전 스와이프 여부 플래그를 초기화한다.
    swipedRef.current = false;

    // 체크박스를 제외한 영역(글씨 포함)을 길게 누르고 있으면 드래그 모드로 진입한다.
    if (onStartDrag) {
      const x = e.clientX;
      const y = e.clientY;
      longPressTimer.current = window.setTimeout(() => {
        longPressTriggered.current = true;
        setDragging(false);
        setDragX(0);
        onStartDrag(x, y);
      }, LONG_PRESS_MS);
    }
  };

  const trackScrollVelocity = (clientY: number, timeStamp: number, deltaY: number) => {
    const dt = timeStamp - lastMoveTimeRef.current;
    if (dt > 0) {
      // 순간 속도를 그대로 쓰면 손떨림에 취약하니, 이전 값과 섞어 부드럽게 만든다.
      const instant = -deltaY / dt;
      velocityRef.current = velocityRef.current * 0.7 + instant * 0.3;
    }
    lastMoveTimeRef.current = timeStamp;
    lastY.current = clientY;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (disabled) {
      if (longPressTriggered.current) return;
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;
      const movedEnough =
        Math.abs(dx) > LONG_PRESS_MOVE_CANCEL_PX || Math.abs(dy) > LONG_PRESS_MOVE_CANCEL_PX;
      if (movedEnough) clearLongPressTimer();

      // 다중선택 모드에서도 이 행은 touch-action: none이라 브라우저 스크롤이 안 붙는다.
      // 아래는 일반(비선택) 모드의 스크롤 처리와 동일한 로직으로, 세로 움직임을 감지해서
      // 가장 가까운 스크롤 부모를 수동으로 스크롤시켜준다.
      if (scrollingRef.current) {
        if (scrollParentRef.current === undefined) {
          scrollParentRef.current = getScrollParent(e.currentTarget as HTMLElement);
        }
        const parent = scrollParentRef.current;
        if (parent) {
          const deltaY = e.clientY - lastY.current;
          parent.scrollTop -= deltaY;
          trackScrollVelocity(e.clientY, e.timeStamp, deltaY);
        }
        return;
      }

      if (movedEnough && Math.abs(dy) >= Math.abs(dx)) {
        scrollingRef.current = true;
        if (scrollParentRef.current === undefined) {
          scrollParentRef.current = getScrollParent(e.currentTarget as HTMLElement);
        }
        const parent = scrollParentRef.current;
        if (parent) {
          cancelMomentumScroll(parent);
          const deltaY = e.clientY - lastY.current;
          parent.scrollTop -= deltaY;
          trackScrollVelocity(e.clientY, e.timeStamp, deltaY);
        }
      }
      return;
    }
    if (!dragging || longPressTriggered.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    // 옆으로든 위아래로든 일정 거리 이상 움직이면 스와이프/스크롤 의도로 보고
    // 롱프레스(드래그 시작) 타이머를 취소한다.
    const movedEnough =
      Math.abs(dx) > LONG_PRESS_MOVE_CANCEL_PX || Math.abs(dy) > LONG_PRESS_MOVE_CANCEL_PX;
    if (movedEnough) clearLongPressTimer();

    // 이미 스크롤로 확정된 상태면 그대로 스크롤 처리를 이어간다.
    if (scrollingRef.current) {
      if (scrollParentRef.current === undefined) {
        scrollParentRef.current = getScrollParent(e.currentTarget as HTMLElement);
      }
      const parent = scrollParentRef.current;
      if (parent) {
        const deltaY = e.clientY - lastY.current;
        parent.scrollTop -= deltaY;
        trackScrollVelocity(e.clientY, e.timeStamp, deltaY);
      }
      return;
    }

    // 가로 스와이프 의도인지 판단한다: 최소 이동거리(SWIPE_INTENT_MIN_PX) 이상이고,
    // 세로보다 확실히(SWIPE_INTENT_RATIO배) 커야 스와이프로 인정한다. 스크롤하려고
    // 손가락을 내릴 때 생기는 미세한 가로 흔들림에도 짐이 슬쩍 밀리던 오탐을 막기 위함이다.
    const isHorizontalSwipe =
      Math.abs(dx) >= SWIPE_INTENT_MIN_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_INTENT_RATIO;

    if (!isHorizontalSwipe) {
      // 세로 움직임이 가로와 같거나 크면 스크롤 의도로 확정한다.
      // (아직 애매한(둘 다 작은 거리) 경우엔 이번 이벤트는 그냥 대기한다.)
      if (movedEnough && Math.abs(dy) >= Math.abs(dx)) {
        scrollingRef.current = true;
        if (scrollParentRef.current === undefined) {
          scrollParentRef.current = getScrollParent(e.currentTarget as HTMLElement);
        }
        const parent = scrollParentRef.current;
        if (parent) {
          // 이 컨테이너에서 이전 플릭의 관성 스크롤이 아직 돌고 있었다면 취소하고
          // 새 손가락 움직임이 이어받도록 한다 (안 그러면 서로 충돌해 덜컹거린다).
          cancelMomentumScroll(parent);
          const deltaY = e.clientY - lastY.current;
          parent.scrollTop -= deltaY;
          trackScrollVelocity(e.clientY, e.timeStamp, deltaY);
        }
      }
      return;
    }

    // 실제로 가로 스와이프가 인정된 시점이므로, 뒤이어 오는 click 한 번을
    // 무시하도록 플래그를 세워둔다 (마우스 드래그 종료 시 브라우저가 자동 발생시키는
    // click이 열려있는 버튼을 즉시 닫아버리는 것을 막기 위함).
    swipedRef.current = true;

    const next = Math.min(EDIT_SWIPE_MAX, Math.max(DELETE_SWIPE_MAX, baseOffset.current + dx));
    setDragX(next);
  };

  const endDrag = () => {
    clearLongPressTimer();
    const wasScrolling = scrollingRef.current;
    const parent = scrollParentRef.current;
    scrollingRef.current = false;
    // 스크롤 중이었다면 손을 뗄 때의 속도로 관성 스크롤을 이어간다 (네이티브 스크롤처럼
    // 손을 뗀 뒤에도 관성으로 미끄러지듯 계속 움직이게 함).
    if (wasScrolling && parent) {
      startMomentumScroll(parent, velocityRef.current);
    }
    if (!dragging) return;
    setDragging(false);
    setDragX((current) => {
      if (current <= DELETE_SWIPE_THRESHOLD) return DELETE_SWIPE_MAX;
      if (current >= EDIT_SWIPE_THRESHOLD) return EDIT_SWIPE_MAX;
      return 0;
    });
  };

  const commitEdit = () => {
    setEditing(false);
    if (draft.trim() === "") {
      onDelete();
      return;
    }
    const styleChanged =
      item.type === "text" &&
      (draftBold !== !!item.bold ||
        draftStrike !== !!item.strike ||
        draftColor !== (item.color || ""));
    if (draft !== item.text || styleChanged) {
      onChangeText(
        draft,
        item.type === "text"
          ? {
              bold: draftBold,
              strike: draftStrike,
              color: draftColor || undefined,
            }
          : undefined
      );
    }
  };

  const openEdit = () => {
    if (onEdit) {
      onEdit();
      return;
    }
    setDraft(item.text);
    setDraftBold(!!item.bold);
    setDraftStrike(!!item.strike);
    setDraftColor(item.color || "");
    setEditing(true);
  };

  const closeSwipeIfOpen = () => {
    if (dragX !== 0) setDragX(0);
  };

  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

  // 콘텐츠(글씨) 영역 클릭 처리. 마우스로 스와이프한 직후 브라우저가 자동으로 쏘는
  // click 한 번은 swipedRef로 걸러내고, 그 다음부터는 원래 동작(탭 콜백 또는 스와이프
  // 닫기)을 그대로 수행한다.
  const handleContentClick = () => {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    if (onRowTap) {
      const now = Date.now();
      if (now - lastTapTimeRef.current < RAPID_TAP_GUARD_MS) return;
      lastTapTimeRef.current = now;
      onRowTap();
      return;
    }
    closeSwipeIfOpen();
  };

  return (
    <div
      className={`shrink-0 ${item.type === "text" ? "col-span-full" : ""}`}
    >
      <div className="relative overflow-hidden rounded-lg">
        {(dragging || dragX !== 0) && dragX < 0 && (
          <button
            onClick={() => {
              setDragX(0);
              onDelete();
            }}
            className="absolute right-0 top-0 h-full flex items-center justify-center text-[calc(13px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))]"
            style={{ width: SWIPE_BUTTON_WIDTH, background: "var(--danger)", color: "#fff" }}
          >
            삭제
          </button>
        )}

        {(dragging || dragX !== 0) && dragX > 0 && (
          <button
            onClick={() => {
              setDragX(0);
              openEdit();
            }}
            className="absolute left-0 top-0 h-full flex items-center justify-center text-[calc(13px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))]"
            style={{ width: SWIPE_BUTTON_WIDTH, background: "#2563eb", color: "#fff" }}
          >
            수정
          </button>
        )}

        <div
          data-item-id={item.id}
          data-item-type={item.type}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onPointerCancel={endDrag}
          onContextMenu={(e) => {
            if (onStartDrag) e.preventDefault();
          }}
          style={{
            transform: `translateX(${dragX}px)`,
            transition: dragging ? "none" : "transform 150ms ease",
            background: noBackground ? "transparent" : item.type === "check" ? "var(--surface-2)" : "transparent",
            opacity: isDragSource ? 0.35 : 1,
            WebkitTouchCallout: "none",
            WebkitUserSelect: onStartDrag ? "none" : undefined,
            userSelect: onStartDrag ? "none" : undefined,
            boxShadow: isDragOverTarget
              ? item.type === "text"
                ? dragOverPosition === "after"
                  ? "inset 0 -2px 0 0 var(--accent)"
                  : "inset 0 2px 0 0 var(--accent)"
                : dragOverPosition === "after"
                ? "inset -2px 0 0 0 var(--accent)"
                : "inset 2px 0 0 0 var(--accent)"
              : undefined,
            touchAction: "none",
          }}
          className={`flex items-center gap-2 rounded-lg px-[calc(12px*var(--pack-card-scale,1))] md:px-[calc(14px*var(--pack-card-scale,1))] ${
            noBackground
              ? "py-[calc(6px*var(--pack-card-scale,1))] md:py-[calc(7px*var(--pack-card-scale,1))]"
              : "py-[calc(12px*var(--pack-card-scale,1))] md:py-[calc(14px*var(--pack-card-scale,1))]"
          }`}
        >
          {item.type === "check" && (
            <input
              type="checkbox"
              checked={!!item.checked}
              onChange={onToggle}
              onPointerDown={(e) => e.stopPropagation()}
              className={roundCheckbox ? "shrink-0 appearance-none rounded-full" : "shrink-0 accent-[var(--accent)]"}
              style={
                roundCheckbox
                  ? {
                      width: "calc(20px * var(--pack-card-scale,1))",
                      height: "calc(20px * var(--pack-card-scale,1))",
                      border: `1.5px solid ${item.checked ? "var(--accent)" : "var(--border-strong)"}`,
                      background: item.checked ? "var(--accent)" : "transparent",
                    }
                  : {
                      width: "calc(20px * var(--pack-card-scale,1))",
                      height: "calc(20px * var(--pack-card-scale,1))",
                    }
              }
            />
          )}

          {editing ? (
            item.type === "text" ? (
              <div className="min-w-0 flex-1 flex flex-col gap-2">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                  placeholder="텍스트 입력"
                  className="min-w-0 w-full bg-transparent text-[calc(17px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))] md:text-[calc(18px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))] leading-normal py-2 md:py-2.5 outline-none"
                  style={{
                    fontWeight: draftBold ? 700 : 400,
                    textDecoration: draftStrike ? "line-through" : "none",
                    color: draftColor || "var(--foreground)",
                  }}
                />
                <div className="flex items-center flex-wrap gap-2 md:gap-2.5">
                  <button
                    type="button"
                    onMouseDown={preventBlur}
                    onClick={() => setDraftBold((b) => !b)}
                    aria-label="굵게"
                    className="flex items-center justify-center rounded shrink-0"
                    style={{
                      background: draftBold ? "var(--accent)" : "var(--surface)",
                      color: draftBold ? "#fff" : "var(--text-secondary)",
                      width: "calc(28px * var(--pack-card-scale,1))",
                      height: "calc(28px * var(--pack-card-scale,1))",
                    }}
                  >
                    <IconBold size={16} stroke={2.25} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={preventBlur}
                    onClick={() => setDraftStrike((s) => !s)}
                    aria-label="취소선"
                    className="flex items-center justify-center rounded shrink-0"
                    style={{
                      background: draftStrike ? "var(--accent)" : "var(--surface)",
                      color: draftStrike ? "#fff" : "var(--text-secondary)",
                      width: "calc(28px * var(--pack-card-scale,1))",
                      height: "calc(28px * var(--pack-card-scale,1))",
                    }}
                  >
                    <IconStrikethrough size={16} stroke={2.25} />
                  </button>
                  <span
                    className="shrink-0"
                    style={{ width: 1, height: 17, background: "var(--border)" }}
                  />
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c || "default"}
                      type="button"
                      onMouseDown={preventBlur}
                      onClick={() => setDraftColor(c)}
                      aria-label={c ? `색상 ${c}` : "기본 색상"}
                      className="rounded-full shrink-0"
                      style={{
                        background: c || "var(--surface)",
                        border:
                          draftColor === c
                            ? "1.5px solid var(--foreground)"
                            : "1.5px solid var(--border-strong)",
                        width: "calc(22px * var(--pack-card-scale,1))",
                        height: "calc(22px * var(--pack-card-scale,1))",
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                placeholder="짐 이름"
                className="min-w-0 flex-1 bg-transparent text-[calc(17px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))] md:text-[calc(18px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))] leading-normal py-2 md:py-2.5 outline-none"
              />
            )
          ) : (
            <button
              onClick={handleContentClick}
              onDoubleClick={handleDoubleClick}
              // 줄바꿈 제한(line-clamp)은 이 button 자체가 아니라 안의 span에 건다 - 이 button은 부모 div의
              // flex 자식(flex-1)이라, -webkit-line-clamp가 요구하는 display:-webkit-box를
              // flex 아이템에 직접 걸면 일부 브라우저(iOS WKWebView 포함)에서 줄수 제한이
              // 무시되고 텍스트가 그대로 여러 줄 다 보여버리는 버그가 있었다. span은 flex 아이템이
              // 아니라 문제가 없다.
              className="min-w-0 flex-1 text-left text-[calc(17px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))] md:text-[calc(18px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))]"
            >
              {item.type === "check" ? (
                <span
                  className={lineClampClass}
                  style={{
                    color: item.checked ? "var(--text-muted)" : "var(--foreground)",
                    textDecoration: item.checked ? "line-through" : "none",
                  }}
                >
                  {item.text}
                </span>
              ) : (
                <span
                  className={lineClampClass}
                  style={{
                    fontWeight: item.bold ? 700 : 400,
                    textDecoration: item.strike ? "line-through" : "none",
                    color: item.color || "var(--foreground)",
                  }}
                >
                  {item.text}
                </span>
              )}
            </button>
          )}

          {!editing && onOpenThread && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDragX(0);
                onOpenThread();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="댓글"
              className="relative shrink-0 flex items-center justify-center"
              style={{ width: 22, height: 22, transform: "scale(var(--pack-card-scale,1))" }}
            >
              <IconMessageCircle2
                size={16}
                stroke={1.75}
                color={commentCount ? "var(--accent)" : "var(--text-muted)"}
              />
              {!!commentCount && (
                <span
                  className="absolute -top-1 -right-1 min-w-[13px] h-[13px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  {commentCount > 9 ? "9+" : commentCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 팀즈 스타일 이모지 리액션 - 짐 바로 아래에 살짝 겹쳐서 떠있는 알약들.
          탭하면 댓글 스레드에 안 들어가고 바로 이 자리에서 토글된다. */}
      {/*
      {!editing && onToggleReaction && onOpenReactionPicker && (
        <ReactionPillRow
          reactionDoc={reactionDoc}
          currentUid={currentUid ?? ""}
          onToggle={onToggleReaction}
          onOpenPicker={onOpenReactionPicker}
        />
      )}
      */}
    </div>
  );
}
