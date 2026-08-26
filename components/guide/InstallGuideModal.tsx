"use client";

import { IconX } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import BackpackLogo from "@/components/BackpackLogo";
import GuideInstallDemo from "@/components/guide/GuideInstallDemo";
import { OverlayLayerProvider } from "@/lib/overlayLayer";

export default function InstallGuideModal({
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
                <h2 className="text-[14.5px] font-semibold text-foreground">앱 설치 방법</h2>
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

            {/* 가이드 본문 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="mb-3">
                <h3 className="text-[15px] font-bold text-foreground mb-1">
                  홈 화면에 앱으로 설치하기
                </h3>
                <p className="text-[12px] text-text-muted leading-relaxed">
                  브라우저 주소창이나 공유 메뉴를 통해 앱으로 설치하면 더 빠르고 넓은 전체 화면으로 편리하게 사용하실 수 있습니다.
                </p>
              </div>

              <GuideInstallDemo />
            </div>
          </div>
        </div>
      </OverlayLayerProvider>
    </Portal>
  );
}
