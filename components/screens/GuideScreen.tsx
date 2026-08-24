"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { useSwipeBack } from "@/lib/useSwipeBack";
import BackpackLogo from "@/components/BackpackLogo";
import GuideHeroMotion from "@/components/guide/GuideHeroMotion";
import GuideGestureDemo from "@/components/guide/GuideGestureDemo";
import GuideCheckDemo from "@/components/guide/GuideCheckDemo";
import GuideBagButtonsDemo from "@/components/guide/GuideBagButtonsDemo";
import GuidePackSaveDemo from "@/components/guide/GuidePackSaveDemo";
import GuideMemoDemo from "@/components/guide/GuideMemoDemo";
import GuideShareDemo from "@/components/guide/GuideShareDemo";
import GuideShareCardsDemo from "@/components/guide/GuideShareCardsDemo";
import GuideViewModeDemo from "@/components/guide/GuideViewModeDemo";

export default function GuideScreen({ onBack }: { onBack: () => void }) {
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* 헤더 */}
      <div className="flex items-center gap-2 p-4 pb-3 shrink-0 border-b border-border bg-surface/80 backdrop-blur-xs">
        <button onClick={onBack} className="-m-2 p-2 text-text-secondary hover:text-foreground" aria-label="뒤로가기">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <div className="flex items-center gap-2">
          <BackpackLogo size={20} />
          <h1 className="text-[15px] font-semibold">팩인백 상세 사용 가이드</h1>
        </div>
      </div>

      {/* 본문 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-xl mx-auto w-full flex flex-col gap-4">
        {/* 상단 중앙: 가방에 팩이 쏙 들어가는 히어로 모션 */}
        <GuideHeroMotion />

        {/* 1. 짐 삭제(왼쪽 밀기) & 상세 수정(더블탭) 통합 */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">01</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              짐 삭제(왼쪽 밀기) & 상세 수정(더블탭)
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              짐을 왼쪽으로 밀어 삭제하고, 빠르게 두 번 탭(더블클릭)하면 상세 설정 모달이 열려요.
            </p>
          </div>

          <GuideGestureDemo />
        </div>

        {/* 2. 체크하기 */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">02</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              가볍게 탭해서 챙김 완료
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              짐을 챙겼다면 체크박스나 글씨를 탭하세요. 취소선이 그어지며 완료돼요.
            </p>
          </div>

          <GuideCheckDemo />
        </div>

        {/* 3. 가방 상단 버튼 4종 (팩뷰 / 심플뷰 / 집중모드 / 나만보기) */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">03</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              가방 화면의 보기 & 필터 버튼들
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              상단 버튼을 눌러 실제 팩뷰(카드형)와 심플뷰(문서형), 필터 모드를 전환해보세요.
            </p>
          </div>

          <GuideBagButtonsDemo />
        </div>

        {/* 4. 팩 보관함 저장 & 불러오기 */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">04</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              자주 쓰는 팩은 보관함에 저장 (재사용)
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              팩 하단 저장 아이콘을 누르고, 새 가방의 &apos;+ 팩 추가&apos; 버튼으로 보관함 팩을 담아보세요.
            </p>
          </div>

          <GuidePackSaveDemo />
        </div>

        {/* 5. 메모팩 서식 예시 & 편집 모달 */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">05</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              자유 문서형 메모팩 (서식, 표, 링크 & 실시간 동시 수정)
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              체크리스트 대신 일정표나 맛집을 메모팩으로 작성해보세요. 멤버와 함께 열면 실시간 커서가 보이며 동시에 함께 작성할 수 있어요.
            </p>
          </div>

          <GuideMemoDemo />
        </div>

        {/* 6. 공유 (그룹원 초대 vs 보기전용 링크) */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">06</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              공유 2가지 방식 (그룹원 초대 / 보기 전용)
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              카드를 누르면 실제 초대 모달과 보기 전용 가방 화면을 체험할 수 있어요.
            </p>
          </div>

          <GuideShareDemo />
        </div>

        {/* 7. 공유 카드 3종 & 메모팩 웹 문서 공유 */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">07</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              공유 카드 3종 & 메모팩 웹 문서 공유
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              SNS 공유 카드(탑승권/영수증/폴라로이드)와 가로폭이 넓어진 메모팩 전용 웹 문서 공유 모달을 열어보세요.
            </p>
          </div>

          <GuideShareCardsDemo />
        </div>

        {/* 8. 가방보관함 뷰 모드 & 화면 맞춤 (신규 추가) */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 mb-4 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">08</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              가방보관함 뷰 모드 (1열/2열/3열 빠른 전환)
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              메인 화면 상단의 뷰 버튼을 탭하여 시원한 1열 피드형과 컴팩트한 그리드형을 빠르게 전환해보세요. 설정 &gt; 화면설정에서 카드 크기와 글씨 크기도 조절할 수 있어요.
            </p>
          </div>

          <GuideViewModeDemo />
        </div>

        {/* 하단 완료 버튼 */}
        <div className="pb-6 flex justify-center">
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-xl py-3 text-[13.5px] font-medium shadow-xs transition-opacity hover:opacity-90 cursor-pointer"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            가방으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
