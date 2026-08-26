"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { useSwipeBack } from "@/lib/useSwipeBack";
import BackpackLogo from "@/components/BackpackLogo";
import GuideInstallDemo from "@/components/guide/GuideInstallDemo";

export default function InstallGuideScreen({ onBack }: { onBack: () => void }) {
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 pb-3 shrink-0 border-b border-border bg-surface/80 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="-m-2 p-2 text-text-secondary hover:text-foreground cursor-pointer transition-colors"
            aria-label="뒤로가기"
          >
            <IconArrowLeft size={20} stroke={1.75} />
          </button>
          <div className="flex items-center gap-2">
            <BackpackLogo size={20} />
            <h1 className="text-[15px] font-semibold text-foreground">앱 설치 방법</h1>
          </div>
        </div>
      </div>

      {/* 본문 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto w-full flex flex-col gap-5">
        <div>
          <h2 className="text-[18px] font-bold text-foreground mb-1">
            홈 화면에 앱으로 설치하기
          </h2>
          <p className="text-[13px] text-text-muted leading-relaxed">
            팩인백은 별도의 앱 스토어 다운로드 없이, 크롬 주소창이나 사파리 공유 메뉴를 통해 브라우저에서 바로 앱으로 설치하여 더 빠르고 쾌적하게 사용할 수 있습니다.
          </p>
        </div>

        {/* 인터랙티브 애니메이션 데모 */}
        <GuideInstallDemo />
      </div>
    </div>
  );
}
