// 리디자인 v2 앱 글꼴(설정 > 화면 > 글꼴). 앱 전체(메모팩 본문 포함)에 적용된다.
// - 폰트 파일은 app/fonts에 들어 있고 app/layout.tsx의 next/font/local이 @font-face를 만든다(CDN 없음 → 포터블 오프라인에서도 동작)
// - preload: false라 고른 글꼴만 실제로 내려받는다. 설정의 글꼴 시트를 열 때만 미리보기용으로 나머지도 받는다
// - 적용: html[data-font="..."] → globals.css가 --pib-font-app을 바꾸고 --font-ui가 이를 따른다
// - 저장: 이 기기(localStorage, 첫 화면 깜빡임 방지용) + 계정(UserProfile.fontFamily, 기기 간 동기화)
// - 기본 Pretendard는 data-font 속성을 두지 않는다
import type { AppFontFamily } from "@/lib/types";

export const FONT_FAMILY_KEY = "packinbag-font-family";
export const DEFAULT_FONT_FAMILY: AppFontFamily = "pretendard";

export const APP_FONTS: { id: AppFontFamily; label: string; description: string; previewClass: string }[] = [
  { id: "pretendard", label: "기본", description: "프리텐다드 · 깔끔하고 읽기 편해요", previewClass: "font-app-pretendard" },
  { id: "gmarket", label: "지마켓 산스", description: "또렷하고 시원한 느낌", previewClass: "font-app-gmarket" },
  { id: "gaegu", label: "개구", description: "동글동글 손글씨", previewClass: "font-app-gaegu" },
  { id: "d2coding", label: "D2코딩", description: "글자 폭이 일정한 개발자 글꼴", previewClass: "font-app-d2coding" },
];

export function isAppFontFamily(v: unknown): v is AppFontFamily {
  return typeof v === "string" && APP_FONTS.some((f) => f.id === v);
}

export function applyFontFamily(family: AppFontFamily) {
  const root = document.documentElement;
  if (family === DEFAULT_FONT_FAMILY) root.removeAttribute("data-font");
  else root.setAttribute("data-font", family);
}

// app/layout.tsx head에 넣는 첫 화면 스크립트(React보다 먼저 실행돼 글꼴이 바뀌며 깜빡이지 않게)
export const INITIAL_FONT_SCRIPT = `(function(){try{var f=localStorage.getItem(${JSON.stringify(FONT_FAMILY_KEY)});if(${JSON.stringify(
  APP_FONTS.map((f) => f.id).filter((id) => id !== DEFAULT_FONT_FAMILY),
)}.indexOf(f)>-1)document.documentElement.setAttribute('data-font',f);}catch(e){}})();`;
