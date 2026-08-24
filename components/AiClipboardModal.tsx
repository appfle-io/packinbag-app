"use client";

import Portal from "@/components/Portal";

import { useEffect, useState } from "react";
import { IconSparkles, IconX, IconClipboardText } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { Bag } from "@/lib/types";
import {
  AI_FREE_DAILY_LIMIT,
  currentAiUsageCount,
  isUnlimitedAiUser,
} from "@/lib/aiUsageService";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

const LOADING_MESSAGES = [
  "클립보드 내용을 읽고 있어요",
  "이미 있는 항목과 비교하고 있어요",
  "새 항목만 골라내고 있어요",
  "어울리는 팩으로 나누고 있어요",
];

export interface AiClipboardResult {
  packs: { name: string; items: { text: string; checked: boolean }[] }[];
  skippedDuplicateCount: number;
}

export default function AiClipboardModal({
  bag,
  onClose,
  onApply,
}: {
  bag: Bag;
  onClose: () => void;
  onApply: (result: AiClipboardResult) => void;
}) {
  const { user, profile } = useAuth();
  const [text, setText] = useState("");
  const [clipboardReadFailed, setClipboardReadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(loading ? undefined : onClose);

  const unlimited = isUnlimitedAiUser(profile?.email, profile);

  // 열리자마자 클립보드를 자동으로 읽어서 채워준다 - 실패(권한 거부/네이티브 WKWebView
  // 제약 등)하면 조용히 빈 textarea로 두고 사용자가 직접 붙여넣게 한다. 네이티브 앱에서는
  // 이 웹 표준 API가 항상 통하지 않을 수 있어서(다른 WKWebView 제약 사례와 동일), 나중에
  // @capacitor/clipboard 플러그인으로 교체하면 네이티브에서도 자동 읽기가 더 안정적으로 될 것.
  useEffect(() => {
    let cancelled = false;
    navigator.clipboard
      ?.readText()
      .then((clipText) => {
        if (cancelled) return;
        if (clipText && clipText.trim()) setText(clipText);
        else setClipboardReadFailed(true);
      })
      .catch(() => {
        if (!cancelled) setClipboardReadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_MESSAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [loading]);

  const existingItems = bag.packs
    .filter((p) => p.kind !== "editor")
    .flatMap((p) => p.items.map((i) => i.text).filter((t) => t.trim()));

  const handleAnalyze = async () => {
    if (!text.trim() || loading || !user) return;
    setLoading(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const trimmed = text.trim();
      const isSpreadsheetUrl =
        (trimmed.startsWith("http://") || trimmed.startsWith("https://")) &&
        (trimmed.includes("docs.google.com/spreadsheets") || trimmed.includes("spreadsheet") || trimmed.endsWith(".csv"));

      if (isSpreadsheetUrl) {
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
        onApply({ packs: data.packs ?? [], skippedDuplicateCount: 0 });
        return;
      }

      const res = await fetch("/api/clipboard-organize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ text, existingItems }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "분석에 실패했어요");
      }
      onApply({ packs: data.packs ?? [], skippedDuplicateCount: data.skippedDuplicateCount ?? 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석에 실패했어요");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: ambientLayer + POPOVER_OFFSET, background: "rgba(0,0,0,0.45)" }}
        onClick={loading ? undefined : onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-medium flex items-center gap-1.5">
              <IconClipboardText size={16} stroke={1.75} color="var(--accent)" />
              AI 클립보드
            </span>
            {!loading && (
              <button onClick={onClose} aria-label="닫기">
                <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
              </button>
            )}
          </div>

          <p className="text-[12px] text-text-secondary">
            클립보드 내용을 보고, 지금 이 가방에 없는 항목만 새로 추가해드려요. 이미 있는 항목은
            자동으로 제외돼요.
          </p>

          {clipboardReadFailed && !text && !loading && (
            <p className="text-[11px] text-text-muted">
              클립보드를 자동으로 읽지 못했어요. 아래에 직접 붙여넣어주세요.
            </p>
          )}

          {!unlimited && (
            <p className="text-[11px] text-text-muted">
              오늘 AI 기능 {currentAiUsageCount(profile)}/{AI_FREE_DAILY_LIMIT}회 사용
            </p>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg py-8">
              <div
                className="pib-note-spin flex items-center justify-center rounded-full"
                style={{ width: 40, height: 40, background: "var(--accent-soft)" }}
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
              새 항목만 추가하기
            </button>
          )}
        </div>
      </div>
    </Portal>
  );
}
