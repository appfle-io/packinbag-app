"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  IconX,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconBulb,
  IconUser,
  IconSparkles,
} from "@tabler/icons-react";
import { Bag, Item, Pack } from "@/lib/types";
import Confetti from "./Confetti";
import Portal from "@/components/Portal";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";

interface PackingModeModalProps {
  bag: Bag;
  currentUid: string;
  onClose: () => void;
  onToggleItem: (packId: string, itemId: string) => void;
}

// 짐 체크 시 가벼운 성공 효과음 재생 (Web Audio API 활용, 별도 오디오 파일 불필요)
function playCheckSound() {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } catch {
    // 오디오 컨텍스트 지원 안 되는 경우 무시
  }
}

export default function PackingModeModal({
  bag,
  currentUid,
  onClose,
  onToggleItem,
}: PackingModeModalProps) {
  const [hideChecked, setHideChecked] = useState(false);
  const [onlyMyItems, setOnlyMyItems] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevCompletedRef = useRef<boolean>(false);

  const isShared = bag.memberIds.length > 1;

  // 1. Screen Wake Lock (화면 꺼짐 방지)
  useEffect(() => {
    let wakeLockSentinel: any = null;

    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator && typeof (navigator as any).wakeLock.request === "function") {
          wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
          setWakeLockActive(true);

          wakeLockSentinel.addEventListener("release", () => {
            setWakeLockActive(false);
          });
        }
      } catch (err) {
        console.warn("[패킹모드] Wake Lock 요청 불가:", err);
      }
    }

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, []);

  // 체크리스트 팩들만 추출 (kind !== 'editor' && type !== 'folder')
  const checklistPacks = useMemo(() => {
    return bag.packs.filter((p) => p.kind !== "editor" && p.type !== "folder");
  }, [bag.packs]);

  // 전체 진행도 계산
  const { totalItems, checkedItems, ratio } = useMemo(() => {
    let total = 0;
    let checked = 0;

    checklistPacks.forEach((p) => {
      p.items.forEach((item) => {
        if (onlyMyItems && item.assigneeUid && item.assigneeUid !== currentUid) return;
        total++;
        if (item.checked) checked++;
      });
    });

    const r = total > 0 ? Math.round((checked / total) * 100) : 0;
    return { totalItems: total, checkedItems: checked, ratio: r };
  }, [checklistPacks, onlyMyItems, currentUid]);

  // 100% 달성 시 폭죽 애니메이션
  useEffect(() => {
    if (totalItems > 0 && checkedItems === totalItems && !prevCompletedRef.current) {
      setShowConfetti(true);
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([100, 50, 150]);
      }
    }
    prevCompletedRef.current = totalItems > 0 && checkedItems === totalItems;
  }, [totalItems, checkedItems]);

  const handleItemClick = (packId: string, item: Item) => {
    onToggleItem(packId, item.id);
    if (!item.checked) {
      playCheckSound();
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(25);
      }
    }
  };

  const ambientLayer = useOverlayLayer();
  const resolvedZIndex = ambientLayer + POPOVER_OFFSET;

  return (
    <Portal>
      <div
        className="fixed inset-0 bg-background text-foreground flex flex-col animate-in fade-in duration-200"
        style={{ zIndex: resolvedZIndex }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* 100% 달성 시 축하 콘페티 */}
        {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

      {/* 상단 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-surface-2 active:scale-95 transition-transform"
            aria-label="패킹 모드 종료"
          >
            <IconX size={22} />
          </button>
          <div>
            <h1 className="text-[15px] font-bold truncate max-w-[200px] leading-tight">
              {bag.name}
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <span>집중 패킹 모드</span>
              {wakeLockActive && (
                <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] font-medium">
                  <IconBulb size={10} /> 화면 켜짐 유지
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 필터 토글 버튼들 */}
        <div className="flex items-center gap-1">
          {isShared && (
            <button
              onClick={() => setOnlyMyItems((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-1 transition-colors ${
                onlyMyItems
                  ? "bg-accent text-white"
                  : "bg-surface-2 text-text-secondary hover:text-foreground"
              }`}
            >
              <IconUser size={13} />
              내 짐만
            </button>
          )}

          <button
            onClick={() => setHideChecked((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-1 transition-colors ${
              hideChecked
                ? "bg-accent text-white"
                : "bg-surface-2 text-text-secondary hover:text-foreground"
            }`}
          >
            {hideChecked ? <IconEyeOff size={13} /> : <IconEye size={13} />}
            남은 짐만
          </button>
        </div>
      </header>

      {/* 상단 프로그레스 바 */}
      <div className="px-4 py-3 bg-surface border-b border-border shrink-0">
        <div className="flex items-center justify-between text-[13px] font-medium mb-1.5">
          <span className="text-text-secondary">
            챙긴 짐 <strong className="text-foreground font-bold">{checkedItems}</strong> / {totalItems}개
          </span>
          <span className="font-bold text-accent">{ratio}% 완료</span>
        </div>
        <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300 rounded-full"
            style={{ width: `${ratio}%` }}
          />
        </div>
      </div>

      {/* 메인 체크리스트 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {ratio === 100 && totalItems > 0 && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center animate-in zoom-in-95 duration-200">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-1.5">
              <IconSparkles size={18} />
            </div>
            <p className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400">
              모든 짐을 완벽하게 다 챙겼어요!
            </p>
            <p className="text-[12px] text-text-muted mt-0.5">
              잊은 물건 없이 완벽하게 준비되었습니다. 즐거운 여행 되세요!
            </p>
          </div>
        )}

        {checklistPacks.length === 0 ? (
          <div className="text-center py-20 text-text-muted text-[13px]">
            가방에 체크할 짐이 없어요.
          </div>
        ) : (
          checklistPacks.map((pack) => {
            const visibleItems = pack.items.filter((item) => {
              if (hideChecked && item.checked) return false;
              if (onlyMyItems && item.assigneeUid && item.assigneeUid !== currentUid) return false;
              return true;
            });

            if (visibleItems.length === 0 && hideChecked) return null;

            const packChecked = pack.items.filter((i) => i.checked).length;

            return (
              <div key={pack.id} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[14px] font-bold text-foreground flex items-center gap-1.5">
                    {pack.name}
                    <span className="text-[11px] font-normal text-text-muted">
                      ({packChecked}/{pack.items.length})
                    </span>
                  </h2>
                </div>

                <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs divide-y divide-border">
                  {visibleItems.length === 0 ? (
                    <div className="p-3 text-center text-[12px] text-text-muted">
                      모든 짐을 챙겼어요!
                    </div>
                  ) : (
                    visibleItems.map((item) => {
                      const isChecked = !!item.checked;
                      const assigneeProfile = item.assigneeUid
                        ? bag.memberProfiles?.[item.assigneeUid]
                        : null;

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick(pack.id, item)}
                          className={`flex items-center gap-3.5 px-4 py-3.5 active:bg-surface-2 cursor-pointer transition-colors ${
                            isChecked ? "opacity-45 bg-surface/40" : ""
                          }`}
                        >
                          {/* 큼직한 터치 체크박스 */}
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                              isChecked
                                ? "bg-accent border-accent text-white shadow-xs"
                                : "border-border-strong bg-surface"
                            }`}
                          >
                            {isChecked && <IconCheck size={16} stroke={3} />}
                          </div>

                          {/* 짐 텍스트 */}
                          <span
                            className={`flex-1 text-[15px] leading-snug font-medium select-none ${
                              isChecked ? "line-through text-text-muted" : "text-foreground"
                            }`}
                          >
                            {item.text}
                          </span>

                          {/* 담당자 뱃지 */}
                          {isShared && assigneeProfile && (
                            <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md bg-accent-soft text-accent-strong">
                              {assigneeProfile.nickname || "멤버"}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
    </Portal>
  );
}
