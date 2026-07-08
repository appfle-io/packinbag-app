"use client";

import { useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { Announcement } from "@/lib/types";
import Portal from "@/components/Portal";

export default function AnnouncementPopupStack({
  announcements,
  onDismiss,
  onClose,
}: {
  announcements: Announcement[];
  onDismiss: (id: string) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef(0);

  const remaining = announcements.slice(index);
  if (remaining.length === 0) return null;

  const advance = () => {
    setDragX(0);
    if (index + 1 >= announcements.length) {
      onClose();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const current = remaining[0];
  // 뒤에 살짝 보이는 카드는 최대 2장까지만
  const behind = remaining.slice(1, 3);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartRef.current = e.touches[0].clientX;
    setDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    setDragX(e.touches[0].clientX - dragStartRef.current);
  };
  const handleTouchEnd = () => {
    setDragging(false);
    if (Math.abs(dragX) > 100) {
      advance();
    } else {
      setDragX(0);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-6"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm"
          style={{ height: 420 }}
        >
          {behind
            .slice()
            .reverse()
            .map((a, i) => {
              const depth = behind.length - i;
              return (
                <div
                  key={a.id}
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.035})`,
                    opacity: 1 - depth * 0.25,
                  }}
                />
              );
            })}

          <div
            className="absolute inset-0 rounded-2xl p-5 flex flex-col gap-3 shadow-lg"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)`,
              opacity: 1 - Math.min(Math.abs(dragX) / 260, 0.6),
              transition: dragging ? "none" : "transform 220ms ease, opacity 220ms ease",
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex items-start justify-between gap-2 shrink-0">
              <p className="text-[15px] font-medium leading-snug">{current.title}</p>
              <button onClick={onClose} aria-label="닫기" className="shrink-0 -mt-0.5 -mr-0.5">
                <IconX size={18} stroke={1.75} color="var(--text-muted)" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-text-secondary">
                {current.content}
              </p>
            </div>

            {announcements.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 shrink-0">
                {announcements.map((a, i) => (
                  <span
                    key={a.id}
                    className="h-1.5 rounded-full"
                    style={{
                      width: i === index ? 14 : 6,
                      background: i === index ? "var(--accent)" : "var(--border-strong)",
                      transition: "width 200ms ease, background 200ms ease",
                    }}
                  />
                ))}
              </div>
            )}

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => {
                  onDismiss(current.id);
                  advance();
                }}
                className="flex-1 rounded-lg border border-border py-2 text-[12.5px]"
              >
                다시 보지 않기
              </button>
              <button
                onClick={advance}
                className="flex-1 rounded-lg py-2 text-[13px] font-medium"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {index + 1 >= announcements.length ? "확인" : "다음"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
