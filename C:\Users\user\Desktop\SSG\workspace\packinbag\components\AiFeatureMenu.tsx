"use client";

import Portal from "@/components/Portal";
import { IconX, IconSparkles, IconMapPin, IconChevronRight } from "@tabler/icons-react";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

// 가방 상단의 "AI" 버튼을 누르면 뜨는 선택 메뉴. 예전엔 이 버튼이 AiOrganizeModal을 바로 열었는데,
// 여기에 AI 추천(날씨/명소/맛집)까지 함께 고를 수 있게 통합했다(2026-07). 각 항목은 짧은 설명을
// 작게 함께 보여주고, 프리미엄이 필요한 항목(AI 추천)은 무료회원에게 "프리미엄" 배지로 표시한다 -
// 실제 클릭 시 막는 처리는 호출부(BagEditorScreen)의 onSelectRecommend에서 프리미엄 여부를 보고
// PremiumLimitModal로 분기한다(이 컴포넌트는 메뉴 UI만 담당, 권한 판단은 하지 않음).
export default function AiFeatureMenu({
  premium,
  onClose,
  onSelectOrganize,
  onSelectRecommend,
}: {
  premium: boolean;
  onClose: () => void;
  onSelectOrganize: () => void;
  onSelectRecommend: () => void;
}) {
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(onClose);

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: ambientLayer + POPOVER_OFFSET, background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-medium flex items-center gap-1.5">
              <IconSparkles size={16} stroke={1.75} color="var(--accent)" />
              AI 기능
            </span>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <button
            onClick={() => {
              onClose();
              onSelectOrganize();
            }}
            className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-surface-2"
          >
            <div
              className="shrink-0 flex items-center justify-center rounded-full"
              style={{ width: 32, height: 32, background: "var(--accent-soft)" }}
            >
              <IconSparkles size={16} stroke={1.75} color="var(--accent)" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-medium">AI 정리</span>
                {!premium && (
                  <span
                    className="shrink-0 text-[10px] font-medium rounded-full px-1.5 py-0.5"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    프리미엄
                  </span>
                )}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                지금 이 가방의 짐들을 훑어보고 어울리는 팩으로 다시 묶어드려요
              </div>
            </div>
            <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
          </button>

          <button
            onClick={() => {
              onClose();
              onSelectRecommend();
            }}
            className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-surface-2"
          >
            <div
              className="shrink-0 flex items-center justify-center rounded-full"
              style={{ width: 32, height: 32, background: "var(--accent-soft)" }}
            >
              <IconMapPin size={16} stroke={1.75} color="var(--accent)" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-medium">AI 추천</span>
                {!premium && (
                  <span
                    className="shrink-0 text-[10px] font-medium rounded-full px-1.5 py-0.5"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    프리미엄
                  </span>
                )}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                가방 제목에서 여행지를 인식해서 날씨·명소·맛집·특산물을 추천해드려요
              </div>
            </div>
            <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
          </button>
        </div>
      </div>
    </Portal>
  );
}
