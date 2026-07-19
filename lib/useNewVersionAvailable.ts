"use client";

import { useEffect, useState } from "react";
import { BUILD_ID } from "@/lib/buildInfo";

// 10분마다, 그리고 앱이 다시 화면에 보일 때마다(백그라운드에서 돌아왔을 때) 확인한다.
// 폴링이라 서버 부하가 걱정될 수 있지만 아주 가벼운 GET 요청 하나뿐이라 무시할 수준.
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

// 지금 로딩된 클라이언트(BUILD_ID)보다 서버에 배포된 버전이 더 최신인지 주기적으로 확인한다.
// true가 되면 "새 배포가 있다" - 사용자가 새로고침해야 최신 코드를 받는다(PWA/Capacitor
// 웹뷰는 탭을 새로 열지 않는 이상 스스로 최신 코드로 안 바뀌기 때문에 이 확인이 필요하다).
// 나중에 앱 푸시(FCM)를 붙이면, 서버가 배포 시점에 푸시를 보내는 것과 이 폴링 확인을
// 병행해서 "푸시 안 받은 사람도 결국은 알게" 이중 안전망으로 쓸 수 있다.
export function useNewVersionAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (available) return; // 이미 감지됐으면 새로고침 전까지 다시 확인할 필요 없음
      try {
        const res = await fetch("/api/build-info", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.buildId && data.buildId !== BUILD_ID) {
          setAvailable(true);
        }
      } catch {
        // 네트워크 실패는 조용히 무시하고 다음 주기에 다시 시도한다.
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return available;
}
