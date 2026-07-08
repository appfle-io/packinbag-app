"use client";

import { Announcement } from "@/lib/types";
import AccordionModal from "@/components/AccordionModal";

export default function AnnouncementsModal({
  announcements,
  dismissedIds,
  onDismiss,
  onClose,
}: {
  announcements: Announcement[];
  dismissedIds: string[];
  onDismiss: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <AccordionModal
      title="공지사항"
      onClose={onClose}
      emptyMessage="지금 보여드릴 공지사항이 없어요."
      items={announcements.map((a) => {
        const dismissed = dismissedIds.includes(a.id);
        return {
          id: a.id,
          title: a.title,
          content: a.content,
          badge: dismissed ? (
            <span className="text-[10px] text-text-muted rounded-full border border-border px-1.5 py-0.5 shrink-0">
              다시 보지 않음
            </span>
          ) : undefined,
          footer: !dismissed ? (
            <button
              onClick={() => onDismiss(a.id)}
              className="self-start text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              다시 보지 않기
            </button>
          ) : undefined,
        };
      })}
    />
  );
}
