"use client";

import Portal from "@/components/Portal";

import { useEffect, useState } from "react";
import { IconX, IconSparkles } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import {
  AI_FREE_DAILY_LIMIT,
  currentAiUsageCount,
  isUnlimitedAiUser,
} from "@/lib/aiUsageService";
import { ImportedBagResult } from "@/lib/types";

// 다른 화면(HomeScreen, AppShell)에서 기존 이름으로 계속 import할 수 있도록 재수출.
export type NoteImportResult = ImportedBagResult;

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
  const { user, profile } = useAuth();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  const unlimited = isUnlimitedAiUser(profile?.email, profile);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_MESSAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [loading]);

  const handleAnalyze = async () => {
    if (!text.trim() || loading || !user) return;
    setLoading(true);
    setError(null);

    try {
      // 하루 사용 한도 확인+증가는 서버(Admin SDK)가 로그인 토큰을 직접 검증해서
      // 처리한다 - 클라이언트는 우회할 수 없다 (lib/aiQuotaServer.ts 참고).
      const idToken = await user.getIdToken();
      const res = await fetch("/api/import-note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
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

/* ============================================================================
 * PDF 첨부 기능 - appfle 요청으로 비활성화 (2026-07). 나중에 다시 필요하면 아래
 * 참고해서 복원하면 됨. (배포 후 실제로는 파일은 선택되지만 검증 실패 없이도
 * 조용히 안 붙는 현상이 있어 원인 파악 전 롤백함 - 재활성화 시 각 단계별로
 * console.log 찍어서 어디서 끊기는지부터 확인해볼 것)
 *
 * 1) import에 IconPaperclip, IconFileText 추가
 *    import { IconX, IconSparkles, IconPaperclip, IconFileText } from "@tabler/icons-react";
 *
 * 2) 컴포넌트 최상단에 상수/유틸 추가
 *    const MAX_PDF_BYTES = 3 * 1024 * 1024;
 *    function formatFileSize(bytes: number): string {
 *      if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
 *      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
 *    }
 *
 * 3) 컴포넌트 안에 state/ref 추가
 *    const [pdfFile, setPdfFile] = useState<File | null>(null);
 *    const pdfInputRef = useRef<HTMLInputElement>(null);
 *
 * 4) 핸들러 추가
 *    const handlePickPdf = (file: File | null) => {
 *      if (!file) return;
 *      setError(null);
 *      const looksLikePdf =
 *        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
 *      if (!looksLikePdf) {
 *        setError("PDF 파일만 첨부할 수 있어요");
 *        return;
 *      }
 *      if (file.size > MAX_PDF_BYTES) {
 *        setError(`PDF 파일은 ${formatFileSize(MAX_PDF_BYTES)} 이하만 첨부할 수 있어요`);
 *        return;
 *      }
 *      setText("");
 *      setPdfFile(file);
 *    };
 *
 *    const removePdf = () => {
 *      setPdfFile(null);
 *      if (pdfInputRef.current) pdfInputRef.current.value = "";
 *    };
 *
 *    const readFileAsBase64 = (file: File): Promise<string> =>
 *      new Promise((resolve, reject) => {
 *        const reader = new FileReader();
 *        reader.onload = () => {
 *          const result = reader.result as string;
 *          const base64 = result.split(",")[1] ?? "";
 *          resolve(base64);
 *        };
 *        reader.onerror = () => reject(reader.error);
 *        reader.readAsDataURL(file);
 *      });
 *
 * 5) handleAnalyze의 조건/body를 아래로 교체
 *    if ((!text.trim() && !pdfFile) || loading || !user) return;
 *    ...
 *    const body = pdfFile
 *      ? { pdfBase64: await readFileAsBase64(pdfFile), pdfMimeType: "application/pdf" }
 *      : { text };
 *
 * 6) textarea 있던 자리를 pdfFile 유무로 분기 - pdfFile이 있으면 파일 카드(이름+용량+삭제),
 *    없으면 기존 textarea + 아래에 "PDF 파일로 가져오기" 점선 버튼 + hidden file input
 *    (accept="application/pdf,.pdf") 렌더링. 서버(app/api/import-note/route.ts)는 이미
 *    pdfBase64/pdfMimeType을 받아서 Gemini에 inline_data로 넘기도록 되어 있어서 그대로 씀.
 * ==========================================================================*/
