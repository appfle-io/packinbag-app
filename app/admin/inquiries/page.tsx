"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconChevronLeft } from "@tabler/icons-react";
import type { Inquiry } from "@/lib/types";
import { INQUIRY_CATEGORY_LABELS } from "@/lib/inquiryCategories";
import { answerInquiryRemote, subscribeToAllInquiries } from "@/lib/inquiriesService";
import { useToast } from "@/components/Toast";
import { Badge, Button, Chip, cx } from "@/components/v2/ui";
import { ADMIN_TEXTAREA, AdminCard, AdminEmpty, AdminLoading, AdminPage } from "@/components/admin/AdminPage";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

// 오른쪽(좁은 화면은 목록 대신) 상세 + 답변
function Detail({ inquiry, onBack }: { inquiry: Inquiry; onBack: () => void }) {
  const { show } = useToast();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [shownId, setShownId] = useState(inquiry.id);
  // 다른 문의를 고르면 쓰던 답변을 비운다
  if (inquiry.id !== shownId) {
    setShownId(inquiry.id);
    setAnswer("");
  }

  const submit = async () => {
    if (!answer.trim() || busy) return;
    setBusy(true);
    try {
      await answerInquiryRemote(inquiry, answer);
      setAnswer("");
      show("답변을 보냈어요. 사용자에게 알림이 가요");
    } catch {
      show("답변을 보내지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminCard className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="inline-flex h-9 items-center gap-1 self-start bg-transparent text-caption font-semibold text-sub hover:text-ink lg:hidden">
        <IconChevronLeft size={16} stroke={1.9} />
        목록
      </button>
      <div className="flex flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <Badge>{INQUIRY_CATEGORY_LABELS[inquiry.category]}</Badge>
          <Badge tone={inquiry.status === "answered" ? "brand" : "neutral"}>{inquiry.status === "answered" ? "답변함" : `기다린 지 ${daysSince(inquiry.createdAt)}일`}</Badge>
        </span>
        <h2 className="m-0 text-heading font-bold text-ink">{inquiry.title}</h2>
        <span className="text-caption text-sub">
          {inquiry.authorNickname} · {formatDate(inquiry.createdAt)}
        </span>
      </div>
      <p className="m-0 whitespace-pre-wrap text-body text-ink">{inquiry.content}</p>
      {inquiry.status === "answered" ? (
        <div className="flex flex-col gap-2 rounded-field bg-brand-soft px-4 py-3">
          <span className="text-micro font-semibold text-brand">보낸 답변{inquiry.answeredAt ? ` · ${formatDate(inquiry.answeredAt)}` : ""}</span>
          <p className="m-0 whitespace-pre-wrap text-body text-ink">{inquiry.answer}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="답변" placeholder="답변을 적어 주세요" rows={6} className={ADMIN_TEXTAREA} />
          <Button className="self-end" disabled={busy || !answer.trim()} onClick={submit}>
            {busy ? "보내는 중" : "답변 보내기"}
          </Button>
        </div>
      )}
    </AdminCard>
  );
}

function AdminInquiriesInner() {
  const searchParams = useSearchParams();
  const [pendingOnly, setPendingOnly] = useState(searchParams.get("status") === "pending");
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => subscribeToAllInquiries(setInquiries), []);

  const list = inquiries ?? [];
  const pendingCount = list.filter((i) => i.status === "pending").length;
  const shown = pendingOnly ? list.filter((i) => i.status === "pending") : list;
  const selected = selectedId ? list.find((i) => i.id === selectedId) ?? null : null;

  return (
    <AdminPage title="문의 관리" description="답변을 보내면 사용자 알림함에 바로 도착해요" wide>
      <div className="flex gap-2">
        <Chip label="전체" count={list.length} selected={!pendingOnly} onClick={() => setPendingOnly(false)} />
        <Chip label="답변 기다리는 중" count={pendingCount} selected={pendingOnly} onClick={() => setPendingOnly(true)} />
      </div>

      {inquiries === null ? (
        <AdminLoading />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <AdminCard className={cx("lg:col-span-2", selected && "hidden lg:block")}>
            {shown.length === 0 ? (
              <AdminEmpty>{pendingOnly ? "답변을 기다리는 문의가 없어요" : "문의가 없어요"}</AdminEmpty>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {shown.map((inq, i) => (
                  <li key={inq.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(inq.id)}
                      className={cx(
                        "flex w-full flex-col gap-1 rounded-field bg-transparent px-2 py-3 text-left hover:bg-fill",
                        i < shown.length - 1 && "border-b border-line",
                        inq.id === selectedId && "bg-fill",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-body font-semibold text-ink">{inq.title}</span>
                        {inq.status === "pending" && <span aria-label="답변 안 함" className="size-2 shrink-0 rounded-full bg-alert" />}
                      </span>
                      <span className="truncate text-caption text-sub">
                        {INQUIRY_CATEGORY_LABELS[inq.category]} · {inq.authorNickname} · {formatDate(inq.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
          <div className={cx("lg:col-span-3", !selected && "hidden lg:block")}>
            {selected ? <Detail inquiry={selected} onBack={() => setSelectedId(null)} /> : <AdminEmpty>왼쪽에서 문의를 골라 주세요</AdminEmpty>}
          </div>
        </div>
      )}
    </AdminPage>
  );
}

export default function AdminInquiriesPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminInquiriesInner />
    </Suspense>
  );
}
