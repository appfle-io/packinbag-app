"use client";

import { useEffect, useState } from "react";
import { Bag } from "@/lib/types";
import { IconAlertTriangle, IconCheck, IconPlus, IconSparkles, IconX, IconLoader2, IconBulb } from "@tabler/icons-react";
import { User } from "firebase/auth";

interface MissingItem {
  category: string;
  text: string;
  reason: string;
  suggestedPackName: string;
}

interface AiBagAuditModalProps {
  bag: Bag;
  user: User | null;
  onClose: () => void;
  onAddItemToPack: (packName: string, itemText: string) => void;
  onShowPremiumLimit?: (msg: string) => void;
}

export default function AiBagAuditModal({
  bag,
  user,
  onClose,
  onAddItemToPack,
  onShowPremiumLimit,
}: AiBagAuditModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
  const [tripAdvice, setTripAdvice] = useState<string | null>(null);
  const [addedSet, setAddedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function runAudit() {
      if (!user) {
        setError("로그인이 필요해요");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const idToken = await user.getIdToken();
        const packsPayload = bag.packs
          .filter((p) => p.kind !== "editor" && p.type !== "folder")
          .map((p) => ({
            name: p.name,
            items: p.items.map((i) => i.text),
          }));

        const res = await fetch("/api/ai-audit-bag", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            bagName: bag.name,
            travelDate: bag.travelDate,
            weatherSummary: bag.aiRecommendCache?.weatherInfo
              ? `${bag.aiRecommendCache.city} 날씨: ${bag.aiRecommendCache.weatherInfo.weatherText}, ${bag.aiRecommendCache.weatherInfo.tempMin}°C ~ ${bag.aiRecommendCache.weatherInfo.tempMax}°C`
              : undefined,
            packs: packsPayload,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 403 && data.limitReached && onShowPremiumLimit) {
            onClose();
            onShowPremiumLimit(data.error);
            return;
          }
          throw new Error(data.error || "AI 분석에 실패했어요");
        }

        setMissingItems(data.missingItems || []);
        setTripAdvice(data.tripAdvice || null);
      } catch (err: any) {
        setError(err.message || "오류가 발생했어요");
      } finally {
        setLoading(false);
      }
    }

    runAudit();
  }, [bag, user]);

  const handleAdd = (item: MissingItem) => {
    onAddItemToPack(item.suggestedPackName, item.text);
    setAddedSet((prev) => new Set(prev).add(item.text));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-border rounded-xl p-5 shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <IconSparkles size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-foreground">AI 짐 누락 검수</h3>
              <p className="text-[11px] text-text-muted">놓치기 쉬운 필수품을 꼼꼼하게 찾았어요</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="닫기" className="p-1.5 -mr-1.5 rounded-full hover:bg-surface-2">
            <IconX size={18} />
          </button>
        </div>

        {/* 본문 영역 */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <IconLoader2 size={32} className="animate-spin text-accent mx-auto" />
              <p className="text-[14px] font-bold text-foreground">가방을 꼼꼼하게 검수하고 있어요...</p>
              <p className="text-[12px] text-text-muted max-w-xs mx-auto">
                여행지와 일정, 현재 짐 목록을 분석하여 빠진 물품을 찾고 있습니다.
              </p>
            </div>
          ) : error ? (
            <div className="py-12 text-center space-y-2">
              <IconAlertTriangle size={30} className="text-danger mx-auto" />
              <p className="text-[13px] text-danger font-medium">{error}</p>
            </div>
          ) : missingItems.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-1">
                <IconCheck size={22} stroke={3} />
              </div>
              <p className="text-[14px] font-bold text-foreground">빠진 필수품이 없어요!</p>
              <p className="text-[12px] text-text-muted">이미 모든 준비물을 완벽하게 잘 챙기셨습니다.</p>
            </div>
          ) : (
            <>
              {tripAdvice && (
                <div className="p-3.5 rounded-xl bg-accent-soft/60 border border-accent/20 flex items-start gap-2.5">
                  <IconBulb size={18} className="text-accent-strong shrink-0 mt-0.5" />
                  <p className="text-[12px] text-foreground leading-relaxed">
                    <strong className="font-bold text-accent-strong">여행 조언:</strong> {tripAdvice}
                  </p>
                </div>
              )}

              <p className="text-[12px] font-bold text-text-secondary px-1">
                추천 필수품 ({missingItems.length}개)
              </p>

              <div className="space-y-2.5">
                {missingItems.map((item, idx) => {
                  const isAdded = addedSet.has(item.text);

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-surface-2 border border-border flex items-start justify-between gap-3 transition-all"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-accent-soft text-accent-strong">
                            {item.category}
                          </span>
                          <span className="text-[14px] font-bold text-foreground truncate">
                            {item.text}
                          </span>
                        </div>
                        <p className="text-[12px] text-text-muted leading-snug">
                          {item.reason}
                        </p>
                        <p className="text-[11px] text-text-secondary">
                          추천 팩: <strong className="text-foreground">{item.suggestedPackName}</strong>
                        </p>
                      </div>

                      <button
                        onClick={() => handleAdd(item)}
                        disabled={isAdded}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1 transition-all ${
                          isAdded
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default"
                            : "bg-accent text-white hover:brightness-105 active:scale-95 shadow-xs"
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <IconCheck size={14} stroke={2.5} />
                            담김
                          </>
                        ) : (
                          <>
                            <IconPlus size={14} stroke={2.5} />
                            담기
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 하단 닫기 버튼 */}
        <div className="pt-3 border-t border-border mt-3">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-border hover:bg-surface-2 font-bold text-[13px] text-foreground transition-all"
          >
            확인 완료
          </button>
        </div>
      </div>
    </div>
  );
}
