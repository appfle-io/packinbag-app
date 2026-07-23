"use client";

import { useEffect, useState } from "react";

// PC 웹에서는 트리(좌) + 디테일(우) 레이아웃을, 그 아래 폭(모바일 웹 포함)에서는 기존
// 모바일 스타일 레이아웃을 보여주기 위한 기준. "진짜 데스크탑 기기냐"가 아니라 "지금
// 화면이 이 폭보다 넓냐"를 본다 - 표준 반응형 웹 방식과 동일하게, 브라우저 창을 좁히면
// 모바일 레이아웃으로, 넓히면 다시 데스크탑 레이아웃으로 자연스럽게 전환된다.
const DESKTOP_BREAKPOINT_QUERY = "(min-width: 1024px)";

export function useIsDesktop(): boolean {
  // 서버 렌더링/최초 렌더에서는 항상 false(모바일)로 시작해서 하이드레이션 불일치를
  // 피한다. 실제 폭은 클라이언트에서 마운트된 직후 한 번 확인해서 바로 갱신한다.
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}
