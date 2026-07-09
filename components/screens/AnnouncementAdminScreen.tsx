"use client";

import { useState } from "react";
import { IconArrowLeft, IconPlus, IconEdit, IconTrash } from "@tabler/icons-react";
import { Announcement } from "@/lib/types";
import { isAnnouncementActive } from "@/lib/announcementsService";
import { useSwipeBack } from "@/lib/useSwipeBack";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

type Draft = {
  id?: string;
  title: string;
  content: string;
  startDate: string;
  endDate: string;
};

const emptyDraft = (): Draft => {
  const today = new Date().toISOString().slice(0, 10);
  return { title: "", content: "", startDate: today, endDate: today };
};

export default function AnnouncementAdminScreen({
  announcements,
  uid,
  onBack,
  onCreate,
  onUpdate,
  onDelete,
}: {
  announcements: Announcement[];
  uid: string;
  onBack: () => void;
  onCreate: (data: Omit<Announcement, "id" | "createdAt">) => Promise<void>;
  onUpdate: (id: string, data: Partial<Announcement>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { show } = useToast();
  // 작성/수정 중이면 스와이프 뒤로가기는 목록으로만 돌아가고, 목록 화면에서는 상위 onBack.
  const swipeBackRef = useSwipeBack<HTMLDivElement>(() => (draft ? setDraft(null) : onBack()));

  const valid =
    !!draft && draft.title.trim() && draft.content.trim() && draft.startDate && draft.endDate;

  const handleSave = async () => {
    if (!draft || !valid) return;
    setSaving(true);
    try {
      if (draft.id) {
        await onUpdate(draft.id, {
          title: draft.title.trim(),
          content: draft.content.trim(),
          startDate: draft.startDate,
          endDate: draft.endDate,
        });
        show("공지사항을 수정했어요");
      } else {
        await onCreate({
          title: draft.title.trim(),
          content: draft.content.trim(),
          startDate: draft.startDate,
          endDate: draft.endDate,
          createdBy: uid,
        });
        show("공지사항을 등록했어요");
      }
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  if (draft) {
    return (
      <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 pb-2 shrink-0">
          <button onClick={() => setDraft(null)} className="flex items-center gap-1">
            <IconArrowLeft size={20} stroke={1.75} />
          </button>
          <p className="text-[15px] font-medium">{draft.id ? "공지사항 수정" : "새 공지사항"}</p>
          <button
            onClick={handleSave}
            disabled={!valid || saving}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            저장
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-4">
          <div>
            <p className="text-[12px] text-text-secondary mb-1.5">제목</p>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="공지 제목"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
            />
          </div>

          <div>
            <p className="text-[12px] text-text-secondary mb-1.5">내용</p>
            <textarea
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              placeholder="공지 내용"
              rows={6}
              className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-[12px] text-text-secondary mb-1.5">노출 시작일</p>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[13px] outline-none"
              />
            </div>
            <div className="flex-1">
              <p className="text-[12px] text-text-secondary mb-1.5">노출 종료일</p>
              <input
                type="date"
                value={draft.endDate}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[13px] outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">공지사항 관리</p>
        <button onClick={() => setDraft(emptyDraft())} aria-label="새 공지사항">
          <IconPlus size={20} stroke={1.75} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-2">
        {announcements.length === 0 && (
          <p className="text-[13px] text-text-muted py-10 text-center">
            등록된 공지사항이 없어요. 오른쪽 위 + 버튼으로 추가해보세요.
          </p>
        )}
        {announcements.map((a) => {
          const active = isAnnouncementActive(a);
          return (
            <div key={a.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate flex items-center gap-1.5">
                    {a.title}
                    <span
                      className="text-[10px] rounded-full px-1.5 py-0.5 shrink-0"
                      style={{
                        background: active ? "var(--accent-soft)" : "var(--surface-2)",
                        color: active ? "var(--accent-strong)" : "var(--text-muted)",
                      }}
                    >
                      {active ? "노출 중" : "노출 기간 아님"}
                    </span>
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {a.startDate} ~ {a.endDate}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      setDraft({
                        id: a.id,
                        title: a.title,
                        content: a.content,
                        startDate: a.startDate,
                        endDate: a.endDate,
                      })
                    }
                    aria-label="수정"
                  >
                    <IconEdit size={15} stroke={1.75} color="var(--text-secondary)" />
                  </button>
                  <button onClick={() => setConfirmDeleteId(a.id)} aria-label="삭제">
                    <IconTrash size={15} stroke={1.75} color="var(--danger)" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title="이 공지사항을 삭제할까요?"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={async () => {
            const id = confirmDeleteId;
            setConfirmDeleteId(null);
            await onDelete(id);
            show("공지사항을 삭제했어요");
          }}
        />
      )}
    </div>
  );
}
