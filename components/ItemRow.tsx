"use client";

import { useRef, useState } from "react";
import { IconBold, IconStrikethrough } from "@tabler/icons-react";
import { Item } from "@/lib/types";

const DELETE_SWIPE_THRESHOLD = -30;
const DELETE_SWIPE_MAX = -60;
const EDIT_SWIPE_THRESHOLD = 30;
const EDIT_SWIPE_MAX = 60;
const SWIPE_BUTTON_WIDTH = 60;

// 짐을 다른 팩으로 옮기거나 순서를 바꿀 때 쓰는 롱프레스 드래그 설정.
// 이 시간(ms) 이상 큰 움직임 없이 누르고 있으면 드래그 모드로 진입하고,
// 그전에 손가락이 옆으로 움직이면(스와이프 의도로 판단) 롱프레스를 취소한다.
const LONG_PRESS_MS = 420;
const LONG_PRESS_MOVE_CANCEL_PX = 8;

// 텍스트 항목 색상 팔레트. "" 는 기본 색상(리셋)을 의미.
const TEXT_COLORS = ["", "#ef4444", "#f97316", "#22c55e", "#3b82f6", "#a855f7"];

// 설정 > 화면설정 > 팩 크기(--pack-card-scale) + 글자 크기(--font-scale-factor)에 맞춰
// 패딩/아이콘/글자 크기를 함께 조절한다.
export default function ItemRow({
  item,
  onToggle,
  onChangeText,
  onDelete,
  onStartDrag,
  isDragSource,
  isDragOverTarget,
}: {
  item: Item;
  onToggle?: () => void;
  onChangeText: (
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string }
  ) => void;
  onDelete: () => void;
  onStartDrag?: (clientX: number, clientY: number) => void;
  isDragSource?: boolean;
  isDragOverTarget?: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(item.text === "");
  const [draft, setDraft] = useState(item.text);
  const [draftBold, setDraftBold] = useState(!!item.bold);
  const [draftStrike, setDraftStrike] = useState(!!item.strike);
  const [draftColor, setDraftColor] = useState(item.color || "");
  const startX = useRef(0);
  const startY = useRef(0);
  const baseOffset = useRef(0);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (editing) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    baseOffset.current = dragX;
    setDragging(true);
    longPressTriggered.current = false;

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

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || longPressTriggered.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    // 옆으로든 위아래로든 일정 거리 이상 움직이면 스와이프/스크롤 의도로 보고
    // 롱프레스(드래그 시작) 타이머를 취소한다.
    if (Math.abs(dx) > LONG_PRESS_MOVE_CANCEL_PX || Math.abs(dy) > LONG_PRESS_MOVE_CANCEL_PX) {
      clearLongPressTimer();
    }
    const next = Math.min(EDIT_SWIPE_MAX, Math.max(DELETE_SWIPE_MAX, baseOffset.current + dx));
    setDragX(next);
  };

  const endDrag = () => {
    clearLongPressTimer();
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

  return (
    <div
      className={`relative overflow-hidden rounded-lg shrink-0 ${
        item.type === "text" ? "col-span-full" : ""
      }`}
    >
      {(dragging || dragX !== 0) && dragX < 0 && (
        <button
          onClick={() => {
            setDragX(0);
            onDelete();
          }}
          className="absolute right-0 top-0 h-full flex items-center justify-center text-[calc(13px*var(--pack-card-scale,1)*var(--font-scale-factor,1))]"
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
          className="absolute left-0 top-0 h-full flex items-center justify-center text-[calc(13px*var(--pack-card-scale,1)*var(--font-scale-factor,1))]"
          style={{ width: SWIPE_BUTTON_WIDTH, background: "#2563eb", color: "#fff" }}
        >
          수정
        </button>
      )}

      <div
        data-item-id={item.id}
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
          background: item.type === "check" ? "var(--surface-2)" : "transparent",
          opacity: isDragSource ? 0.35 : 1,
          WebkitTouchCallout: "none",
          WebkitUserSelect: onStartDrag ? "none" : undefined,
          userSelect: onStartDrag ? "none" : undefined,
          outline: isDragOverTarget ? "2px solid var(--accent)" : undefined,
        }}
        className="flex items-center gap-2 rounded-lg px-[calc(12px*var(--pack-card-scale,1))] py-[calc(12px*var(--pack-card-scale,1))] md:px-[calc(14px*var(--pack-card-scale,1))] md:py-[calc(14px*var(--pack-card-scale,1))] touch-pan-y"
      >
        {item.type === "check" && (
          <input
            type="checkbox"
            checked={!!item.checked}
            onChange={onToggle}
            onPointerDown={(e) => e.stopPropagation()}
            className="shrink-0 accent-[var(--accent)]"
            style={{
              width: "calc(20px * var(--pack-card-scale,1))",
              height: "calc(20px * var(--pack-card-scale,1))",
            }}
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
                className="min-w-0 w-full bg-transparent text-[calc(17px*var(--pack-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(18px*var(--pack-card-scale,1)*var(--font-scale-factor,1))] leading-normal py-2 md:py-2.5 outline-none"
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
              className="min-w-0 flex-1 bg-transparent text-[calc(17px*var(--pack-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(18px*var(--pack-card-scale,1)*var(--font-scale-factor,1))] leading-normal py-2 md:py-2.5 outline-none"
            />
          )
        ) : (
          <button
            onClick={closeSwipeIfOpen}
            className="min-w-0 flex-1 text-left text-[calc(17px*var(--pack-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(18px*var(--pack-card-scale,1)*var(--font-scale-factor,1))] line-clamp-2"
          >
            {item.type === "check" ? (
              <span
                style={{
                  color: item.checked ? "var(--text-muted)" : "var(--foreground)",
                  textDecoration: item.checked ? "line-through" : "none",
                }}
              >
                {item.text}
              </span>
            ) : (
              <span
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
      </div>
    </div>
  );
}
