"use client";

import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { closeTopLayer } from "@/lib/useEscapeToClose";
import { isAndroidApp } from "@/lib/v2/platform";

// Android 하드웨어 뒤로 가기(2026-10-22, AND-BASE-06). 리스너를 달면 Capacitor 기본 동작(WebView 뒤로 · 앱 종료)이 꺼진다.
// 순서: 맨 위 시트 · 화면 닫기(useEscapeToClose 스택) → fallback(상세 닫기 · 홈 탭으로) → 둘 다 없으면 앱을 내린다(종료 아님)
export function useAndroidBackButton(fallback: () => boolean) {
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    fallbackRef.current = fallback;
  });
  useEffect(() => {
    if (!isAndroidApp()) return;
    const handle = App.addListener("backButton", () => {
      if (closeTopLayer()) return;
      if (fallbackRef.current()) return;
      void App.minimizeApp();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);
}
