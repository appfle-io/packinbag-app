"use client";

import { useRef, useState } from "react";
import { IconGripVertical, IconBold, IconStrikethrough } from "@tabler/icons-react";
import { Item } from "@/lib/types";

const SWIPE_THRESHOLD = -36;
const SWIPE_MAX = -72;

// 텍스트 항목 색상 팔레트. "" 는 기본 색상(리셋)을 의미.
const TEXT_COLORS = ["", "#ef4444", "#f97316", "#22c55e", "#3b82f6", "#a855f7"];

export default function ItemRow({
  item,
  onToggle,
  onChangeText,
  onDelete,
  onStartDrag,
  isDragSource,
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
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(item.text === "");
  const [draft, setDraft] = useState(item.text);
  const [draftBold, setDraftBold] = useState(!!item.bold);
  const [draftStrike, setDraftStrike] = useState(!!item.strike);
  const [draftColor, setDraftColor] = useState(item.color || "");
  const startX = useRef(0);
  const baseOffset = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (editing) return;
    startX.current = e.clientX;
    baseOffset.current = dragX;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = e.clientX - startX.current;
    const next = Math.min(0, Math.max(SWIPE_MAX, baseOffset.current + delta));
    setDragX(next);
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    setDragX((current) => (current <= SWIPE_THRESHOLD ? SWIPE_MAX : 0));
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

  const startEdit = () => {
    if (dragX !== 0) {
      setDragX(0);
      return;
    }
    setDraft(item.text);
    setDraftBold(!!item.bold);
    setDraftStrike(!!item.strike);
    setDraftColor(item.color || "");
    setEditing(true);
  };

  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      className={`relative overflow-hidden rounded-lg shrink-0 ${
        item.type === "text" ? "col-span-full" : ""
      }`}
    >
      {(dragging || dragX !== 0) && (
        <button
          onClick={() => {
            setDragX(0);
            onDelete();
          }}
          className="absolute right-0 top-0 h-full flex items-center justify-center text-[14px]"
          style={{ width: 72, background: "var(--danger)", color: "#fff" }}
        >
          삭제
        </button>
      )}

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 150ms ease",
          background: item.type === "check" ? "var(--surface-2)" : "transparent",
          opacity: isDragSource ? 0.35 : 1,
        }}
        className="flex items-center gap-2 rounded-lg px-3 py-3 md:px-3.5 md:py-3.5 touch-pan-y"
      >
        {onStartDrag && (
          <span
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartDrag(e.clientX, e.clientY);
            }}
            className="shrink-0 touch-none cursor-grab"
            style={{ color: "var(--text-muted)" }}
            aria-label="드래그해서 다른 팩으로 옮기기"
          >
            <IconGripVertical size={17} stroke={1.75} />
          </span>
        )}

        {item.type === "check" && (
          <input
            type="checkbox"
            checked={!!item.checked}
            onChange={onToggle}
            className="shrink-0 h-5 w-5 accent-[var(--accent)]"
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
                className="min-w-0 w-full bg-transparent text-[17px] md:text-[18px] leading-normal py-2 md:py-2.5 outline-none"
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
                  className="flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded shrink-0"
                  style={{
                    background: draftBold ? "var(--accent)" : "var(--surface)",
                    color: draftBold ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  <IconBold size={16} stroke={2.25} />
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={() => setDraftStrike((s) => !s)}
                  aria-label="취소선"
                  className="flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded shrink-0"
                  style={{
                    background: draftStrike ? "var(--accent)" : "var(--surface)",
                    color: draftStrike ? "#fff" : "var(--text-secondary)",
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
                    className="h-[22px] w-[22px] md:h-6 md:w-6 rounded-full shrink-0"
                    style={{
                      background: c || "var(--surface)",
                      border:
                        draftColor === c
                          ? "1.5px solid var(--foreground)"
                          : "1.5px solid var(--border-strong)",
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
              className="min-w-0 flex-1 bg-transparent text-[17px] md:text-[18px] leading-normal py-2 md:py-2.5 outline-none"
            />
          )
        ) : (
          <button
            onClick={startEdit}
            className="min-w-0 flex-1 text-left text-[17px] md:text-[18px] line-clamp-2"
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
