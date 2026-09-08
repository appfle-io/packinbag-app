"use client";

import { useEffect, useState } from "react";
import { IconWifi, IconWifiOff, IconRefresh, IconArrowRight } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";

export default function OfflineStatusBar() {
  const { isOfflineMode, switchToOnlineMode } = useAuth();
  const [isOnlineDetected, setIsOnlineDetected] = useState(false);

  useEffect(() => {
    if (!isOfflineMode || typeof window === "undefined") return;

    let timer: NodeJS.Timeout;

    const checkOnline = async () => {
      if (!navigator.onLine) {
        setIsOnlineDetected(false);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        await fetch(`https://www.gstatic.com/generate_204?t=${Date.now()}`, {
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

    // 1. 이벤트 리스너
    const handleOnline = () => {
      checkOnline();
    };
    const handleOffline = () => {
      setIsOnlineDetected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 2. 주기적 확인 (10초 주기)
    checkOnline();
    timer = setInterval(checkOnline, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(timer);
    };
  }, [isOfflineMode]);

  if (!isOfflineMode) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className={`w-full text-xs font-medium px-4 py-1.5 flex items-center justify-between transition-colors shrink-0 z-40 select-none ${
        isOnlineDetected
          ? "bg-emerald-600 text-white shadow-sm"
          : "bg-surface-2 text-text-secondary border-b border-border"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isOnlineDetected ? (
          <>
            <IconWifi size={15} stroke={2} className="shrink-0 animate-pulse" />
            <span className="truncate">
              인터넷에 다시 연결되었어요. 클릭하면 온라인 로그인 상태로 전환돼요.
            </span>
          </>
        ) : (
          <>
            <IconWifiOff size={15} stroke={1.75} className="shrink-0 text-text-muted" />
            <span className="truncate">오프라인 보관함 사용 중 (인터넷 미연결)</span>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={switchToOnlineMode}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer shrink-0 transition-colors ml-2 ${
          isOnlineDetected
            ? "bg-white text-emerald-700 hover:bg-white/90 shadow-xs"
            : "bg-surface text-text-primary hover:bg-surface-3 border border-border"
        }`}
        title={isOnlineDetected ? "온라인 로그인으로 전환" : "온라인 모드로 전환 시도"}
      >
        {isOnlineDetected ? (
          <>
            <span>로그인하기</span>
            <IconArrowRight size={12} stroke={2.5} />
          </>
        ) : (
          <>
            <IconRefresh size={12} stroke={2} />
            <span>온라인 전환</span>
          </>
        )}
      </button>
    </aside>
  );
}
