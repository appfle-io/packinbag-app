"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { useSwipeBack } from "@/lib/useSwipeBack";
import BackpackLogo from "@/components/BackpackLogo";
import GuideContent from "@/components/guide/GuideContent";

export default function GuideScreen({ onBack }: { onBack: () => void }) {
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);

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

      {/* 가이드 공통 본문 */}
      <GuideContent />
    </div>
  );
}
