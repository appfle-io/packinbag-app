"use client";

import { useEffect, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import type { Inquiry, InquiryCategory } from "@/lib/types";
import { INQUIRY_CATEGORY_LABELS, INQUIRY_CATEGORY_OPTIONS } from "@/lib/inquiryCategories";
import { createInquiryRemote, subscribeToMyInquiries } from "@/lib/inquiriesService";
import { useToast } from "@/components/Toast";
import { Badge, Button, Chip, IconButton, Sheet, cx } from "@/components/v2/ui";
import { SubScreen } from "./SubScreen";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

const TITLE_MAX = 60;
const CONTENT_MAX = 2000;

// 문의 쓰기 시트. 구 InquiryComposeModal 대체
function ComposeSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { category: InquiryCategory; title: string; content: string }) => Promise<void>;
}) {
  const [category, setCategory] = useState<InquiryCategory>("other");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCategory("other");
      setTitle("");
      setContent("");
      setError(null);
    }
  }

  const canSubmit = !!title.trim() && !!content.trim() && !busy;
  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ category, title: title.trim(), content: content.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "문의를 보내지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={busy ? () => {} : onClose}
      title="문의하기"
      size="tall"
      footer={
        <Button block disabled={!canSubmit} onClick={submit}>
          {busy ? "보내는 중" : "보내기"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div role="group" aria-label="어디서 생긴 일인가요?" className="flex flex-wrap gap-2">
          {INQUIRY_CATEGORY_OPTIONS.map((c) => (
            <Chip key={c} label={INQUIRY_CATEGORY_LABELS[c]} selected={category === c} onClick={() => setCategory(c)} />
          ))}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
          aria-label="제목"
          placeholder="제목"
          className="h-12 w-full rounded-field border border-line bg-card px-4 text-body outline-none placeholder:text-faint focus:border-ink"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, CONTENT_MAX))}
          aria-label="내용"
          placeholder="어떤 일이 있었는지 자세히 알려 주세요"
          rows={8}
          className="min-h-40 w-full resize-none rounded-field border border-line bg-card px-4 py-3 text-body outline-none placeholder:text-faint focus:border-ink"
        />
        {error && (
          <p role="alert" className="m-0 text-caption text-alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

// 설정 > 문의하기. 구 InquiryScreen 대체(같은 서비스). 목록(미답변만 칩) → 상세(답변) · + 로 쓰기
export function InquiryScreenV2({ uid, nickname, onBack }: { uid: string; nickname: string; onBack: () => void }) {
  const { show } = useToast();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => subscribeToMyInquiries(uid, setInquiries), [uid]);

  // 실시간 목록에서 찾아 쓰므로 답변이 오면 상세에도 바로 보인다
  const selected = selectedId ? inquiries.find((i) => i.id === selectedId) ?? null : null;
  const shown = pendingOnly ? inquiries.filter((i) => i.status === "pending") : inquiries;

  if (selected) {
    return (
      <SubScreen title="문의 내용" onBack={() => setSelectedId(null)} bodyClassName="gap-6">
        <section className="flex flex-col gap-3">
          <span className="flex items-center gap-2">
            <Badge>{INQUIRY_CATEGORY_LABELS[selected.category]}</Badge>
            <span className="text-micro text-faint">{formatDate(selected.createdAt)}</span>
          </span>
          <h2 className="m-0 text-body-lg font-bold text-ink">{selected.title}</h2>
          <p className="m-0 whitespace-pre-wrap text-body text-ink">{selected.content}</p>
        </section>
        {selected.status === "answered" ? (
          <section className="flex flex-col gap-2 rounded-card bg-brand-soft px-4 py-4">
            <span className="text-micro font-semibold text-brand">답변</span>
            <p className="m-0 whitespace-pre-wrap text-body text-ink">{selected.answer}</p>
          </section>
        ) : (
          <p className="m-0 rounded-card bg-fill px-4 py-4 text-caption text-sub">아직 답변을 준비하고 있어요. 답변이 오면 알림으로 알려 드려요.</p>
        )}
      </SubScreen>
    );
  }

  return (
    <SubScreen
      title="문의하기"
      onBack={onBack}
      actions={
        <IconButton label="새 문의" variant="solid" onClick={() => setComposeOpen(true)}>
          <IconPlus size={20} stroke={2} />
        </IconButton>
      }
      headerExtra={
        inquiries.length > 0 ? (
          <div className="flex gap-2">
            <Chip label="전체" selected={!pendingOnly} onClick={() => setPendingOnly(false)} />
            <Chip label="답변 기다리는 중" selected={pendingOnly} onClick={() => setPendingOnly(true)} />
          </div>
        ) : undefined
      }
    >
      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="m-0 text-body text-sub">{pendingOnly ? "답변을 기다리는 문의가 없어요" : "아직 보낸 문의가 없어요"}</p>
          {!pendingOnly && (
            <Button className="mt-2" leading={<IconPlus size={18} stroke={2} />} onClick={() => setComposeOpen(true)}>
              문의 쓰기
            </Button>
          )}
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {shown.map((inq, i) => (
            <li key={inq.id}>
              <button
                type="button"
                onClick={() => setSelectedId(inq.id)}
                className={cx(
                  "flex min-h-15 w-full items-center gap-3 bg-transparent py-2 text-left active:bg-fill",
                  i < shown.length - 1 && "border-b border-line",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-body font-semibold text-ink">{inq.title}</span>
                  <span className="truncate text-caption text-sub">
                    {INQUIRY_CATEGORY_LABELS[inq.category]} · {formatDate(inq.createdAt)}
                  </span>
                </span>
                <Badge tone={inq.status === "answered" ? "brand" : "neutral"}>{inq.status === "answered" ? "답변 옴" : "기다리는 중"}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ComposeSheet
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSubmit={async (data) => {
          await createInquiryRemote(uid, nickname, data);
          setComposeOpen(false);
          show("문의를 보냈어요");
        }}
      />
    </SubScreen>
  );
}
