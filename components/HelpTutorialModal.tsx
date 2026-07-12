"use client";

import { useEffect, useState } from "react";
import Portal from "@/components/Portal";
import { IconX, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

export interface HelpSlide {
  src: string;
  alt: string;
}

// 물음표(?) 버튼을 눌렀을 때 뜨는 사용법 안내 슬라이드 뷰어. ImageLightbox와 같은
// 패턴(Portal + 어두운 배경 + 좌우 화살표 + 하단 점 인디케이터)을 그대로 따른다.
// 이미지 자체에는 이미 "N / 7" 진행 표시와 설명 카드가 그려져 있으므로(help_slide_generator.py
// 참고), 이 컴포넌트는 순수하게 넘기는 동작만 담당한다.
export default function HelpTutorialModal({
  slides,
  onClose,
}: {
  slides: HelpSlide[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const hasMultiple = slides.length > 1;

  const goPrev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);
  const goNext = () => setIndex((i) => (i + 1) % slides.length);

  // 키보드 좌우 화살표로도 넘길 수 있게 (데스크톱/웹 편의)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  // 스와이프 제스처 (모바일)
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      if (dx > 0) goPrev();
      else goNext();
    }
    setTouchStartX(null);
  };

  if (slides.length === 0) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[96] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.85)" }}
        onClick={onClose}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-4 right-4 h-9 w-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <IconX size={20} stroke={1.75} color="#fff" />
        </button>

        {hasMultiple && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="이전 설명"
              className="absolute left-2 sm:left-4 h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <IconChevronLeft size={20} stroke={1.75} color="#fff" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="다음 설명"
              className="absolute right-2 sm:right-4 h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <IconChevronRight size={20} stroke={1.75} color="#fff" />
            </button>
          </>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slides[index].src}
          alt={slides[index].alt}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain rounded-lg"
        />

        {hasMultiple && (
          <div className="absolute bottom-4 flex gap-1.5">
            {slides.map((_, i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: i === index ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Portal>
  );
}
