"use client";

import { useEffect, useState } from "react";

// 화면 너비가 550px 이상(태블릿, PC, 폴더블 펼침 화면 등)일 때만 가방 보관함 3열 모드를 허용한다.
// 550px 미만의 일반 스마트폰 세로 모드에서는 카드가 너무 좁아져 텍스트가 깨지므로 1열/2열만 노출한다.
const CAN_3COLS_BREAKPOINT_QUERY = "(min-width: 550px)";

export function useCanUse3Cols(): boolean {
  const [canUse3Cols, setCanUse3Cols] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(CAN_3COLS_BREAKPOINT_QUERY);
    setCanUse3Cols(mql.matches);
    const handler = (e: MediaQueryListEvent) => setCanUse3Cols(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return canUse3Cols;
}
