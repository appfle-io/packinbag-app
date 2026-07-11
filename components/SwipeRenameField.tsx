"use client";

import { useRef, useState } from "react";

const EDIT_SWIPE_THRESHOLD = 22;
const EDIT_SWIPE_MAX = 50;
const SWIPE_BUTTON_WIDTH = 44;
const SWIPE_INTENT_MIN_PX = 12;
const SWIPE_INTENT_RATIO = 1.6;

// 짐(ItemRow)의 스와이프 수정 상호작용과 동일한 패턴을 팩 이름에도 적용한 컴포넌트.
// 예전엔 이름 텍스트를 탭하면 바로 편집 모드로 들어갔는데, 짐 수정과 일관되게
// "오른쪽으로 밀어서 수정" 방식으로 통일했다. 삭제는 팩 헤더에 별도 휴지통 아이콘이
// 이미 있어서 왼쪽 스와이프(삭제) 제스처는 여기선 만들지 않는다.
export default function SwipeRenameField({
  value,
  onChange,
  className,
  inputClassName,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  readOnly?: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const startX = useRef(0);
  const startY = useRef(0);
  const baseOffset = useRef(0);
  // 마우스로 드래그하면 pointerup 직후 브라우저가 그 자리에 합성 click 이벤트를 또 발생시킨다
  // (터치는 이동이 있으면 보통 click을 억제하지만 마우스는 그렇지 않음) - 그래서 스와이프로
  // 열어놓은 직후에 바로 그 click이 내부 버튼(닫기)을 눌러 다시 0으로 닫혀버리는 버그가 있었다.
  // 실제로 가로로 움직임(스와이프)이 있었던 제스처에서만 그 다음으로 오는 click을 막는 방식으로 해결한다
  // (HomeScreen/PacksScreen의 롱프레스 드래그 vs 탭 판정과 동일한 패턴).
  const justDraggedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (editing || readOnly) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    baseOffset.current = dragX;
    setDragging(true);
    justDraggedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    const isHorizontalSwipe =
      Math.abs(dx) >= SWIPE_INTENT_MIN_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_INTENT_RATIO;
    if (!isHorizontalSwipe) return;
    justDraggedRef.current = true;
    // 오른쪽으로만 밀리게 한다(왼쪽 스와이프는 삭제용이 아니라 별도 기능이 없어 무시).
    const next = Math.min(EDIT_SWIPE_MAX, Math.max(0, baseOffset.current + dx));
    setDragX(next);
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    setDragX((current) => (current >= EDIT_SWIPE_THRESHOLD ? EDIT_SWIPE_MAX : 0));
  };

  const openEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    if (draft.trim()) onChange(draft.trim());
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commitEdit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={inputClassName ?? className}
        style={{
          borderBottom: "1px dashed var(--border-strong)",
          background: "transparent",
          outline: "none",
        }}
      />
    );
  }

  return (
    <div className="relative overflow-hidden min-w-0 flex-1">
      {(dragging || dragX !== 0) && dragX > 0 && !readOnly && (
        <button
          onClick={() => {
            setDragX(0);
            openEdit();
          }}
          className="absolute left-0 top-0 h-full flex items-center justify-center text-[12px] rounded"
          style={{ width: SWIPE_BUTTON_WIDTH, background: "#2563eb", color: "#fff" }}
        >
          수정
        </button>
      )}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (justDraggedRef.current) {
            justDraggedRef.current = false;
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 150ms ease",
          touchAction: readOnly ? undefined : "pan-y",
        }}
      >
        <button
          onClick={() => dragX !== 0 && setDragX(0)}
          className={className}
          style={{ cursor: readOnly ? "default" : undefined }}
        >
          {value}
        </button>
      </div>
    </div>
  );
}
