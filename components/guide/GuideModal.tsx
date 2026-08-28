"use client";

import { IconX } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import BackpackLogo from "@/components/BackpackLogo";
import GuideContent from "@/components/guide/GuideContent";
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
        <div className="fixed inset-0 z-[190] flex justify-center p-3 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-xs">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg mt-[6vh] sm:mt-[9vh] mb-auto max-h-[86vh] sm:max-h-[82vh] rounded-2xl bg-background border border-border flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
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

            {/* 가이드 공통 본문 */}
            <GuideContent />
          </div>
        </div>
      </OverlayLayerProvider>
    </Portal>
  );
}
