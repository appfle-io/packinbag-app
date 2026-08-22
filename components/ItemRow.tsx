"use client";

import { useRef, useState } from "react";
import { /* BagReactionDoc, */ Item, RichSpan, /* ReactionEmoji */ } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "./Toast";
import { isShortUrlFeatureEnabled } from "@/lib/shortLinkService";
import { formatItemDueLabel, getDueUrgency, getDueIntensifyPercent } from "@/lib/dday";
import LinkifiedText from "./LinkifiedText";
import ItemRichTextField from "./ItemRichTextField";
import { getItemSpans, spansToPlainText } from "@/lib/richText";
import { IconUser } from "@tabler/icons-react";
// import ReactionPillRow from "./ReactionPillRow";

const DELETE_SWIPE_THRESHOLD = -30;
const DELETE_SWIPE_MAX = -60;
const SWIPE_BUTTON_WIDTH = 60;

// 스와이프로 판정되려면 필요한 최소 가로 이동거리 / 세로 대비 배율.
// 가로 이동이 이 거리 이상이면서 세로보다 이 배율만큼 커야만 짐이 슬라이드된다 -
// 스크롤하려고 손가락을 내릴 때 생기는 미세한 가로 흔들림을 걸러내기 위한 값이다.
const SWIPE_INTENT_MIN_PX = 12;
const SWIPE_INTENT_RATIO = 1.6;

// 짐을 다른 팩으로 옮기거나 순서를 바꿀 때 쓰는 롱프레스 드래그 설정.
// 이 시간(ms) 이상 큰 움직임 없이 누르고 있으면 드래그 모드로 진입하고,
// 그전에 손가락이 옆으로 움직이면(스와이프 의도로 판단) 롱프레스를 취소한다.
const LONG_PRESS_MS = 300;
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
  ddayCountTodayAsDayOne,
  assigneeNickname,
  onClickAssignee,
  /*
  reactionDoc,
  currentUid,
  onToggleReaction,
  onOpenReactionPicker,
  */
}: {
  item: Item;
  assigneeNickname?: string;
  onClickAssignee?: () => void;
  onToggle?: () => void;
  onChangeText: (
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string; spans?: RichSpan[] }
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
  // 이 짐에 달린 댓글 수. 있으면 짐 내용에 밑줄(underline)이 붙는다(hasComment). 댓글 자체는 더블탭으로
  // 열리는 통합 모달(ItemEditModal) 안에서 보고 쓴다 - 이 컴포넌트에는 댓글 열기 버튼이 따로 없다.
  commentCount?: number;
  // 이 짐이 속한 가방의 D-day 계산 기준(당일도 "1일째"로 세는지). 짐 단위
  // 마감일(item.dueDate) 뱃지가 가방 상단 D-day와 같은 기준으로 보이도록 받는다.
  ddayCountTodayAsDayOne?: boolean;
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
  const [draftSpans, setDraftSpans] = useState(() => getItemSpans(item));
  const [draftColor, setDraftColor] = useState(item.color || "");
  // "추가" 모드에서 저장 후 입력창을 비우고 다시 포커스를 줄 때, ItemRichTextField를 새로
  // 마운트시켜서(autoFocus) 초기화하기 위한 키.
  const [draftResetKey, setDraftResetKey] = useState(0);
  const { profile, user } = useAuth();
  const { show: showToast } = useToast();
  const shortUrlFeatureEnabled = isShortUrlFeatureEnabled(user?.email, profile);
  // 설정 > 팩 설정에서 고르는 짐 최대 표시 줄 수(1~3, 없으면 1줄 기본값). 모든 짐에 공통 적용된다.
  // (예전엔 더블클릭 복사 토스트 노출 시간 설정도 여기 있었는데, 더블클릭이 복사 대신
  // 수정 모달을 열도록 바뀌면서 그 설정 값은 더 이상 쓰이지 않는다.)
  const itemMaxLines = profile?.packSettings?.itemMaxLines ?? 1;
  const lineClampClass =
    itemMaxLines === 3 ? "line-clamp-3" : itemMaxLines === 2 ? "line-clamp-2" : "line-clamp-1";
  // 짐 마감일 뱃지 라벨. dueDate가 없으면 null이라 아래에서 자연히 숨겨진다.
  const dueDisplayMode = profile?.packSettings?.dueDateDisplayMode ?? "dday";
  const dueLabel = formatItemDueLabel(item.dueDate, dueDisplayMode, ddayCountTodayAsDayOne);
  // 마감일 뱃지 색상. "다가올수록 진하게" 옵션(기본값 ON)이 켜져 있으면 muted에서
  // 새빨간색(--danger)으로 이어지는 연속적인 그라데이션으로, 꺼져있으면 지난(--danger)/임박(--accent)/평소(muted)
  // 3단계로만 구분하는 이전 방식으로 동작한다.
  const dueIntensifyEnabled = profile?.packSettings?.dueDateIntensifyEnabled ?? true;
  const dueIntensifyDays = profile?.packSettings?.dueDateIntensifyDays ?? 7;
  const dueUrgency = getDueUrgency(item.dueDate);
  const dueLabelColor = dueIntensifyEnabled
    ? `color-mix(in srgb, var(--danger) ${getDueIntensifyPercent(item.dueDate, dueIntensifyDays)}%, var(--text-muted))`
    : dueUrgency === "overdue"
    ? "var(--danger)"
    : dueUrgency === "soon"
    ? "var(--accent)"
    : "var(--text-muted)";

  // 댓글이 달려있는지는 짐 내용 밑줄(underline)로만 조용히 표시한다 - 아이콘/배지를 따로 둘지 않으니
  // 플렉스 폭을 전혀 침범하지 않고(텍스트 잘림 문제 없음), 취소선(strike)과도 함께 보일 수 있다.
  const hasComment = !editing && !!commentCount;

  // 다중선택 모드 중엔 같은 짐을 빠르게 두 번 누르면(더블클릭 속도) 두 번째 탭을 무시한다 -
  // 안 그러면 선택->선택해제가 순식간에 일어나 다중선택 모드가 풀리면서, 동시에 아래
  // handleDoubleClick(수정 모달 열기)까지 겹쳐 실행되는 문제가 있었다.
  const lastTapTimeRef = useRef(0);
  const RAPID_TAP_GUARD_MS = 350;

  // 짐을 더블클릭하면 수정 모달(또는 인라인 편집)을 연다. 예전엔 클립보드 복사였는데,
  // 스와이프에서 수정 버튼 자리가 댓글로 바뀌면서 수정 진입 동선이 더블탭으로 옮겨왔다.
  // 다중선택 모드(disabled) 중에는 편집 대신 선택 토글이 우선이므로 막는다.
  // preventDefault를 호출하는 이유: 그냥 return만 하면 JS 동작만 막힐 뿐, 브라우저가
  // 더블클릭 시 기본으로 수행하는 텍스트 선택(하이라이트)은 그대로 일어난다 - 선택 모드 중에
  // 짐 텍스트가 계속 하이라이트되어 보이는 게 어색했던 문제.
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    openEdit();
  };
  const startX = useRef(0);
  const startY = useRef(0);
  const lastY = useRef(0);
  const baseOffset = useRef(0);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const scrollParentRef = useRef<HTMLElement | null | undefined>(undefined);
  const scrollingRef = useRef(false);
  // React fires onPointerMove for hover too, even with no mouse button pressed.
  // In selection mode (disabled) there's no `dragging` state to gate on, so track
  // whether a button/touch is actually down in this ref (set true in handlePointerDown,
  // false in endDrag). Without this, once every pack becomes disabled=true (selection mode
  // active), moving the mouse with no button pressed over any row would still run the
  // manual-scroll logic below and make the list scroll as if following the cursor.
  const pointerActiveRef = useRef(false);
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
      pointerActiveRef.current = true;
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
    pointerActiveRef.current = true;
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
      if (!pointerActiveRef.current || longPressTriggered.current) return;
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

    // 오른쪽 스와이프는 더 이상 쓰이지 않는다(수정/댓글은 더블탭 통합 모달로 이동) -
    // 오른쪽으로는 0까지만, 왼쪽(삭제)으로는 그대로 허용한다.
    const next = Math.min(0, Math.max(DELETE_SWIPE_MAX, baseOffset.current + dx));
    setDragX(next);
  };

  const endDrag = () => {
    clearLongPressTimer();
    pointerActiveRef.current = false;
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
      return 0;
    });
  };

  const commitEdit = () => {
    if (item.type === "text") {
      const plainText = spansToPlainText(draftSpans);
      if (plainText.trim() === "") {
        setEditing(false);
        onDelete();
        return;
      }
      const styleChanged =
        plainText !== item.text ||
        draftSpans.some((s) => s.bold) !== !!item.bold ||
        draftSpans.some((s) => s.strike) !== !!item.strike ||
        draftColor !== (item.color || "");
      setEditing(false);
      if (styleChanged) {
        onChangeText(plainText, {
          bold: draftSpans.some((s) => s.bold),
          strike: draftSpans.some((s) => s.strike),
          color: draftColor || undefined,
          spans: draftSpans,
        });
      }
      return;
    }
    setEditing(false);
    if (draft.trim() === "") {
      onDelete();
      return;
    }
    if (draft !== item.text) {
      onChangeText(draft);
    }
  };

  const openEdit = () => {
    if (onEdit) {
      onEdit();
      return;
    }
    setDraft(item.text);
    setDraftSpans(getItemSpans(item));
    setDraftColor(item.color || "");
    setDraftResetKey((k) => k + 1);
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
    // 마우스(웹)에서 롱프레스로 onStartDrag(다중선택 진입/그룹드래그 시작)가 이미
    // 실행된 뒤에도, 손을 뗄 때 브라우저가 같은 엘리먼트에 click을 한 번 더 발생시킨다
    // (터치와 달리 마우스는 롱프레스 후에도 click이 억제되지 않음). 이 click이 그대로
    // onRowTap(선택 토글)으로 이어지면, 방금 롱프레스로 선택된 짐이 바로 다시 선택
    // 해제되면서 다중선택 모드에 들어가자마자 풀려버리는 문제가 있었다.
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
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
            className="absolute right-0 top-0 h-full flex items-center justify-end overflow-hidden text-[calc(13px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))]"
            style={{
              // 밀린 만큼만 보이도록 실제 드래그 거리에 비례해서 너비를 키운다
              // (버튼 크기(SWIPE_BUTTON_WIDTH)만큼 다 밀어야 전체가 노출됨). 버튼이
              // 오른쪽에 고정된 채 왼쪽으로 넓어지므로, 안의 라벨도 오른쪽 기준으로
              // 고정해서(justify-end) 밀린 만큼 왼쪽부터 드러나 보이게 한다.
              width: Math.min(SWIPE_BUTTON_WIDTH, Math.abs(dragX)),
              background: "var(--danger)",
              color: "#fff",
            }}
          >
            <span style={{ width: SWIPE_BUTTON_WIDTH }} className="shrink-0 flex items-center justify-center">
              삭제
            </span>
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
                <ItemRichTextField
                  key={draftResetKey}
                  initialSpans={draftSpans}
                  placeholder="텍스트 입력"
                  autoFocus
                  onChange={({ spans }) => setDraftSpans(spans)}
                  onCommit={commitEdit}
                />
                <div className="flex items-center flex-wrap gap-2 md:gap-2.5">
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
            <div
              role="button"
              tabIndex={0}
              onClick={handleContentClick}
              onDoubleClick={handleDoubleClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleContentClick();
              }}
              // 줄바꿈 제한(line-clamp)은 이 요소 자체가 아니라 안의 span에 건다 - 부모 div의
              // flex 자식(flex-1)이라, -webkit-line-clamp가 요구하는 display:-webkit-box를
              // flex 아이템에 직접 걸면 일부 브라우저(iOS WKWebView 포함)에서 줄수 제한이
              // 무시되고 텍스트가 그대로 여러 줄 다 보여버리는 버그가 있었다. span은 flex 아이템이
              // 아니라 문제가 없다. 링크 클릭 시 부모의 탭 동작(수정 진입/선택 토글)이 같이
              // 실행되지 않아야 해서(LinkifiedText 안의 <a>가 stopPropagation함), button 대신
              // div+role="button"으로 바꿨다 (<a>를 <button> 안에 중첩하는 건 유효하지 않은 HTML).
              className="min-w-0 flex-1 text-left cursor-pointer text-[calc(17px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))] md:text-[calc(18px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))]"
            >
              {item.type === "check" ? (
                <span
                  className={lineClampClass}
                  style={{
                    color: item.checked ? "var(--text-muted)" : "var(--foreground)",
                    textDecoration: [item.checked && "line-through", hasComment && "underline"]
                      .filter(Boolean)
                      .join(" ") || "none",
                  }}
                >
                  <LinkifiedText
                    text={item.text}
                    user={user}
                    shortenEnabled={shortUrlFeatureEnabled}
                    onReplace={(original, shortUrl) => {
                      if (!item.text.includes(original)) return;
                      onChangeText(item.text.replace(original, shortUrl));
                      showToast("링크를 짧게 줄였어요");
                    }}
                  />
                </span>
              ) : (
                <span
                  className={lineClampClass}
                  style={{
                    textDecoration: [hasComment && "underline"].filter(Boolean).join(" ") || "none",
                    color: item.color || "var(--foreground)",
                  }}
                >
                  {(() => {
                    const spans = getItemSpans(item);
                    // 부분 서식(서로 다른 스팜이 2개 이상)이 실제로 쓰인 경우에만 구간별로 나눠서 렌더링하고,
                    // 그렇지 않으면(예전처럼 전체가 하나의 스팜) 링크화/짧은URL 치환이 그대로 동작하는
                    // LinkifiedText 경로를 그대로 쓴다(부분 서식 적용 짐은 링크 감지가 스팜 단위로 나눠져서
                    // URL이 서로 다른 서식 구간에 걸치면 감지되지 않을 수 있다 - 대부분 짧은 라벨이라 실사용 영향은 작다).
                    if (spans.length <= 1) {
                      return (
                        <span
                          style={{
                            fontWeight: spans[0]?.bold ? 700 : 400,
                            textDecoration: spans[0]?.strike ? "line-through" : "none",
                          }}
                        >
                          <LinkifiedText
                            text={item.text}
                            user={user}
                            shortenEnabled={shortUrlFeatureEnabled}
                            onReplace={(original, shortUrl) => {
                              if (!item.text.includes(original)) return;
                              onChangeText(item.text.replace(original, shortUrl), {
                                bold: item.bold,
                                strike: item.strike,
                                color: item.color,
                              });
                              showToast("링크를 짧게 줄였어요");
                            }}
                          />
                        </span>
                      );
                    }
                    return spans.map((span, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontWeight: span.bold ? 700 : 400,
                          textDecoration: [
                            span.strike && "line-through",
                            span.underline && "underline",
                          ]
                            .filter(Boolean)
                            .join(" ") || "none",
                        }}
                      >
                        {span.text}
                      </span>
                    ));
                  })()}
                </span>
              )}
            </div>
          )}

          {!editing && dueLabel && (
            <span
              onPointerDown={(e) => e.stopPropagation()}
              className="shrink-0 text-[calc(12px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))]"
              style={{ color: dueLabelColor, whiteSpace: "nowrap" }}
            >
              {dueLabel}
            </span>
          )}

          {!editing && assigneeNickname && (
            <span
              onPointerDown={(e) => e.stopPropagation()}
              className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-accent-soft text-accent-strong border border-accent/20"
              title={`담당자: ${assigneeNickname}`}
            >
              {assigneeNickname}
            </span>
          )}

        </div>

        {/* 예전엔 이 자리에 댓글 아이콘+숫자배지 버튼이 있었는데, 폭이 넓은 짐(dueDate 배지까지 겹치면)은
            텍스트가 많이 잘려 보이는 문제가 있었다. 댓글은 이제 오른쪽 스와이프(위 버튼)로 열고,
            댓글이 있다는 표시는 별도 아이콘 없이 위의 짐 내용 span에 밑줄(underline)을 추가하는 것으로
            대신한다(hasComment 변수) - 플렉스 폭을 전혀 침범하지 않아 텍스트 잘림 없이 내용을 그대로 보여준다. */}
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
