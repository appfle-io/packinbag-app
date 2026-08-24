"use client";

import { useState } from "react";
import { IconArrowLeft, IconClick } from "@tabler/icons-react";
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
import ItemEditModal from "@/components/ItemEditModal";
import { GUIDE_SAMPLE_BAG, GUIDE_SAMPLE_ITEM, GUIDE_SAMPLE_MEMBERS } from "@/lib/guideSampleData";

export default function GuideScreen({ onBack }: { onBack: () => void }) {
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  const [showItemEditModal, setShowItemEditModal] = useState(false);
  const [sampleItem, setSampleItem] = useState(GUIDE_SAMPLE_ITEM);

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

        {/* 1. 스와이프 제스처 */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">01</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              짐 밀어서 수정 / 삭제 (스와이프)
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              목록의 짐을 좌우로 직접 밀거나 아래 버튼을 눌러보세요.
            </p>
          </div>

          <GuideGestureDemo />
        </div>

        {/* 2. 더블클릭 / 더블탭 수정 모달 */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">02</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              더블클릭(더블탭)으로 세부 수정
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              짐이나 팩을 <strong>빠르게 두 번 탭(더블클릭)</strong>하면 실제 짐 상세 설정 모달이 열려요.
            </p>
          </div>

          <div
            onDoubleClick={() => setShowItemEditModal(true)}
            onTouchEnd={(e) => {
              const now = Date.now();
              // @ts-expect-error - custom property for double tap tracking
              if (e.currentTarget._lastTap && now - e.currentTarget._lastTap < 350) {
                setShowItemEditModal(true);
              }
              // @ts-expect-error - custom property for double tap tracking
              e.currentTarget._lastTap = now;
            }}
            className="rounded-xl border border-border/40 bg-surface-2/20 p-3.5 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform select-none"
          >
            <div className="flex items-center gap-2.5">
              <IconClick size={18} stroke={1.75} className="text-accent" />
              <div>
                <p className="text-[13px] font-medium text-foreground">{sampleItem.text}</p>
                <p className="text-[11px] text-text-muted">여기를 빠르게 2번 탭 또는 더블클릭해보세요</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowItemEditModal(true);
              }}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-surface/50 border border-border/60 hover:border-accent text-text-secondary hover:text-foreground shrink-0"
            >
              수정 모달 열기
            </button>
          </div>
        </div>

        {/* 3. 체크하기 */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">03</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              가볍게 탭해서 챙김 완료
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              짐을 챙겼다면 체크박스나 글씨를 탭하세요. 취소선이 그어지며 완료돼요.
            </p>
          </div>

          <GuideCheckDemo />
        </div>

        {/* 4. 가방 상단 버튼 4종 (팩뷰 / 심플뷰 / 집중모드 / 나만보기) */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">04</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              가방 화면의 보기 & 필터 버튼들
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              상단 버튼을 눌러 실제 <strong>팩뷰(카드형)</strong>와 <strong>심플뷰(문서형)</strong>, 필터 모드를 전환해보세요!
            </p>
          </div>

          <GuideBagButtonsDemo />
        </div>

        {/* 5. 팩 보관함 저장 & 불러오기 */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">05</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              자주 쓰는 팩은 보관함에 저장 (재사용)
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              팩 하단 저장 아이콘을 누르고, 새 가방의 <strong>&apos;+ 팩 추가&apos;</strong> 버튼으로 보관함 팩을 담아보세요!
            </p>
          </div>

          <GuidePackSaveDemo />
        </div>

        {/* 6. 메모팩 서식 예시 & 편집 모달 */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">06</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              자유 문서형 메모팩 (서식, 표, 링크)
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              체크리스트 대신 일정표나 맛집을 메모팩으로 써보세요. 카드를 누르면 직접 써볼 수 있어요.
            </p>
          </div>

          <GuideMemoDemo />
        </div>

        {/* 7. 공유 (그룹원 초대 vs 보기전용 링크) */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">07</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              공유 2가지 방식 (그룹원 초대 / 보기 전용)
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              카드를 누르면 실제 초대 모달과 보기 전용 가방 화면을 체험할 수 있어요.
            </p>
          </div>

          <GuideShareDemo />
        </div>

        {/* 8. 공유 카드 3종 */}
        <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 mb-4 shadow-xs">
          <div>
            <span className="text-[11px] font-mono font-bold text-accent">08</span>
            <h2 className="text-[14px] font-semibold text-foreground mt-0.5">
              SNS/메신저 공유 카드 3종 (탑승권/영수증/폴라로이드)
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              버튼을 클릭하면 실제 공유 카드 모달이 열려요.
            </p>
          </div>

          <GuideShareCardsDemo />
        </div>

        {/* 하단 완료 버튼 */}
        <div className="pb-6 flex justify-center">
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-xl py-3 text-[13.5px] font-medium shadow-xs transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            가방으로 돌아가기
          </button>
        </div>
      </div>

      {/* 더블클릭 시 열리는 실제 앱의 ItemEditModal */}
      {showItemEditModal && (
        <ItemEditModal
          packs={GUIDE_SAMPLE_BAG.packs}
          selectionMode="single"
          initialSelectedPackIds={["pack-1"]}
          mode="edit"
          initialType="check"
          initialText={sampleItem.text}
          initialDueDate={sampleItem.dueDate}
          members={GUIDE_SAMPLE_MEMBERS}
          onClose={() => setShowItemEditModal(false)}
          onSave={(_targetPackIds, data) => {
            setSampleItem((prev) => ({
              ...prev,
              text: data.text,
              dueDate: data.dueDate,
              assigneeUid: data.assigneeUid,
            }));
            setShowItemEditModal(false);
          }}
        />
      )}
    </div>
  );
}
