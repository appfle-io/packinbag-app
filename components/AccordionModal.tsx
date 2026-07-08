"use client";

import Portal from "@/components/Portal";

import { ReactNode, useState } from "react";
import { IconX, IconChevronDown } from "@tabler/icons-react";

export interface AccordionItem {
  id: string;
  title: string;
  content: string;
  footer?: ReactNode;
  badge?: ReactNode;
  groupLabel?: string;
}

// 공지사항/FAQ가 공유해서 쓰는 아코디언 모달. 제목을 누르면 그 아래로 내용이
// 펼쳐지고, 여러 개를 동시에 펼쳐둘 수 있다.
export default function AccordionModal({
  title,
  items,
  emptyMessage,
  onClose,
}: {
  title: string;
  items: AccordionItem[];
  emptyMessage?: string;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-xl bg-surface p-4 flex flex-col gap-3 max-h-[80vh]"
        >
          <div className="flex items-center justify-between shrink-0">
            <p className="text-[15px] font-medium">{title}</p>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
            {items.length === 0 && emptyMessage && (
              <p className="text-[12px] text-text-secondary py-6 text-center">
                {emptyMessage}
              </p>
            )}
            {items.map((item, index) => {
              const isOpen = expanded.has(item.id);
              const showGroupHeader =
                !!item.groupLabel &&
                item.groupLabel !== items[index - 1]?.groupLabel;
              return (
                <div key={item.id} className="contents">
                  {showGroupHeader && (
                    <p
                      className="text-[11px] font-medium px-1 pt-2 first:pt-0"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.groupLabel}
                    </p>
                  )}
                  <div className="rounded-lg border border-border overflow-hidden shrink-0">
                    <button
                      onClick={() => toggle(item.id)}
                      className="w-full flex items-center justify-between gap-2 p-3 text-left"
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[13px] font-medium truncate">
                          {item.title}
                        </span>
                        {item.badge}
                      </span>
                      <IconChevronDown
                        size={16}
                        stroke={1.75}
                        color="var(--text-muted)"
                        className="shrink-0 transition-transform"
                        style={{
                          transform: isOpen ? "rotate(180deg)" : "none",
                        }}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 flex flex-col gap-2">
                        <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-text-secondary">
                          {item.content}
                        </p>
                        {item.footer}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Portal>
  );
}
