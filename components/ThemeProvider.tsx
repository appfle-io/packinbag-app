"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import type { AppFontFamily } from "@/lib/types";
import { DEFAULT_FONT_FAMILY, FONT_FAMILY_KEY, applyFontFamily, isAppFontFamily } from "@/lib/v2/appFonts";
import { isPremiumUser } from "@/lib/premiumLimits";

// 설정 > 화면: 화면 모드 · 글자 크기 · 글꼴(docs/spec/settings.md SET-DISP).
// 저장: 이 기기(localStorage, 첫 화면 깜빡임 방지) + 계정(UserProfile.themeMode · fontScale · fontFamily, 기기 간 동기화).
//
// 2026-10-15: 구 UI 꾸밈 설정(강조색 · 가방/팩 카드 색 · 투명도 · 카드 크기 · 카드 글자 크기)을 지웠다. v2 화면은 쓰지 않았고,
// 남은 구 컴포넌트도 같은 변수를 v2 값으로 덮어써서(지금은 globals.css :root가 예전 토큰을 v2 별칭으로, 10/17) 화면에 드러나지 않았다.
// 계정의 해당 프로필 필드(accentId 등)는 대전제대로 그대로 둔다(읽지도 쓰지도 않음). 이 기기의 옛 키는 한 번 지운다.

export type ThemeMode = "system" | "light" | "dark";
export type FontScale = "sm" | "md" | "lg";

const MODE_KEY = "packinbag-theme";
const FONT_SCALE_KEY = "packinbag-font-scale";

// 예전 꾸밈 설정이 이 기기에 남긴 키(더 읽지 않음)
const LEGACY_KEYS = [
  "packinbag-accent",
  "packinbag-accent-custom",
  "packinbag-bag-color",
  "packinbag-bag-color-custom",
  "packinbag-pack-grid-color",
  "packinbag-pack-grid-color-custom",
  "packinbag-pack-library-color",
  "packinbag-pack-library-color-custom",
  "packinbag-bag-color-opacity",
  "packinbag-pack-grid-color-opacity",
  "packinbag-pack-library-color-opacity",
  "packinbag-bag-card-scale",
  "packinbag-bag-card-font-scale",
  "packinbag-pack-card-scale",
  "packinbag-pack-library-card-scale",
  "packinbag-pack-card-font-scale",
  "packinbag-base-opacity",
];

// 글자 크기 배율. v2 글자 토큰은 globals.css [data-font-scale]이 바꾸고, 이 숫자는 --font-scale-factor로도 내보낸다
const FONT_SCALE_RATIO: Record<FontScale, number> = {
  sm: 0.925,
  md: 1,
  lg: 1.125,
};

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyMode(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", resolveTheme(mode));
}

function applyFontScale(scale: FontScale) {
  if (scale === "md") document.documentElement.removeAttribute("data-font-scale");
  else document.documentElement.setAttribute("data-font-scale", scale);
  document.documentElement.style.setProperty("--font-scale-factor", String(FONT_SCALE_RATIO[scale]));
}

const isMode = (v: unknown): v is ThemeMode => v === "system" || v === "light" || v === "dark";
const isFontScale = (v: unknown): v is FontScale => v === "sm" || v === "md" || v === "lg";

function readLocal<T>(key: string, ok: (v: unknown) => v is T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return ok(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

const ThemeContext = createContext<{
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  // 앱 글꼴(lib/v2/appFonts.ts)
  fontFamily: AppFontFamily;
  setFontFamily: (family: AppFontFamily) => void;
}>({
  mode: "system",
  setMode: () => {},
  fontScale: "md",
  setFontScale: () => {},
  fontFamily: DEFAULT_FONT_FAMILY,
  setFontFamily: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile, updateThemePrefs, updateFontScale } = useAuth();

  const [mode, setModeState] = useState<ThemeMode>(() => readLocal(MODE_KEY, isMode, "system"));
  const [fontScale, setFontScaleState] = useState<FontScale>(() => readLocal(FONT_SCALE_KEY, isFontScale, "md"));
  const [fontFamily, setFontFamilyState] = useState<AppFontFamily>(() =>
    readLocal(FONT_FAMILY_KEY, isAppFontFamily, DEFAULT_FONT_FAMILY),
  );

  // 예전 꾸밈 설정 키 정리(한 번). 예전에 html에 넣던 인라인 색 변수는 이제 넣지 않는다
  useEffect(() => {
    try {
      LEGACY_KEYS.forEach((k) => window.localStorage.removeItem(k));
    } catch {}
  }, []);

  useEffect(() => {
    applyMode(mode);
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyMode("system");
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [mode]);

  useEffect(() => {
    applyFontScale(fontScale);
  }, [fontScale]);

  // 앱 글꼴. 첫 화면은 app/layout.tsx head 스크립트가 이미 적용했고, 여기서는 바뀐 값을 따라간다.
  // 무료(FREE_LAUNCH를 끈 뒤)는 기본 글꼴만(2026-10-21, SET-DISP). 저장된 값은 두고 화면만 기본으로 → 프리미엄이 되면 다시 그 글꼴.
  // 프로필이 오기 전에는 이 기기 값 그대로(깜빡임 방지). 오프라인 모드는 isPremiumUser가 true
  const fontAllowed = !profile || isPremiumUser(profile.email, profile);
  const shownFamily: AppFontFamily = fontAllowed ? fontFamily : DEFAULT_FONT_FAMILY;
  useEffect(() => {
    applyFontFamily(shownFamily);
  }, [shownFamily]);

  // 계정에 저장된 값이 있으면 따라간다(처음 로드 + 다른 기기에서 바꾼 것). 계정에 값이 없으면 이 기기 값을 그대로 둔다.
  // 이미 구독 중인 프로필을 쓰므로 추가 읽기는 없다. 이 기기에서 바꾼 값은 되돌아와도 같은 값이라 아무 일도 없다
  const remoteMode = profile?.themeMode;
  const remoteFont = profile?.fontScale;
  const remoteFamily = profile?.fontFamily;
  const hasProfile = !!profile;
  useEffect(() => {
    if (!hasProfile) return;
    if (isMode(remoteMode) && remoteMode !== mode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Firestore에서 온 값 반영
      setModeState(remoteMode);
      writeLocal(MODE_KEY, remoteMode);
    }
    if (isFontScale(remoteFont) && remoteFont !== fontScale) {
      setFontScaleState(remoteFont);
      writeLocal(FONT_SCALE_KEY, remoteFont);
    }
    if (isAppFontFamily(remoteFamily) && remoteFamily !== fontFamily) {
      setFontFamilyState(remoteFamily);
      writeLocal(FONT_FAMILY_KEY, remoteFamily);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProfile, remoteMode, remoteFont, remoteFamily]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    writeLocal(MODE_KEY, next);
    applyMode(next);
    updateThemePrefs({ themeMode: next }).catch(() => {});
  };

  const setFontScale = (scale: FontScale) => {
    setFontScaleState(scale);
    writeLocal(FONT_SCALE_KEY, scale);
    applyFontScale(scale);
    updateFontScale(scale).catch(() => {});
  };

  const setFontFamily = (family: AppFontFamily) => {
    // 무료는 기본 글꼴만(시트가 먼저 막지만 한 번 더)
    if (!fontAllowed && family !== DEFAULT_FONT_FAMILY) return;
    setFontFamilyState(family);
    writeLocal(FONT_FAMILY_KEY, family);
    applyFontFamily(family);
    updateThemePrefs({ fontFamily: family }).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ mode, setMode, fontScale, setFontScale, fontFamily: shownFamily, setFontFamily }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
