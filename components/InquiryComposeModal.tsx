"use client";

import { useState } from "react";
import Portal from "@/components/Portal";
import { IconX } from "@tabler/icons-react";
import { InquiryCategory } from "@/lib/types";
import { INQUIRY_CATEGORY_LABELS, INQUIRY_CATEGORY_OPTIONS } from "@/lib/inquiryCategories";

// 문의하기 글쓰기 모달. 카테고리(가방/팩/AI기능/그외) + 제목 + 내용.
export default function InquiryComposeModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { category: InquiryCategory; title: string; content: string }) => Promise<void>;
}) {
  const [category, setCategory] = useState<InquiryCategory>("other");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit({ category, title: title.trim(), content: content.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface p-4 flex flex-col gap-3"
          style={{ paddingBottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium">문의하기</span>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {INQUIRY_CATEGORY_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className="rounded-full px-3 py-1.5 text-[12px]"
                style={{
                  background: category === c ? "var(--accent)" : "var(--surface-2)",
                  color: category === c ? "#fff" : "var(--text-secondary)",
                }}
              >
                {INQUIRY_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 60))}
            placeholder="제목"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 2000))}
            placeholder="어떤 문제가 있었는지 자세히 알려주세요"
            rows={6}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none resize-none"
          />

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg py-2.5 text-[14px] font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {busy ? "등록 중..." : "등록"}
          </button>
        </div>
      </div>
    </Portal>
  );
}
