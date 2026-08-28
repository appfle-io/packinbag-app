"use client";

import { useState, useRef } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import GuideAiFeaturesDemo from "./GuideAiFeaturesDemo";
import GuideGestureDemo from "./GuideGestureDemo";
import GuideBagButtonsDemo from "./GuideBagButtonsDemo";
import GuideViewModeDemo from "./GuideViewModeDemo";
import GuideMemoDemo from "./GuideMemoDemo";
import GuidePackSaveDemo from "./GuidePackSaveDemo";
import GuideShareDemo from "./GuideShareDemo";
import GuideShareCardsDemo from "./GuideShareCardsDemo";
import GuideShortUrlDemo from "./GuideShortUrlDemo";

export type CategoryFilter = "basics" | "ai" | "memo" | "share";

interface GuideBadge {
  label: string;
  variant?: "accent" | "red" | "default";
}

interface GuideCard {
  id: string;
  title: string;
  badges: GuideBadge[];
  component: React.ReactNode;
}

interface GuideContentProps {
  className?: string;
  defaultCategory?: CategoryFilter;
}

export default function GuideContent({
  className = "",
  defaultCategory = "basics",
}: GuideContentProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>(defaultCategory);
  const [cardIndex, setCardIndex] = useState<number>(0);

  // 스와이프 제스처
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);

  // 탭별 카드 목록 정의 (텍스트 극소화 & 포인트 키워드)
  const categoryCards: Record<CategoryFilter, GuideCard[]> = {
    basics: [
      {
        id: "gesture",
        title: "탭하여 체크, 밀어서 삭제",
        badges: [
          { label: "탭: 완료", variant: "default" },
          { label: "왼쪽 밀기: 삭제", variant: "default" },
          { label: "더블 탭: 수정", variant: "default" },
        ],
        component: <GuideGestureDemo />,
      },
      {
        id: "bag-views",
        title: "내게 맞는 화면 보기 모드",
        badges: [
          { label: "팩뷰 / 심플뷰", variant: "accent" },
          { label: "집중 모드", variant: "default" },
          { label: "나만 보기", variant: "default" },
        ],
        component: <GuideBagButtonsDemo />,
      },
      {
        id: "view-mode",
        title: "가방 목록 1·2·3열 보기",
        badges: [
          { label: "1열 피드형", variant: "accent" },
          { label: "2·3열 모아보기", variant: "default" },
        ],
        component: <GuideViewModeDemo />,
      },
    ],
    ai: [
      {
        id: "ai-all",
        title: "복사한 글을 그대로 붙여넣기",
        badges: [
          { label: "클립보드 분류", variant: "accent" },
          { label: "빠진 짐 점검", variant: "accent" },
          { label: "시트 연동", variant: "default" },
          { label: "날씨 추천", variant: "default" },
        ],
        component: <GuideAiFeaturesDemo />,
      },
    ],
    memo: [
      {
        id: "memo-pack",
        title: "기본에 충실한 메모팩",
        badges: [
          { label: "자유 문서 서식", variant: "accent" },
          { label: "실시간 공동 편집", variant: "default" },
        ],
        component: <GuideMemoDemo />,
      },
      {
        id: "pack-save",
        title: "자주 쓰는 짐은 보관함에서 쏙",
        badges: [
          { label: "새 가방 재사용", variant: "accent" },
          { label: "실시간 동기화", variant: "default" },
        ],
        component: <GuidePackSaveDemo />,
      },
    ],
    share: [
      {
        id: "share-mode",
        title: "상황에 맞춰 2가지로 공유",
        badges: [
          { label: "그룹 초대 (함께 체크)", variant: "accent" },
          { label: "보기 전용 (읽기 전용)", variant: "default" },
        ],
        component: <GuideShareDemo />,
      },
      {
        id: "share-card",
        title: "SNS 감성 카드 & 웹 문서",
        badges: [
          { label: "탑승권·영수증 카드", variant: "accent" },
          { label: "메모팩 웹 링크", variant: "default" },
        ],
        component: <GuideShareCardsDemo />,
      },
      {
        id: "short-url",
        title: "긴 링크는 깔끔하게 단축",
        badges: [
          { label: "쇼핑몰 링크 단축", variant: "accent" },
          { label: "나만의 고유 주소", variant: "accent" },
        ],
        component: <GuideShortUrlDemo />,
      },
    ],
  };

  const handleSelectCategory = (cat: CategoryFilter) => {
    setSelectedCategory(cat);
    setCardIndex(0);
  };

  const currentCards = categoryCards[selectedCategory];
  const totalCards = currentCards.length;
  const activeCard = currentCards[Math.min(cardIndex, totalCards - 1)];

  const handlePrevCard = () => {
    setCardIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextCard = () => {
    setCardIndex((prev) => Math.min(totalCards - 1, prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null) return;
    const delta = touchDeltaXRef.current;
    if (delta < -45 && cardIndex < totalCards - 1) {
      handleNextCard();
    } else if (delta > 45 && cardIndex > 0) {
      handlePrevCard();
    }
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
  };

  return (
    <div className={`w-full flex flex-col overflow-hidden ${className}`}>
      {/* 1. 상단 카테고리 세그먼트 탭 (이모지/아이콘 제거) */}
      <div className="shrink-0 px-4 py-2.5 bg-surface border-b border-border/80 sticky top-0 z-10">
        <div className="max-w-xl mx-auto grid grid-cols-4 gap-1 p-1 bg-surface-2 rounded-xl border border-border/60 text-[12.5px]">
          <button
            type="button"
            onClick={() => handleSelectCategory("basics")}
            className={`flex items-center justify-center py-2 rounded-lg font-medium transition-all cursor-pointer ${
              selectedCategory === "basics"
                ? "bg-surface text-accent font-bold shadow-xs border border-border/80"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            <span className="hidden xs:inline">기본 조작</span>
            <span className="xs:hidden">기본</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectCategory("ai")}
            className={`flex items-center justify-center py-2 rounded-lg font-medium transition-all cursor-pointer ${
              selectedCategory === "ai"
                ? "bg-surface text-accent font-bold shadow-xs border border-border/80"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            <span className="hidden xs:inline">스마트 AI</span>
            <span className="xs:hidden">AI</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectCategory("memo")}
            className={`flex items-center justify-center py-2 rounded-lg font-medium transition-all cursor-pointer ${
              selectedCategory === "memo"
                ? "bg-surface text-accent font-bold shadow-xs border border-border/80"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            <span className="hidden xs:inline">메모 · 보관</span>
            <span className="xs:hidden">메모</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectCategory("share")}
            className={`flex items-center justify-center py-2 rounded-lg font-medium transition-all cursor-pointer ${
              selectedCategory === "share"
                ? "bg-surface text-accent font-bold shadow-xs border border-border/80"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            <span className="hidden xs:inline">공유 · 링크</span>
            <span className="xs:hidden">공유</span>
          </button>
        </div>
      </div>

      {/* 2. 본문 카드 슬라이드 뷰 (단 1개 카드만 큼직하게 노출) */}
      <div
        className="overflow-y-auto px-4 py-4 max-w-xl mx-auto w-full flex flex-col gap-3.5 scrollbar-thin"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 카드 헤더 + 데모 컴포넌트 */}
        <div
          key={activeCard.id}
          className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs animate-in fade-in duration-200"
        >
          {/* 카드 상단: 번호/인디케이터 + 타이틀 + 포인트 칩 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[16.5px] sm:text-[17.5px] font-bold text-foreground tracking-tight">
                {activeCard.title}
              </h3>
              {totalCards > 1 && (
                <span className="text-[11.5px] font-mono font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-text-secondary border border-border/60 shrink-0">
                  {cardIndex + 1} / {totalCards}
                </span>
              )}
            </div>

            {/* 핵심 포인트 컬러 칩 (글 대신 시각적 태그) */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11.5px] pt-0.5">
              {activeCard.badges.map((b, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold ${
                    b.variant === "accent"
                      ? "bg-accent-soft text-accent"
                      : b.variant === "red"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-surface-2 text-text-secondary border border-border/50"
                  }`}
                >
                  {b.variant === "accent" && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                  {b.variant === "red" && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          {/* 데모 컴포넌트 캔버스 */}
          <div className="pt-1">
            {activeCard.component}
          </div>
        </div>

        {/* 3. 하단 페이징 컨트롤 바 (카드가 2장 이상일 때만 노출) */}
        {totalCards > 1 && (
          <div className="shrink-0 flex items-center justify-between px-2 py-1 select-none">
            <button
              type="button"
              onClick={handlePrevCard}
              disabled={cardIndex === 0}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-all cursor-pointer ${
                cardIndex === 0
                  ? "opacity-30 border-transparent text-text-muted cursor-not-allowed"
                  : "bg-surface border-border text-foreground hover:bg-surface-2 shadow-2xs"
              }`}
            >
              <IconChevronLeft size={16} stroke={2} />
              <span>이전</span>
            </button>

            {/* 중앙 도트 인디케이터 */}
            <div className="flex items-center gap-1.5">
              {currentCards.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCardIndex(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === cardIndex
                      ? "w-6 bg-accent"
                      : "w-2 bg-border-strong hover:bg-text-muted"
                  }`}
                  aria-label={`카드 ${idx + 1}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNextCard}
              disabled={cardIndex === totalCards - 1}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-all cursor-pointer ${
                cardIndex === totalCards - 1
                  ? "opacity-30 border-transparent text-text-muted cursor-not-allowed"
                  : "bg-surface border-border text-foreground hover:bg-surface-2 shadow-2xs"
              }`}
            >
              <span>다음</span>
              <IconChevronRight size={16} stroke={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
