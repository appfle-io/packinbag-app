"use client";

import { IconArrowLeft, IconDeviceDesktop, IconDeviceMobile } from "@tabler/icons-react";
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

        {/* FAQ 및 추가 팁 */}
        <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3 text-[12.5px]">
          <div className="font-semibold text-foreground">설치 시 장점</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-text-secondary">
            <div className="p-2.5 rounded-lg bg-surface-2 flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
              <div>
                <strong className="text-foreground">전체 화면 모드:</strong> 브라우저 주소창과 툴바가 사라져 더 넓은 화면에서 짐을 체크할 수 있습니다.
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-2 flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
              <div>
                <strong className="text-foreground">빠른 바로가기:</strong> 홈 화면 또는 작업표시줄 아이콘을 눌러 1초 만에 가방을 열 수 있습니다.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
