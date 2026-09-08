"use client";

import { useEffect, useState } from "react";
import { IconWifi, IconArrowRight, IconX } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";

export default function OfflineStatusBar() {
  const { isOfflineMode, switchToOnlineMode } = useAuth();
  const [isOnlineDetected, setIsOnlineDetected] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!isOfflineMode || typeof window === "undefined") return;

    let timer: NodeJS.Timeout;

    const checkOnline = async () => {
      // 1. Electron 환경인 경우 Node.js 메인 프로세스의 확실한 HTTPS 인증서 검증 호출
      if ((window as any).electronAPI?.checkInternet) {
        try {
          const online = await (window as any).electronAPI.checkInternet();
          setIsOnlineDetected(Boolean(online));
        } catch {
          setIsOnlineDetected(false);
        }
        return;
      }

      // 2. 웹 브라우저 환경인 경우
      if (!navigator.onLine) {
        setIsOnlineDetected(false);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        await fetch(`https://packinbag-f1983.firebaseapp.com?t=${Date.now()}`, {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        setIsOnlineDetected(true);
      } catch {
        setIsOnlineDetected(false);
      }
    };

    // 5초 간격으로 실시간 연결 복구 체크
    timer = setInterval(checkOnline, 5000);

    const handleOnline = () => checkOnline();
    const handleOffline = () => setIsOnlineDetected(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isOfflineMode]);

  // 오프라인 모드가 아니거나, 실제 인터넷 연결이 감지되지 않았거나, 사용자가 닫았으면 아무것도 렌더링하지 않음!
  if (!isOfflineMode || !isOnlineDetected || isDismissed) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="w-full text-xs font-medium px-4 py-2 flex items-center justify-between transition-all shrink-0 z-50 select-none bg-emerald-600 text-white shadow-sm"
    >
      <div className="flex items-center gap-2 min-w-0">
        <IconWifi size={16} stroke={2.2} className="shrink-0 animate-pulse" />
        <span className="truncate">
          인터넷 연결이 감지되었어요. 클릭하면 온라인 계정으로 전환돼요.
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <button
          type="button"
          onClick={switchToOnlineMode}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer bg-white text-emerald-700 hover:bg-white/90 shadow-xs transition-colors"
        >
          <span>로그인하기</span>
          <IconArrowRight size={12} stroke={2.5} />
        </button>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded hover:bg-emerald-700 text-white/80 hover:text-white transition-colors cursor-pointer"
          title="닫기"
          aria-label="닫기"
        >
          <IconX size={14} stroke={2} />
        </button>
      </div>
    </aside>
  );
}
