"use client";

import { useEffect, useState } from "react";

// 리디자인 v2 "화면 켜두기": 가방을 보며 짐을 싸는 동안 화면이 꺼지지 않게 한다(구 UI "집중 패킹 모드"의 핵심 기능만 옮김).
// - 브라우저 Screen Wake Lock API. 앱이 뒤로 갔다 돌아오면(브라우저가 잠금을 풀어 버림) 다시 요청한다.
// - 켜기/끄기는 이 기기에 기억(localStorage). 켜 두면 어느 가방을 열든 그 화면에 있는 동안만 적용되고, 가방을 닫으면 풀린다.
// - 서버 호출 없음.
// - 지원하지 않는 환경(구형 브라우저, 일부 iOS 웹뷰)에서는 켜지지 않는다. iOS 앱에서 안 되면 Xcode 단계에서
//   네이티브 플러그인(@capacitor-community/keep-awake)으로 보강한다.

const PREF_KEY = "packinbag:v2KeepScreenOn";

type Sentinel = {
  release: () => Promise<void>;
  addEventListener: (type: "release", cb: () => void) => void;
};
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };

export function keepScreenOnSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as WakeLockNavigator).wakeLock;
}

export function readKeepScreenOnPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeKeepScreenOnPref(on: boolean) {
  try {
    if (on) window.localStorage.setItem(PREF_KEY, "1");
    else window.localStorage.removeItem(PREF_KEY);
  } catch {
    // 저장 실패는 무시(이번 화면에서만 적용)
  }
}

// enabled인 동안 화면 켜짐을 유지한다. 실제로 잠금을 잡고 있으면 true.
export function useKeepScreenOn(enabled: boolean): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock) return;

    let sentinel: Sentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || sentinel || document.visibilityState !== "visible") return;
      try {
        const s = await wakeLock.request("screen");
        if (cancelled) {
          s.release().catch(() => {});
          return;
        }
        sentinel = s;
        setActive(true);
        s.addEventListener("release", () => {
          sentinel = null;
          setActive(false);
        });
      } catch (err) {
        // 저전력 모드 등으로 거절될 수 있다
        console.warn("[팩인백] 화면 켜두기 요청 실패:", err);
      }
    };

    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);

  return enabled && active;
}
