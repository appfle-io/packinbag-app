"use client";

import { useEffect, useState } from "react";
import { IconArrowLeft, IconPlus, IconChevronRight } from "@tabler/icons-react";
import { Inquiry } from "@/lib/types";
import { INQUIRY_CATEGORY_LABELS } from "@/lib/inquiryCategories";
import { createInquiryRemote, subscribeToMyInquiries } from "@/lib/inquiriesService";
import InquiryComposeModal from "@/components/InquiryComposeModal";
import { useToast } from "@/components/Toast";
import { useSwipeBack } from "@/lib/useSwipeBack";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 설정 > 문의하기. 본인이 쓴 글만 보이는 목록(미답변 필터) + 글쓰기 + 상세(답변 확인).
export default function InquiryScreen({
  uid,
  nickname,
  onBack,
}: {
  uid: string;
  nickname: string;
  onBack: () => void;
}) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const { show } = useToast();
  const swipeBackRef = useSwipeBack<HTMLDivElement>(() => (selected ? setSelected(null) : onBack()));

  useEffect(() => subscribeToMyInquiries(uid, setInquiries), [uid]);

  // 실시간 구독으로 상세 화면에 열어둔 글의 답변 상태가 바뀌면(방금 답변 도착 등) 즉시 반영.
  useEffect(() => {
    if (!selected) return;
    const latest = inquiries.find((i) => i.id === selected.id);
    if (latest) setSelected(latest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiries]);

  const displayed = unansweredOnly
    ? inquiries.filter((i) => i.status === "pending")
    : inquiries;

  if (selected) {
    return (
      <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
          <button
            onClick={() => setSelected(null)}
            className="-m-2.5 p-2.5"
            aria-label="뒤로가기"
          >
            <IconArrowLeft size={20} stroke={1.75} />
          </button>
          <h1 className="text-[16px] font-medium truncate">{selected.title}</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-[11px] font-medium rounded-full px-2 py-0.5"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              {INQUIRY_CATEGORY_LABELS[selected.category]}
            </span>
            <span className="text-[11px] text-text-muted">{formatDate(selected.createdAt)}</span>
          </div>
          <p className="text-[13px] whitespace-pre-wrap leading-relaxed mb-6">
            {selected.content}
          </p>
          {selected.status === "answered" ? (
            <div className="rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
              <p className="text-[11px] text-text-muted mb-1">답변</p>
              <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{selected.answer}</p>
            </div>
          ) : (
            <p className="text-[12px] text-text-muted">아직 답변이 등록되지 않았어요</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="-m-2.5 p-2.5" aria-label="뒤로가기">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <h1 className="text-[18px] font-medium flex-1">문의하기</h1>
        <button
          onClick={() => setShowCompose(true)}
          className="-m-2.5 p-2.5"
          aria-label="새 문의 작성"
        >
          <IconPlus size={20} stroke={1.75} />
        </button>
      </div>

      <div className="px-4 pb-2 shrink-0">
        <button
          onClick={() => setUnansweredOnly((v) => !v)}
          className="rounded-full px-3 py-1.5 text-[12px]"
          style={{
            background: unansweredOnly ? "var(--accent)" : "var(--surface-2)",
            color: unansweredOnly ? "#fff" : "var(--text-secondary)",
          }}
        >
          미답변만 보기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {displayed.length === 0 ? (
          <p className="text-[13px] text-text-muted py-16 text-center">
            {unansweredOnly ? "미답변 문의가 없어요" : "아직 작성한 문의가 없어요"}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {displayed.map((inq) => (
              <button
                key={inq.id}
                onClick={() => setSelected(inq)}
                className="w-full flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="text-[10px] font-medium rounded-full px-1.5 py-0.5 shrink-0"
                      style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
                    >
                      {INQUIRY_CATEGORY_LABELS[inq.category]}
                    </span>
                    <span className="text-[13px] font-medium truncate">{inq.title}</span>
                  </div>
                  <span className="text-[11px] text-text-muted">{formatDate(inq.createdAt)}</span>
                </div>
                <span className="flex items-center gap-1 shrink-0">
                  <span
                    className="text-[10px] font-medium rounded-full px-1.5 py-0.5"
                    style={{
                      background: inq.status === "answered" ? "var(--accent-soft)" : "var(--surface)",
                      color: inq.status === "answered" ? "var(--accent-strong)" : "var(--text-muted)",
                    }}
                  >
                    {inq.status === "answered" ? "답변완료" : "미답변"}
                  </span>
                  <IconChevronRight size={15} stroke={1.75} color="var(--text-muted)" />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCompose && (
        <InquiryComposeModal
          onClose={() => setShowCompose(false)}
          onSubmit={async (data) => {
            await createInquiryRemote(uid, nickname, data);
            setShowCompose(false);
            show("문의가 등록됐어요");
          }}
        />
      )}
    </div>
  );
}
