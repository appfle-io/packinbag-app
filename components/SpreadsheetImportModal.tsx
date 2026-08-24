"use client";

import { useEffect, useState } from "react";
import { IconX, IconSparkles, IconTable, IconClipboard, IconAlertCircle, IconLoader2 } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { useAuth } from "@/contexts/AuthProvider";
import { ImportedBagResult } from "@/lib/types";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

const LOADING_MESSAGES = [
  "스프레드시트 데이터를 읽고 있어요...",
  "시트의 표 구조와 일정을 분석하고 있어요...",
  "체크리스트와 메모팩으로 나누고 있어요...",
  "가방과 팩을 완성하고 있어요...",
];

export default function SpreadsheetImportModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (result: ImportedBagResult) => void;
}) {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(loading ? undefined : onClose);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setError(null);
      }
    } catch {
      // ignore
    }
  };

  const handleAnalyze = async () => {
    const trimmed = url.trim();
    if (!trimmed || loading || !user) return;

    setLoading(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/import-spreadsheet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "스프레드시트 분석에 실패했어요");
      }

      onResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "스프레드시트 분석에 실패했어요");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
        style={{ zIndex: ambientLayer + POPOVER_OFFSET }}
        onClick={loading ? undefined : onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-surface border border-border p-5 flex flex-col gap-4 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-accent-soft text-accent">
                <IconTable size={18} />
              </div>
              <h2 className="text-[15px] font-bold text-foreground">스프레드시트 링크로 만들기</h2>
            </div>
            {!loading && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                aria-label="닫기"
              >
                <IconX size={18} />
              </button>
            )}
          </div>

          <p className="text-[12px] text-text-secondary leading-relaxed">
            구글 시트 또는 엑셀 웹 링크를 넣으면, AI가 표와 체크리스트를 자동으로 분석하여 가방과 팩을 만들어드려요.
          </p>

          {/* URL 입력 필드 */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(null);
                }}
                disabled={loading}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full rounded-xl border border-border bg-surface-2/60 hover:bg-surface-2 focus:bg-surface px-3.5 py-3 pr-20 text-[12.5px] text-foreground font-mono outline-none transition-all placeholder:text-text-muted placeholder:font-sans focus:border-accent disabled:opacity-60"
              />
              {!loading && (
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border text-[11px] font-medium text-text-secondary hover:text-foreground hover:border-accent transition-colors cursor-pointer shadow-2xs"
                >
                  <IconClipboard size={13} />
                  <span>붙여넣기</span>
                </button>
              )}
            </div>

            {/* 안내 팁 */}
            <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl bg-surface-2/40 border border-border/60 text-[11.5px] text-text-muted">
              <span className="text-accent font-bold shrink-0">💡 Tip:</span>
              <span>
                구글 시트 우측 상단 <strong>[공유]</strong>에서 접근 권한이 <strong>&apos;링크가 있는 모든 사용자(뷰어)&apos;</strong>로 설정되어 있어야 해요.
              </span>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-danger-soft/60 border border-danger/20 text-danger text-[12px] leading-snug">
              <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 로딩 애니메이션 */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-6 gap-3 text-center animate-in fade-in">
              <div className="relative flex items-center justify-center">
                <IconLoader2 size={32} className="animate-spin text-accent" />
                <IconSparkles size={16} className="absolute text-accent animate-pulse" />
              </div>
              <p className="text-[13px] font-semibold text-foreground">
                {LOADING_MESSAGES[loadingStep]}
              </p>
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-[12.5px] font-medium bg-surface-2 hover:bg-surface-3 text-foreground transition-colors cursor-pointer disabled:opacity-50"
            >
              취소
            </button>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!url.trim() || loading}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-accent hover:bg-accent-hover text-white transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconSparkles size={16} />
              <span>AI로 가방 생성하기</span>
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
