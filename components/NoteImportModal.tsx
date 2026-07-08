"use client";

import Portal from "@/components/Portal";

import { useEffect, useState } from "react";
import { IconX, IconSparkles } from "@tabler/icons-react";

export interface NoteImportResult {
  bagName: string;
  packs: { name: string; items: string[] }[];
}

const LOADING_MESSAGES = [
  "메모를 꼼꼼히 읽고 있어요",
  "짐 종류를 살펴보고 있어요",
  "어울리는 팩으로 나누고 있어요",
  "가방에 짐을 채워넣고 있어요",
];

export default function NoteImportModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (result: NoteImportResult) => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_MESSAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [loading]);

  const handleAnalyze = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/import-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "분석에 실패했어요");
      }
      onResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석에 실패했어요");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={loading ? undefined : onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-medium">클립보드에서 가져오기</span>
            {!loading && (
              <button onClick={onClose} aria-label="닫기">
                <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
              </button>
            )}
          </div>

          <p className="text-[12px] text-text-secondary">
            아이폰 메모 앱에서 준비물 목록을 복사한 뒤 아래에 붙여넣어주세요.
            AI가 내용을 읽고 팩(카테고리)별로 자동 분류해드려요.
          </p>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg py-8">
              <div
                className="pib-note-spin flex items-center justify-center rounded-full"
                style={{
                  width: 40,
                  height: 40,
                  background: "var(--accent-soft)",
                }}
              >
                <IconSparkles size={18} stroke={1.75} color="var(--accent)" />
              </div>
              <p
                key={loadingStep}
                className="pib-note-fade text-[13px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {LOADING_MESSAGES[loadingStep]}
              </p>
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="여기에 길게 눌러 붙여넣기"
              rows={8}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] outline-none resize-none"
            />
          )}

          {error && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          {!loading && (
            <button
              onClick={handleAnalyze}
              disabled={!text.trim()}
              className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[14px] font-medium"
              style={{
                background: text.trim() ? "var(--accent)" : "var(--surface-2)",
                color: text.trim() ? "#fff" : "var(--text-muted)",
              }}
            >
              <IconSparkles size={15} stroke={1.75} />
              AI로 분석하기
            </button>
          )}
        </div>
      </div>
    </Portal>
  );
}
