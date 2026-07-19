"use client";

import Portal from "@/components/Portal";

import { useEffect, useMemo, useState } from "react";
import { IconSparkles, IconX } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { Bag, Item, Pack } from "@/lib/types";
import {
  AI_FREE_DAILY_LIMIT,
  currentAiUsageCount,
  isUnlimitedAiUser,
} from "@/lib/aiUsageService";

const LOADING_MESSAGES = [
  "짐 목록을 훑어보고 있어요",
  "비슷한 항목끼리 묶고 있어요",
  "팩 이름을 다듬고 있어요",
  "새 구조로 정리하고 있어요",
];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function AiOrganizeModal({
  bag,
  onClose,
  onApply,
}: {
  bag: Bag;
  onClose: () => void;
  onApply: (packs: Pack[]) => void;
}) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  const unlimited = isUnlimitedAiUser(profile?.email, profile);

  const flatItems = useMemo(() => bag.packs.flatMap((p) => p.items), [bag.packs]);
  const emptyCount = flatItems.filter((i) => !i.text.trim()).length;
  const canRun = flatItems.length >= 2 && emptyCount === 0;

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_MESSAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [loading]);

  const handleRun = async () => {
    if (!canRun || loading || !user) return;
    setLoading(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/organize-bag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          items: flatItems.map((item, index) => ({ index, text: item.text })),
          existingPackNames: bag.packs.map((p) => p.name).filter((n) => n && n !== "새 팩"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "정리에 실패했어요");
      }

      const groups: { name: string; itemIndices: number[] }[] = data.packs ?? [];
      const newPacks: Pack[] = groups
        .map((g) => ({
          id: uid(),
          name: g.name,
          // AI는 index만 다루고 항목 자체(텍스트/체크 상태/타입)는 원본 Item 객체를
          // 그대로 재사용하므로, 문구나 체크 상태가 바뀌거나 사라질 위험이 없다.
          items: g.itemIndices
            .map((idx) => flatItems[idx])
            .filter((item): item is Item => !!item),
        }))
        .filter((p) => p.items.length > 0);

      onApply(newPacks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "정리에 실패했어요");
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
            <span className="text-[16px] font-medium">AI로 정리하기</span>
            {!loading && (
              <button onClick={onClose} aria-label="닫기">
                <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
              </button>
            )}
          </div>

          <p className="text-[12px] text-text-secondary">
            지금 이 가방에 있는 짐 {flatItems.length}개를 AI가 훑어보고, 문구·체크 상태는
            그대로 둔 채 더 어울리는 팩(카테고리)으로 다시 묶어드려요.
          </p>

          {!canRun && !loading && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              {flatItems.length < 2
                ? "정리할 짐이 너무 적어요 (2개 이상 필요해요)"
                : "빈 짐 항목을 채우거나 삭제한 뒤 다시 시도해주세요"}
            </p>
          )}

          {!unlimited && (
            <p className="text-[11px] text-text-muted">
              오늘 AI 기능 {currentAiUsageCount(profile)}/{AI_FREE_DAILY_LIMIT}회 사용
            </p>
          )}

          {loading && (
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
          )}

          {error && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          {!loading && (
            <button
              onClick={handleRun}
              disabled={!canRun}
              className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[14px] font-medium"
              style={{
                background: canRun ? "var(--accent)" : "var(--surface-2)",
                color: canRun ? "#fff" : "var(--text-muted)",
              }}
            >
              <IconSparkles size={15} stroke={1.75} />
              AI로 정리하기
            </button>
          )}
        </div>
      </div>
    </Portal>
  );
}
