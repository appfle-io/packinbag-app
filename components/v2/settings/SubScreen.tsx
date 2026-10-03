"use client";

import { IconChevronLeft } from "@tabler/icons-react";
import { useSwipeBack } from "@/lib/useSwipeBack";
import { IconButton, ScreenBody, ScreenHeader } from "@/components/v2/ui";

// 설정 하위 화면(프로필·휴지통·문의·버전·라이선스) 공통 틀. 헤더·여백은 탭 화면과 같은 ScreenHeader/ScreenBody.
// - 제목 왼쪽 뒤로 버튼. 오른쪽으로 밀어 뒤로는 감싼 SlideScreen(swipeBack)이 맡고, 여기서는 닫는 함수만 등록한다
// - footer: 화면 아래 고정 영역(저장 버튼 등). 없으면 본문만
export function SubScreen({
  title,
  onBack,
  actions,
  headerExtra,
  footer,
  children,
  bodyClassName,
}: {
  title: string;
  onBack: () => void;
  actions?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  const ref = useSwipeBack<HTMLDivElement>(onBack);
  return (
    <div ref={ref} className="pib-v2 relative flex h-full min-h-0 w-full flex-1 flex-col bg-canvas">
      <ScreenHeader
        title={title}
        leading={
          <IconButton label="뒤로" onClick={onBack}>
            <IconChevronLeft size={22} stroke={1.9} />
          </IconButton>
        }
        actions={actions}
      >
        {headerExtra}
      </ScreenHeader>
      <ScreenBody className={bodyClassName}>{children}</ScreenBody>
      {footer && (
        <div className="shrink-0 border-t border-line bg-canvas">
          <div className="pb-safe-8 mx-auto w-full max-w-2xl px-5 pt-3">{footer}</div>
        </div>
      )}
    </div>
  );
}
