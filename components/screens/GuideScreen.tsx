"use client";

import { useState } from "react";
import {
  IconArrowLeft,
  IconSparkles,
  IconBackpack,
  IconNotes,
  IconShare,
  IconLayoutGrid,
} from "@tabler/icons-react";
import { useSwipeBack } from "@/lib/useSwipeBack";
import BackpackLogo from "@/components/BackpackLogo";
import GuideHeroMotion from "@/components/guide/GuideHeroMotion";
import GuideAiFeaturesDemo from "@/components/guide/GuideAiFeaturesDemo";
import GuideGestureDemo from "@/components/guide/GuideGestureDemo";
import GuideBagButtonsDemo from "@/components/guide/GuideBagButtonsDemo";
import GuideViewModeDemo from "@/components/guide/GuideViewModeDemo";
import GuideMemoDemo from "@/components/guide/GuideMemoDemo";
import GuidePackSaveDemo from "@/components/guide/GuidePackSaveDemo";
import GuideShareDemo from "@/components/guide/GuideShareDemo";
import GuideShareCardsDemo from "@/components/guide/GuideShareCardsDemo";
import GuideShortUrlDemo from "@/components/guide/GuideShortUrlDemo";

type CategoryFilter = "all" | "ai" | "basics" | "memo" | "share";

export default function GuideScreen({ onBack }: { onBack: () => void }) {
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 pb-3 shrink-0 border-b border-border bg-surface/80 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="-m-2 p-2 text-text-secondary hover:text-foreground cursor-pointer" aria-label="뒤로가기">
            <IconArrowLeft size={20} stroke={1.75} />
          </button>
          <div className="flex items-center gap-2">
            <BackpackLogo size={20} />
            <h1 className="text-[15px] font-semibold text-foreground">팩인백 상세 사용 가이드</h1>
          </div>
        </div>
      </div>

      {/* 대분류 필터 탭 바 */}
      <div className="shrink-0 px-4 py-2.5 bg-surface-2/40 border-b border-border/60 overflow-x-auto no-scrollbar">
        <div className="max-w-2xl mx-auto flex items-center gap-1.5 min-w-max text-[12px]">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer ${
              selectedCategory === "all"
                ? "bg-accent text-white shadow-2xs font-semibold"
                : "bg-surface border border-border text-text-secondary hover:text-foreground hover:border-border-strong"
            }`}
          >
            <IconLayoutGrid size={14} />
            <span>전체 보기</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("ai")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer ${
              selectedCategory === "ai"
                ? "bg-accent text-white shadow-2xs font-semibold"
                : "bg-surface border border-border text-text-secondary hover:text-foreground hover:border-border-strong"
            }`}
          >
            <IconSparkles size={14} />
            <span>스마트 AI 기능</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("basics")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer ${
              selectedCategory === "basics"
                ? "bg-accent text-white shadow-2xs font-semibold"
                : "bg-surface border border-border text-text-secondary hover:text-foreground hover:border-border-strong"
            }`}
          >
            <IconBackpack size={14} />
            <span>기본 조작 · 화면</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("memo")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer ${
              selectedCategory === "memo"
                ? "bg-accent text-white shadow-2xs font-semibold"
                : "bg-surface border border-border text-text-secondary hover:text-foreground hover:border-border-strong"
            }`}
          >
            <IconNotes size={14} />
            <span>메모팩 · 보관함</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("share")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer ${
              selectedCategory === "share"
                ? "bg-accent text-white shadow-2xs font-semibold"
                : "bg-surface border border-border text-text-secondary hover:text-foreground hover:border-border-strong"
            }`}
          >
            <IconShare size={14} />
            <span>공유 · URL 링크</span>
          </button>
        </div>
      </div>

      {/* 본문 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-5 max-w-2xl mx-auto w-full flex flex-col gap-6">
        {/* 상단 히어로 모션 */}
        {selectedCategory === "all" && <GuideHeroMotion />}

        {/* =========================================================================
            대분류 1: 스마트 AI 기능
           ========================================================================= */}
        {(selectedCategory === "all" || selectedCategory === "ai") && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/80 text-foreground font-semibold text-[14.5px]">
              <div className="p-1.5 rounded-lg bg-accent-soft text-accent">
                <IconSparkles size={16} />
              </div>
              <h2>스마트 AI 기능</h2>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
              <div className="flex flex-col gap-1.5 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent text-[11px] font-mono font-bold">
                    01
                  </span>
                  <h3 className="text-[15px] font-bold text-foreground tracking-tight">
                    AI 기능 종합 체험 (클립보드 · 스프레드시트 · 가방점검 · 날씨·명소)
                  </h3>
                </div>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">
                  복사한 텍스트 자동 분류, 구글 시트 링크 변환, 가방 빠진 짐 감사, 현지 날씨별 추천을 직접 탭하여 체험해보세요.
                </p>
              </div>
              <GuideAiFeaturesDemo />
            </div>
          </div>
        )}

        {/* =========================================================================
            대분류 2: 기본 짐 챙기기 및 화면 보기
           ========================================================================= */}
        {(selectedCategory === "all" || selectedCategory === "basics") && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/80 text-foreground font-semibold text-[14.5px]">
              <div className="p-1.5 rounded-lg bg-surface-2 text-foreground">
                <IconBackpack size={16} />
              </div>
              <h2>기본 짐 챙기기 및 화면 보기</h2>
            </div>

            {/* 02. 짐 조작 제스처 */}
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
              <div className="flex flex-col gap-1.5 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent text-[11px] font-mono font-bold">
                    02
                  </span>
                  <h3 className="text-[15px] font-bold text-foreground tracking-tight">
                    짐 조작 제스처 (체크 · 왼쪽 밀기 삭제 · 더블탭 상세설정)
                  </h3>
                </div>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">
                  탭하여 챙김 완료, 왼쪽으로 밀어 삭제하고, 더블탭하여 마감일과 담당자 등 상세 설정을 변경하세요.
                </p>
              </div>
              <GuideGestureDemo />
            </div>

            {/* 03. 가방 화면 뷰 & 필터 */}
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
              <div className="flex flex-col gap-1.5 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent text-[11px] font-mono font-bold">
                    03
                  </span>
                  <h3 className="text-[15px] font-bold text-foreground tracking-tight">
                    가방 화면의 보기 및 필터 버튼
                  </h3>
                </div>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">
                  상단 버튼을 눌러 카드형 팩뷰와 문서형 심플뷰, 남은 짐만 보는 집중모드와 나만보기 필터를 전환해보세요.
                </p>
              </div>
              <GuideBagButtonsDemo />
            </div>

            {/* 04. 가방보관함 뷰 모드 */}
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
              <div className="flex flex-col gap-1.5 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent text-[11px] font-mono font-bold">
                    04
                  </span>
                  <h3 className="text-[15px] font-bold text-foreground tracking-tight">
                    가방보관함 뷰 모드 (1열 · 2열 · 3열 전환)
                  </h3>
                </div>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">
                  메인 화면 상단에서 1열 피드형과 2열·3열 그리드를 빠르게 전환하고, 설정에서 카드와 글씨 크기를 조절할 수 있습니다.
                </p>
              </div>
              <GuideViewModeDemo />
            </div>
          </div>
        )}

        {/* =========================================================================
            대분류 3: 메모팩 및 팩 보관함
           ========================================================================= */}
        {(selectedCategory === "all" || selectedCategory === "memo") && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/80 text-foreground font-semibold text-[14.5px]">
              <div className="p-1.5 rounded-lg bg-surface-2 text-foreground">
                <IconNotes size={16} />
              </div>
              <h2>메모팩 및 팩 보관함</h2>
            </div>

            {/* 05. 자유 문서형 메모팩 */}
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
              <div className="flex flex-col gap-1.5 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent text-[11px] font-mono font-bold">
                    05
                  </span>
                  <h3 className="text-[15px] font-bold text-foreground tracking-tight">
                    자유 문서형 메모팩 (서식, 표, 링크 및 실시간 동시 수정)
                  </h3>
                </div>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">
                  체크리스트 대신 일정표나 맛집을 메모팩으로 작성하세요. 멤버와 함께 열면 실시간 커서가 보이며 동시에 공동 작성할 수 있습니다.
                </p>
              </div>
              <GuideMemoDemo />
            </div>

            {/* 06. 자주 쓰는 팩 보관함 */}
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
              <div className="flex flex-col gap-1.5 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent text-[11px] font-mono font-bold">
                    06
                  </span>
                  <h3 className="text-[15px] font-bold text-foreground tracking-tight">
                    자유로운 팩 보관함 (재사용 및 실시간 동기화)
                  </h3>
                </div>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">
                  자주 쓰는 팩을 보관함에 저장하여 새 가방에서 언제든 불러오고, 링크 연결을 켜두면 보관함과 가방의 내용이 실시간 동기화됩니다.
                </p>
              </div>
              <GuidePackSaveDemo />
            </div>
          </div>
        )}

        {/* =========================================================================
            대분류 4: 공유 및 URL 링크 관리
           ========================================================================= */}
        {(selectedCategory === "all" || selectedCategory === "share") && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/80 text-foreground font-semibold text-[14.5px]">
              <div className="p-1.5 rounded-lg bg-surface-2 text-foreground">
                <IconShare size={16} />
              </div>
              <h2>공유 및 URL 링크 관리</h2>
            </div>

            {/* 07. 공유 2가지 방식 */}
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
              <div className="flex flex-col gap-1.5 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent text-[11px] font-mono font-bold">
                    07
                  </span>
                  <h3 className="text-[15px] font-bold text-foreground tracking-tight">
                    가방 공유 2가지 방식 (그룹원 초대 · 보기 전용 링크)
                  </h3>
                </div>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">
                  함께 체크하는 그룹원 초대 모달과 안전하게 전달하는 보기 전용 가방 화면을 체험해보세요.
                </p>
              </div>
              <GuideShareDemo />
            </div>

            {/* 08. SNS 공유 카드 3종 & 웹 문서 공유 */}
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
              <div className="flex flex-col gap-1.5 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent text-[11px] font-mono font-bold">
                    08
                  </span>
                  <h3 className="text-[15px] font-bold text-foreground tracking-tight">
                    SNS 공유 카드 3종 및 메모팩 웹 공유
                  </h3>
                </div>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">
                  탑승권, 영수증, 폴라로이드 디자인의 이미지 카드와 메모팩 전용 웹 문서 링크를 생성할 수 있습니다.
                </p>
              </div>
              <GuideShareCardsDemo />
            </div>

            {/* 09. Short URL 및 Custom URL */}
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
              <div className="flex flex-col gap-1.5 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent text-[11px] font-mono font-bold">
                    09
                  </span>
                  <h3 className="text-[15px] font-bold text-foreground tracking-tight">
                    Short URL 및 Custom URL (링크 단축 · 나만의 별칭)
                  </h3>
                </div>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">
                  긴 쇼핑몰/예약 주소를 짧은 링크로 단축하고, 나만의 고유 별칭 주소를 생성하여 누적 클릭 수를 관리하세요.
                </p>
              </div>
              <GuideShortUrlDemo />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


