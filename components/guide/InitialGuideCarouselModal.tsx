"use client";

import { useState, useRef, useEffect } from "react";
import {
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconSparkles,
} from "@tabler/icons-react";
import Portal from "@/components/Portal";
import BackpackLogo from "@/components/BackpackLogo";
import GuideContent from "@/components/guide/GuideContent";
import GuideInstallDemo from "@/components/guide/GuideInstallDemo";
import { Announcement } from "@/lib/types";
import { OverlayLayerProvider } from "@/lib/overlayLayer";

export type IntroSlideType = "guide" | "install" | "announcement";

export interface IntroSlideItem {
  id: string;
  type: IntroSlideType;
  title: string;
  announcement?: Announcement;
  onDismiss: () => void;
}

export default function InitialGuideCarouselModal({
  slides,
  onClose,
}: {
  slides: IntroSlideItem[];
  onClose: () => void;
}) {
  const [activeSlideList, setActiveSlideList] = useState<IntroSlideItem[]>(slides);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  useEffect(() => {
    setActiveSlideList(slides);
    setCurrentIndex(0);
  }, [slides]);

  if (activeSlideList.length === 0) return null;

  const safeIndex = Math.min(currentIndex, activeSlideList.length - 1);
  const currentSlide = activeSlideList[safeIndex];

  const handlePrev = () => {
    if (safeIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (safeIndex < activeSlideList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleDismissCurrent = () => {
    // 1. 현재 슬라이드의 영구 dismiss 처리
    currentSlide.onDismiss();

    // 2. 현재 슬라이드를 리스트에서 제거하고 다음 슬라이드로 이동
    const nextList = activeSlideList.filter((_, idx) => idx !== safeIndex);
    setActiveSlideList(nextList);

    if (nextList.length === 0) {
      onClose();
    } else if (safeIndex >= nextList.length) {
      setCurrentIndex(nextList.length - 1);
    }
  };

  const handleCloseCurrent = () => {
    // 현재 슬라이드만 이번 모달에서 닫고(임시 건너뛰기), 다음 슬라이드로 이동
    const nextList = activeSlideList.filter((_, idx) => idx !== safeIndex);
    setActiveSlideList(nextList);

    if (nextList.length === 0) {
      onClose();
    } else if (safeIndex >= nextList.length) {
      setCurrentIndex(nextList.length - 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchDeltaX(0);
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || touchStartX === null) return;
    const diff = e.touches[0].clientX - touchStartX;
    setTouchDeltaX(diff);
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (touchDeltaX < -50 && safeIndex < activeSlideList.length - 1) {
      // 왼쪽으로 스와이프 -> 다음 슬라이드
      setCurrentIndex((prev) => prev + 1);
    } else if (touchDeltaX > 50 && safeIndex > 0) {
      // 오른쪽으로 스와이프 -> 이전 슬라이드
      setCurrentIndex((prev) => prev - 1);
    }

    setTouchStartX(null);
    setTouchDeltaX(0);
  };

  return (
    <Portal>
      <OverlayLayerProvider value={190}>
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl h-[90vh] max-h-[780px] rounded-2xl bg-background border border-border flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none"
          >
            {/* 상단 헤더 바 */}
            <div className="flex items-center justify-between p-3.5 px-4 border-b border-border bg-surface shrink-0 gap-2">
              {/* 좌측: 로고 + 슬라이드 제목 */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <BackpackLogo size={20} />
                <h2 className="text-[14px] font-semibold text-foreground truncate">
                  {currentSlide.title}
                </h2>
              </div>

              {/* 중앙: 슬라이드 페이지 인디케이터 & 이전/다음 버튼 */}
              {activeSlideList.length > 1 && (
                <div className="flex items-center gap-1 bg-surface-2 px-1.5 py-0.5 rounded-lg border border-border shrink-0">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={safeIndex === 0}
                    className={`p-1 rounded transition-colors ${
                      safeIndex === 0
                        ? "text-text-muted/40 cursor-not-allowed"
                        : "text-text-secondary hover:text-foreground hover:bg-surface cursor-pointer"
                    }`}
                    aria-label="이전 슬라이드"
                  >
                    <IconChevronLeft size={15} stroke={2} />
                  </button>

                  <span className="text-[11.5px] font-mono font-medium px-1 text-text-secondary">
                    {safeIndex + 1} / {activeSlideList.length}
                  </span>

                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={safeIndex === activeSlideList.length - 1}
                    className={`p-1 rounded transition-colors ${
                      safeIndex === activeSlideList.length - 1
                        ? "text-text-muted/40 cursor-not-allowed"
                        : "text-text-secondary hover:text-foreground hover:bg-surface cursor-pointer"
                    }`}
                    aria-label="다음 슬라이드"
                  >
                    <IconChevronRight size={15} stroke={2} />
                  </button>
                </div>
              )}

              {/* 우측: 다시 보지 않기 + 닫기(X) */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDismissCurrent}
                  className="text-[11px] text-text-muted hover:text-foreground px-2 py-1 rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  다시 보지 않기
                </button>
                <button
                  type="button"
                  onClick={handleCloseCurrent}
                  className="p-1 rounded-md text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                  aria-label="현재 항목 닫기"
                >
                  <IconX size={18} />
                </button>
              </div>
            </div>

            {/* 슬라이드 본문 컨텐츠 (터치 스와이프 지원) */}
            <div
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 transition-transform"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {currentSlide.type === "guide" && (
                <div className="flex flex-col gap-3">
                  <GuideContent />
                </div>
              )}

              {currentSlide.type === "install" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-[15px] font-bold text-foreground mb-1">
                      홈 화면에 앱으로 설치하기
                    </h3>
                    <p className="text-[12px] text-text-muted leading-relaxed">
                      별도의 앱 스토어 없이 브라우저에서 바로 앱으로 설치하여 더 빠르고 쾌적하게 사용할 수 있습니다.
                    </p>
                  </div>
                  <GuideInstallDemo />
                </div>
              )}

              {currentSlide.type === "announcement" && currentSlide.announcement && (
                <div className="flex flex-col gap-3 py-1">
                  <div className="flex items-center gap-1.5 text-accent font-semibold text-[12px]">
                    <IconSparkles size={16} stroke={2} />
                    <span>공지사항</span>
                  </div>

                  <h3 className="text-[16px] font-bold text-foreground leading-snug">
                    {currentSlide.announcement.title}
                  </h3>

                  <div className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-wrap rounded-xl bg-surface-2/60 p-3 border border-border">
                    {currentSlide.announcement.content}
                  </div>
                </div>
              )}
            </div>

            {/* 하단 탭 인디케이터 (슬라이드가 2개 이상일 때만 표시) */}
            {activeSlideList.length > 1 && (
              <div className="flex items-center justify-between p-2.5 px-4 border-t border-border bg-surface-2/40 text-[11px] text-text-muted shrink-0">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={safeIndex === 0}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                    safeIndex === 0
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:bg-surface hover:text-foreground cursor-pointer"
                  }`}
                >
                  <IconChevronLeft size={14} stroke={2} />
                  <span>이전</span>
                </button>

                {/* 중앙 도트 인디케이터 */}
                <div className="flex items-center gap-1.5">
                  {activeSlideList.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        idx === safeIndex ? "w-5 bg-accent" : "w-1.5 bg-border-strong hover:bg-text-muted"
                      }`}
                      aria-label={`슬라이드 ${idx + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={safeIndex === activeSlideList.length - 1}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                    safeIndex === activeSlideList.length - 1
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:bg-surface hover:text-foreground cursor-pointer"
                  }`}
                >
                  <span>다음</span>
                  <IconChevronRight size={14} stroke={2} />
                </button>
              </div>
            )}
          </div>
        </div>
      </OverlayLayerProvider>
    </Portal>
  );
}
