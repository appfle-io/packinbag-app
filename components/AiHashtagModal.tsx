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

const MAX_TAGS = 3;

const LOADING_MESSAGES = [
  "해시태그를 분석하고 있어요",
  "어울리는 상황을 떠올리고 있어요",
  "필요한 준비물을 정리하고 있어요",
  "팩으로 나눠서 채워넣고 있어요",
];

export default function AiHashtagModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (result: ImportedBagResult) => void;
}) {
  const { user, profile } = useAuth();
  const [draft, setDraft] = useState("");
  const [tags, setTags] = useState<string[]>([]);
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

  const addTag = () => {
    const t = draft.trim().replace(/^#/, "").slice(0, 20);
    if (!t || tags.length >= MAX_TAGS || tags.includes(t)) {
      setDraft("");
      return;
    }
    setTags((prev) => [...prev, t]);
    setDraft("");
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const handleGenerate = async () => {
    if (tags.length === 0 || loading || !user) return;
    setLoading(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/generate-sample", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ tags }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "생성에 실패했어요");
      }
      onResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성에 실패했어요");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={loading ? undefined : onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-medium">해시태그로 AI가 만들기</span>
            {!loading && (
              <button onClick={onClose} aria-label="닫기">
                <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
              </button>
            )}
          </div>

          <p className="text-[12px] text-text-secondary">
            원하는 상황을 해시태그 최대 {MAX_TAGS}개로 알려주시면, AI가 어울리는 팩과 짐을
            만들어드려요. (예: #결혼준비 #셀프 #예산)
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
            <>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px]"
                      style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                    >
                      #{t}
                      <button onClick={() => removeTag(t)} aria-label={`${t} 삭제`}>
                        <IconX size={11} stroke={2} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {tags.length < MAX_TAGS && (
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  onBlur={addTag}
                  placeholder="해시태그 입력 후 엔터 (예: 캠핑)"
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] outline-none"
                />
              )}
            </>
          )}

          {error && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          {!loading && (
            <button
              onClick={handleGenerate}
              disabled={tags.length === 0}
              className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[14px] font-medium"
              style={{
                background: tags.length > 0 ? "var(--accent)" : "var(--surface-2)",
                color: tags.length > 0 ? "#fff" : "var(--text-muted)",
              }}
            >
              <IconSparkles size={15} stroke={1.75} />
              AI로 만들기
            </button>
          )}
        </div>
      </div>
    </Portal>
  );
}
