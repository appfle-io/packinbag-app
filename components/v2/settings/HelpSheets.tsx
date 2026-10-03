"use client";

import { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import type { Announcement } from "@/lib/types";
import { FAQ_ITEMS } from "@/lib/faqs";
import { Badge, Button, Sheet, cx } from "@/components/v2/ui";

interface FoldItem {
  id: string;
  title: string;
  content: string;
  group?: string;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
}

// 제목을 누르면 아래로 펼쳐지는 목록(여러 개 동시에). 구 AccordionModal 대체
function FoldList({ items, empty }: { items: FoldItem[]; empty: string }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (items.length === 0) return <p className="m-0 py-16 text-center text-body text-sub">{empty}</p>;

  return (
    <div className="flex flex-col">
      {items.map((item, i) => {
        const open = openIds.has(item.id);
        const groupStart = !!item.group && item.group !== items[i - 1]?.group;
        const last = i === items.length - 1 || (!!items[i + 1]?.group && items[i + 1]?.group !== item.group);
        return (
          <div key={item.id} className="flex flex-col">
            {groupStart && <p className={cx("m-0 pb-1 text-micro font-semibold text-faint", i > 0 && "pt-6")}>{item.group}</p>}
            <div className={cx("flex flex-col", !last && "border-b border-line")}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggle(item.id)}
                className="flex min-h-13 w-full items-center gap-3 bg-transparent py-2 text-left active:bg-fill"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="text-body font-semibold text-ink">{item.title}</span>
                  {item.badge}
                </span>
                <IconChevronDown
                  size={18}
                  stroke={1.75}
                  aria-hidden="true"
                  className={cx("shrink-0 text-faint transition-transform duration-200 ease-snappy", open && "rotate-180")}
                />
              </button>
              <div className={cx("grid transition-[grid-template-rows] duration-200 ease-snappy", open ? "collapse-open" : "collapse-closed")}>
                <div className="min-h-0 overflow-hidden">
                  <div className="flex flex-col items-start gap-2 pb-4">
                    <p className="m-0 whitespace-pre-wrap text-body text-sub">{item.content}</p>
                    {item.footer}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 설정 > 공지사항. 구 AnnouncementsModal 대체. 안 숨긴 공지는 "다시 보지 않기", 숨긴 공지는 표시만
export function AnnouncementsListSheet({
  open,
  announcements,
  dismissedIds,
  onDismiss,
  onClose,
}: {
  open: boolean;
  announcements: Announcement[];
  dismissedIds: string[];
  onDismiss: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="공지사항" size="tall">
      <FoldList
        empty="지금은 공지사항이 없어요"
        items={announcements.map((a) => {
          const dismissed = dismissedIds.includes(a.id);
          return {
            id: a.id,
            title: a.title,
            content: a.content,
            badge: dismissed ? <Badge>다시 안 봄</Badge> : undefined,
            footer: !dismissed ? (
              <Button variant="text" size="sm" className="-ml-4" onClick={() => onDismiss(a.id)}>
                다시 보지 않기
              </Button>
            ) : undefined,
          };
        })}
      />
    </Sheet>
  );
}

// 설정 > 자주 묻는 질문. 구 FaqModal 대체(같은 FAQ_ITEMS, 분류별 묶음)
export function FaqSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="자주 묻는 질문" size="tall">
      <FoldList empty="질문이 없어요" items={FAQ_ITEMS.map((f) => ({ id: f.id, title: f.question, content: f.answer, group: f.category }))} />
    </Sheet>
  );
}
