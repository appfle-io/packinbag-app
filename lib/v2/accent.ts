// 강조색 테마(설정 > 화면 > 강조색, 2026-11-01 · 프리미엄). 미리 정한 색만 고른다(라이트 · 다크 글자 대비를 미리 맞춰 두려고).
// - 적용: html[data-accent="..."] → globals.css가 --v2-brand · --v2-brand-soft · --v2-on-brand를 바꾼다(라이트 · 다크 따로)
// - 저장: 이 기기(localStorage, 첫 화면 깜빡임 방지) + 계정(UserProfile.accentPreset, 기기 간 동기화)
// - 기본 딥그린은 data-accent 속성을 두지 않는다
// - iOS 위젯 · 잠금화면: 보이는 색을 네이티브에 넘긴다(ThemeProvider → saveNativeAccent, 1.13 앱부터). 값은 PIBStyle.swift PIBAccent와 같게
import type { AccentPreset } from "@/lib/types";

export const ACCENT_KEY = "packinbag-accent-preset";
export const DEFAULT_ACCENT: AccentPreset = "green";

// swatch = 라이트 모드 강조색, dark = 다크 모드(globals.css 값과 같게. 딥그린 다크는 위젯 · 잠금화면 값)
export const ACCENTS: { id: AccentPreset; label: string; swatch: string; dark: string }[] = [
  { id: "green", label: "딥그린", swatch: "#2e5e4e", dark: "#7dbda3" },
  { id: "navy", label: "네이비", swatch: "#2b4a7a", dark: "#7fa3dc" },
  { id: "burgundy", label: "버건디", swatch: "#8a2e43", dark: "#e08a9d" },
  { id: "mustard", label: "머스터드", swatch: "#8a6510", dark: "#e0b45a" },
  { id: "lavender", label: "라벤더", swatch: "#5b4a9e", dark: "#ab9ce6" },
  { id: "charcoal", label: "차콜", swatch: "#3a3a40", dark: "#c8c8cc" },
  { id: "coral", label: "코랄", swatch: "#b04a2f", dark: "#f0957a" },
];

export function isAccentPreset(v: unknown): v is AccentPreset {
  return typeof v === "string" && ACCENTS.some((a) => a.id === v);
}

export function applyAccent(accent: AccentPreset) {
  const root = document.documentElement;
  if (accent === DEFAULT_ACCENT) root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", accent);
}

// app/layout.tsx head에 넣는 첫 화면 스크립트(React보다 먼저 실행돼 색이 바뀌며 깜빡이지 않게)
export const INITIAL_ACCENT_SCRIPT = `(function(){try{var a=localStorage.getItem(${JSON.stringify(ACCENT_KEY)});if(${JSON.stringify(
  ACCENTS.map((a) => a.id).filter((id) => id !== DEFAULT_ACCENT),
)}.indexOf(a)>-1)document.documentElement.setAttribute('data-accent',a);}catch(e){}})();`;
