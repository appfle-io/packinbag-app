"use client";

import Portal from "@/components/Portal";

import { useEffect, useRef, useState } from "react";
import { IconX, IconSparkles, IconPaperclip, IconFileText } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import {
  AI_FREE_DAILY_LIMIT,
  currentAiUsageCount,
  isUnlimitedAiUser,
} from "@/lib/aiUsageService";
import { ImportedBagResult } from "@/lib/types";

// 다른 화면(HomeScreen, AppShell)에서 기존 이름으로 계속 import할 수 있도록 재수출.
export type NoteImportResult = ImportedBagResult;

// 서버(app/api/import-note)의 MAX_PDF_BYTES와 동일한 값. 여기서 미리 걸러내면
// 큰 파일을 base64로 인코딩해서 보내봤다가 서버에서 거절당하는 낭비를 막을 수 있다.
const MAX_PDF_BYTES = 3 * 1024 * 1024;

const LOADING_MESSAGES = [
  "메모를 꼼꼼히 읽고 있어요",
  "짐 종류를 살펴보고 있어요",
  "어울리는 팩으로 나누고 있어요",
  "가방에 짐을 채워넣고 있어요",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function NoteImportModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (result: NoteImportResult) => void;
}) {
  const { user, profile } = useAuth();
  const [text, setText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const unlimited = isUnlimitedAiUser(profile?.email, profile);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_MESSAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [loading]);

  const handlePickPdf = (file: File | null) => {
    if (!file) return;
    setError(null);
    if (file.type !== "application/pdf") {
      setError("PDF 파일만 첨부할 수 있어요");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError(`PDF 파일은 ${formatFileSize(MAX_PDF_BYTES)} 이하만 첨부할 수 있어요`);
      return;
    }
    // 텍스트와 PDF는 동시에 보내지 않는다 - PDF를 첨부하면 붙여넣은 텍스트는 비운다.
    setText("");
    setPdfFile(file);
  };

  const removePdf = () => {
    setPdfFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // data:application/pdf;base64,xxxxx 형태에서 base64 부분만 추출
        const base64 = result.split(",")[1] ?? "";
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleAnalyze = async () => {
    if ((!text.trim() && !pdfFile) || loading || !user) return;
    setLoading(true);
    setError(null);

    try {
      // 하루 사용 한도 확인+증가는 서버(Admin SDK)가 로그인 토큰을 직접 검증해서
      // 처리한다 - 클라이언트는 우회할 수 없다 (lib/aiQuotaServer.ts 참고).
      const idToken = await user.getIdToken();
      const body = pdfFile
        ? { pdfBase64: await readFileAsBase64(pdfFile), pdfMimeType: "application/pdf" }
        : { text };
      const res = await fetch("/api/import-note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
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
            아이폰 메모 앱에서 준비물 목록을 복사한 뒤 아래에 붙여넣거나, PDF 파일을
            첨부해주세요. AI가 내용을 읽고 팩(카테고리)별로 자동 분류해드려요.
          </p>

          {!unlimited && (
            <p className="text-[11px] text-text-muted">
              오늘 AI 기능 {currentAiUsageCount(profile)}/{AI_FREE_DAILY_LIMIT}회 사용
            </p>
          )}

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
          ) : pdfFile ? (
            <div
              className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5"
              style={{ background: "var(--surface-2)" }}
            >
              <IconFileText size={20} stroke={1.75} color="var(--accent)" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate">{pdfFile.name}</p>
                <p className="text-[11px] text-text-muted">{formatFileSize(pdfFile.size)}</p>
              </div>
              <button onClick={removePdf} aria-label="PDF 첨부 취소">
                <IconX size={16} stroke={1.75} color="var(--text-secondary)" />
              </button>
            </div>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="여기에 길게 눌러 붙여넣기"
                rows={8}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] outline-none resize-none"
              />
              <button
                onClick={() => pdfInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong py-2 text-[12px] text-text-secondary"
              >
                <IconPaperclip size={14} stroke={1.75} />
                PDF 파일로 가져오기
              </button>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => handlePickPdf(e.target.files?.[0] ?? null)}
              />
            </>
          )}

          {error && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          {!loading && (
            <button
              onClick={handleAnalyze}
              disabled={!text.trim() && !pdfFile}
              className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[14px] font-medium"
              style={{
                background: text.trim() || pdfFile ? "var(--accent)" : "var(--surface-2)",
                color: text.trim() || pdfFile ? "#fff" : "var(--text-muted)",
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
