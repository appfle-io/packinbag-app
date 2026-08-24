"use client";

import { IconX } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import BackpackLogo from "@/components/BackpackLogo";
import GuideHeroMotion from "@/components/guide/GuideHeroMotion";
import GuideGestureDemo from "@/components/guide/GuideGestureDemo";
import GuideCheckDemo from "@/components/guide/GuideCheckDemo";
import GuideBagButtonsDemo from "@/components/guide/GuideBagButtonsDemo";
import GuidePackSaveDemo from "@/components/guide/GuidePackSaveDemo";
import GuideMemoDemo from "@/components/guide/GuideMemoDemo";
import GuideShareDemo from "@/components/guide/GuideShareDemo";
import GuideShareCardsDemo from "@/components/guide/GuideShareCardsDemo";
import { OverlayLayerProvider } from "@/lib/overlayLayer";

export default function GuideModal({
  onClose,
  onDismissForever,
}: {
  onClose: () => void;
  onDismissForever: () => void;
}) {
  return (
    <Portal>
      <OverlayLayerProvider value={190}>
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg h-[90vh] max-h-[750px] rounded-2xl bg-background border border-border flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            {/* 모달 상단 헤더: 제목 + 다시 보지 않기 + 닫기 */}
            <div className="flex items-center justify-between p-3.5 px-4 border-b border-border bg-surface shrink-0">
              <div className="flex items-center gap-2">
                <BackpackLogo size={20} />
                <h2 className="text-[14.5px] font-semibold text-foreground">팩인백 사용 가이드</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDismissForever}
                  className="text-[11.5px] text-text-muted hover:text-foreground px-2 py-1 rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  다시 보지 않기
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-md text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>
            </div>

            {/* 본문 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {/* 상단 중앙: 가방에 팩이 쏙 들어가는 히어로 모션 */}
              <GuideHeroMotion />

              {/* 1. 짐 삭제(왼쪽 밀기) & 상세 수정(더블탭) 통합 */}
              <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
                <div>
                  <span className="text-[11px] font-mono font-bold text-accent">01</span>
                  <h3 className="text-[14px] font-semibold text-foreground mt-0.5">
                    짐 삭제(왼쪽 밀기) & 상세 수정(더블탭)
                  </h3>
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
                  <h3 className="text-[14px] font-semibold text-foreground mt-0.5">
                    가볍게 탭해서 챙김 완료
                  </h3>
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
                  <h3 className="text-[14px] font-semibold text-foreground mt-0.5">
                    가방 화면의 보기 & 필터 버튼들
                  </h3>
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
                  <h3 className="text-[14px] font-semibold text-foreground mt-0.5">
                    자주 쓰는 팩은 보관함에 저장 (재사용)
                  </h3>
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
                  <h3 className="text-[14px] font-semibold text-foreground mt-0.5">
                    자유 문서형 메모팩 (서식, 표, 링크)
                  </h3>
                  <p className="text-[12px] text-text-secondary mt-0.5">
                    체크리스트 대신 일정표나 맛집을 메모팩으로 써보세요. 카드를 누르면 직접 써볼 수 있어요.
                  </p>
                </div>

                <GuideMemoDemo />
              </div>

              {/* 6. 공유 (그룹원 초대 vs 보기전용 링크) */}
              <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 shadow-xs">
                <div>
                  <span className="text-[11px] font-mono font-bold text-accent">06</span>
                  <h3 className="text-[14px] font-semibold text-foreground mt-0.5">
                    공유 2가지 방식 (그룹원 초대 / 보기 전용)
                  </h3>
                  <p className="text-[12px] text-text-secondary mt-0.5">
                    카드를 누르면 실제 초대 모달과 보기 전용 가방 화면을 체험할 수 있어요.
                  </p>
                </div>

                <GuideShareDemo />
              </div>

              {/* 7. 공유 카드 3종 & 메모팩 웹 문서 공유 */}
              <div className="rounded-xl border border-border/40 bg-surface/15 p-4 flex flex-col gap-3 mb-2 shadow-xs">
                <div>
                  <span className="text-[11px] font-mono font-bold text-accent">07</span>
                  <h3 className="text-[14px] font-semibold text-foreground mt-0.5">
                    공유 카드 3종 & 메모팩 웹 문서 공유
                  </h3>
                  <p className="text-[12px] text-text-secondary mt-0.5">
                    SNS 공유 카드(탑승권/영수증/폴라로이드)와 메모팩 전용 웹 문서 공유 모달을 열어보세요.
                  </p>
                </div>

                <GuideShareCardsDemo />
              </div>
            </div>

            {/* 모달 하단 닫기 바 */}
            <div className="p-3 px-4 border-t border-border bg-surface flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-[13px] font-medium text-white shadow-xs transition-opacity hover:opacity-90 cursor-pointer"
                style={{ background: "var(--accent)" }}
              >
                확인하고 닫기
              </button>
            </div>
          </div>
        </div>
      </OverlayLayerProvider>
    </Portal>
  );
}
