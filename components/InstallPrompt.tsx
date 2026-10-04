"use client";

import { useEffect, useState } from "react";
import { IconShare, IconX } from "@tabler/icons-react";
import {
  isInAppBrowser,
  shouldShowInstallHint,
  snoozeInstallHint,
} from "@/lib/installPromptUtils";
import { UI_V2 } from "@/lib/v2/flags";

export default function InstallPrompt() {
  // 서버 렌더링 시점엔 판별 불가 -> 처음엔 항상 숨김, 마운트 후에만 판단해서 깜빡임 방지
  const [visible, setVisible] = useState(false);
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setVisible(shouldShowInstallHint());
    setInApp(isInAppBrowser());
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    snoozeInstallHint();
    setVisible(false);
  };

  // v2: 아래 안전영역까지 채우는 한 줄 카드(토큰 색)
  if (UI_V2) {
    return (
      <div className="flex w-full shrink-0 items-center gap-3 border-t border-line bg-card pt-2 pb-safe-2 pl-4 font-ui text-caption text-sub">
        <IconShare size={18} stroke={1.75} className="shrink-0 text-brand" aria-hidden="true" />
        {inApp ? (
          <span className="min-w-0 flex-1">
            <strong className="font-semibold text-ink">Safari</strong>에서 열면 앱처럼 설치할 수 있어요 (오른쪽 위 메뉴 → Safari로 열기)
          </span>
        ) : (
          <span className="min-w-0 flex-1">
            공유 버튼 → <strong className="font-semibold text-ink">홈 화면에 추가</strong>하면 앱처럼 쓸 수 있어요
          </span>
        )}
        <button type="button" onClick={handleDismiss} aria-label="닫기" className="inline-flex size-11 shrink-0 items-center justify-center bg-transparent text-sub active:opacity-60">
          <IconX size={18} stroke={1.9} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] shrink-0"
      style={{
        background: "var(--surface-2)",
        color: "var(--text-secondary)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "max(10px, env(safe-area-inset-bottom))",
      }}
    >
      <IconShare
        size={17}
        stroke={1.75}
        className="shrink-0"
        style={{ color: "var(--accent)" }}
      />
      {inApp ? (
        <span className="flex-1">
          <strong style={{ color: "var(--foreground)" }}>Safari</strong>에서
          열면 앱처럼 설치할 수 있어요 (우측 상단 메뉴 → Safari로 열기)
        </span>
      ) : (
        <span className="flex-1">
          공유 버튼 →{" "}
          <strong style={{ color: "var(--foreground)" }}>
            홈 화면에 추가
          </strong>
          하면 앱처럼 쓸 수 있어요
        </span>
      )}
      <button
        onClick={handleDismiss}
        aria-label="닫기"
        className="shrink-0 p-1 -m-1"
      >
        <IconX size={16} stroke={1.75} />
      </button>
    </div>
  );
}
