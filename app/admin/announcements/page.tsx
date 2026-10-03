"use client";

import { useEffect, useState } from "react";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import type { Announcement } from "@/lib/types";
import {
  createAnnouncementRemote,
  deleteAnnouncementRemote,
  isAnnouncementActive,
  subscribeToAnnouncements,
  updateAnnouncementRemote,
} from "@/lib/announcementsService";
import { Badge, Button, IconButton, Sheet, cx } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { ADMIN_FIELD, ADMIN_TEXTAREA, AdminCard, AdminEmpty, AdminPage } from "@/components/admin/AdminPage";

type Draft = { id?: string; title: string; content: string; startDate: string; endDate: string };

const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD(로컬)
const plusDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toLocaleDateString("sv-SE");

function status(a: Announcement): { label: string; tone: "brand" | "neutral" } {
  if (isAnnouncementActive(a)) return { label: "보이는 중", tone: "brand" };
  return a.startDate > today() ? { label: "예약", tone: "neutral" } : { label: "끝남", tone: "neutral" };
}

export default function AdminAnnouncementsPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cached, setCached] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => subscribeToAnnouncements(setItems), []);

  if (draft && draft !== cached) setCached(draft);
  const d = draft ?? cached;
  const valid = !!d && !!d.title.trim() && !!d.content.trim() && !!d.startDate && !!d.endDate && d.startDate <= d.endDate;

  const save = async () => {
    if (!draft || !valid || saving) return;
    setSaving(true);
    try {
      const body = { title: draft.title.trim(), content: draft.content.trim(), startDate: draft.startDate, endDate: draft.endDate };
      if (draft.id) {
        await updateAnnouncementRemote(draft.id, body);
        show("공지를 고쳤어요");
      } else {
        await createAnnouncementRemote({ ...body, createdBy: user?.uid ?? "" });
        show("공지를 올렸어요");
      }
      setDraft(null);
    } catch {
      show("공지를 저장하지 못했어요");
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...items].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <AdminPage
      title="공지사항"
      description="보이는 기간 안에 앱을 연 사람에게 시작할 때 한 번 떠요(다시 보지 않기 전까지)"
      actions={
        <Button size="sm" leading={<IconPlus size={18} stroke={2} />} onClick={() => setDraft({ title: "", content: "", startDate: today(), endDate: plusDays(7) })}>
          새 공지
        </Button>
      }
    >
      {sorted.length === 0 ? (
        <AdminEmpty>공지가 없어요. 오른쪽 위 &lsquo;새 공지&rsquo;로 올려 보세요</AdminEmpty>
      ) : (
        <AdminCard>
          <ul className="m-0 flex list-none flex-col p-0">
            {sorted.map((a, i) => {
              const s = status(a);
              return (
                <li key={a.id} className={cx("flex items-start gap-2 py-3", i < sorted.length - 1 && "border-b border-line")}>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-semibold text-ink">{a.title}</span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </span>
                    <span className="text-caption text-sub tabular-nums">
                      {a.startDate} ~ {a.endDate}
                    </span>
                    <span className="line-clamp-2 text-caption text-faint">{a.content}</span>
                  </div>
                  <IconButton label="고치기" onClick={() => setDraft({ id: a.id, title: a.title, content: a.content, startDate: a.startDate, endDate: a.endDate })}>
                    <IconPencil size={20} stroke={1.75} />
                  </IconButton>
                  <IconButton label="삭제" className="text-alert" onClick={() => setDeleteId(a.id)}>
                    <IconTrash size={20} stroke={1.75} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        </AdminCard>
      )}

      <Sheet
        open={!!draft}
        onClose={saving ? () => {} : () => setDraft(null)}
        title={d?.id ? "공지 고치기" : "새 공지"}
        size="tall"
        footer={
          <Button block disabled={!valid || saving} onClick={save}>
            {saving ? "저장 중" : d?.id ? "저장" : "올리기"}
          </Button>
        }
      >
        {d && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-caption text-sub">제목</span>
              <input value={d.title} onChange={(e) => setDraft({ ...d, title: e.target.value })} placeholder="공지 제목" className={ADMIN_FIELD} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-caption text-sub">내용</span>
              <textarea value={d.content} onChange={(e) => setDraft({ ...d, content: e.target.value })} placeholder="공지 내용" rows={8} className={ADMIN_TEXTAREA} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-caption text-sub">보이기 시작</span>
                <input type="date" value={d.startDate} onChange={(e) => setDraft({ ...d, startDate: e.target.value })} className={ADMIN_FIELD} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-caption text-sub">보이기 끝</span>
                <input type="date" value={d.endDate} onChange={(e) => setDraft({ ...d, endDate: e.target.value })} className={ADMIN_FIELD} />
              </label>
            </div>
            {d.startDate > d.endDate && <p className="m-0 text-caption text-alert">끝나는 날이 시작하는 날보다 빨라요</p>}
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="이 공지를 지울까요?"
        message="되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        onConfirm={() => {
          const id = deleteId;
          if (!id) return;
          deleteAnnouncementRemote(id)
            .then(() => show("공지를 지웠어요"))
            .catch(() => show("공지를 지우지 못했어요"));
        }}
      />
    </AdminPage>
  );
}
