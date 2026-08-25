"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ACCENT_PRESETS, deriveAccentTone, getAccentPreset } from "@/lib/accentColors";
import { useAuth } from "@/contexts/AuthProvider";

export type ThemeMode = "system" | "light" | "dark";
export type FontScale = "sm" | "md" | "lg";

const MODE_KEY = "packinbag-theme";
const ACCENT_KEY = "packinbag-accent";
const CUSTOM_KEY = "packinbag-accent-custom";
const FONT_SCALE_KEY = "packinbag-font-scale";
const BAG_COLOR_KEY = "packinbag-bag-color";
const BAG_CUSTOM_KEY = "packinbag-bag-color-custom";
const PACK_GRID_COLOR_KEY = "packinbag-pack-grid-color";
const PACK_GRID_CUSTOM_KEY = "packinbag-pack-grid-color-custom";
const PACK_LIBRARY_COLOR_KEY = "packinbag-pack-library-color";
const PACK_LIBRARY_CUSTOM_KEY = "packinbag-pack-library-color-custom";
const BAG_OPACITY_KEY = "packinbag-bag-color-opacity";
const PACK_GRID_OPACITY_KEY = "packinbag-pack-grid-color-opacity";
const PACK_LIBRARY_OPACITY_KEY = "packinbag-pack-library-color-opacity";
const BAG_SCALE_KEY = "packinbag-bag-card-scale";
// 가방 카드 안 글자 크기 배율 (카드 크기 슬라이더와 분리된 별도 설정)
const BAG_CARD_FONT_SCALE_KEY = "packinbag-bag-card-font-scale";
const PACK_SCALE_KEY = "packinbag-pack-card-scale";
const PACK_LIBRARY_SCALE_KEY = "packinbag-pack-library-card-scale";
// 가방 속 팩카드 안 글자 크기 배율 (카드 크기 슬라이더와 분리된 별도 설정)
const PACK_CARD_FONT_SCALE_KEY = "packinbag-pack-card-font-scale";
const BASE_OPACITY_KEY = "packinbag-base-opacity";
const DEFAULT_CUSTOM = "#8b5cf6";
// --surface-2의 원래(불투명) 색상값. globals.css의 :root/[data-theme="dark"] 값과 동일하게 유지 -
// 기본 투명도 100%일 때는 지금까지와 완전히 같은 색으로 보이게 하기 위함.
const SURFACE_2_BASE = { light: "#eef0f2", dark: "#2c2c2e" };
// "default"는 커스텀하지 않은 상태 (기본 무채색 카드 배경 = --surface 그대로)
export const DEFAULT_CARD_COLOR_ID = "default";
// 투명도/카드 크기 기본값 (기본 투명도 30%, 카드 크기 100%)
export const DEFAULT_OPACITY = 0.3;
export const DEFAULT_CARD_SCALE = 1;
// 가방 속 팩카드 크기(packCardScale)의 기준점. 기존 80% 크기를 새 100% 기준으로 삼아
// 슬라이더 100%가 실제 배율 0.8이 되며, 슬라이더는 50%~100% 범위를 조절한다.
export const PACK_CARD_SCALE_BASE = 0.8;
// 가방 속 팩카드 글자 크기(packCardFontScale)만 예외로 기준점을 다르게 잡는다. 기존에는
// 슬라이더 "100%"가 실제 저장값 1.0을 그대로 쓰면서 체감상 너무 큰 문제(체감상
// 120% 정도)가 있어서, 실제 저장값 = 표시값(%) * BASE 공식으로 기준점을 낮춰놓는다
// (ColorSettingsScreen에서 슬라이더 매핑에 쓴다). 이렇게 하면 새 기본값(0.8)이 예전의
// "80%" 설정과 동일한 실제 글자 크기를 내면서, 새 슬라이더는 "100%"로 표시된다.
export const PACK_CARD_FONT_SCALE_BASE = 0.8;

// 글자 크기 배율. data-font-scale 속성(기존 앱 전체 오버라이드용)과 별개로,
// 가방/팩 카드처럼 "카드 크기" 배율과 곱해서 같이 써야 하는 곳에서는 이 숫자를
// --font-scale-factor CSS 변수로 읽어서 calc()에 사용한다.
const FONT_SCALE_RATIO: Record<FontScale, number> = {
  sm: 0.925,
  md: 1,
  lg: 1.125,
};

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

interface ColorSettings {
  mode: ThemeMode;
  accentId: string;
  customHex: string;
  bagColorId: string;
  bagCustomHex: string;
  bagColorOpacity: number;
  packGridColorId: string;
  packGridCustomHex: string;
  packGridColorOpacity: number;
  packLibraryColorId: string;
  packLibraryCustomHex: string;
  packLibraryColorOpacity: number;
  baseOpacity: number;
}

function applyAll(settings: ColorSettings) {
  const {
    mode,
    accentId,
    customHex,
    bagColorId,
    bagCustomHex,
    bagColorOpacity,
    packGridColorId,
    packGridCustomHex,
    packGridColorOpacity,
    packLibraryColorId,
    packLibraryCustomHex,
    packLibraryColorOpacity,
    baseOpacity,
  } = settings;
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute("data-theme", resolved);
  const tone =
    accentId === "custom"
      ? deriveAccentTone(customHex, resolved)
      : getAccentPreset(accentId)[resolved];
  const root = document.documentElement.style;
  root.setProperty("--accent", tone.accent);
  root.setProperty("--accent-strong", tone.strong);
  root.setProperty("--accent-soft", tone.soft);
  applyCardColor("--bag-card-bg", bagColorId, bagCustomHex, resolved, bagColorOpacity);
  applyCardColor("--pack-card-bg", packGridColorId, packGridCustomHex, resolved, packGridColorOpacity);
  applyCardColor(
    "--pack-library-card-bg",
    packLibraryColorId,
    packLibraryCustomHex,
    resolved,
    packLibraryColorOpacity
  );
  applyBaseOpacity(resolved, baseOpacity);
}

// 기본 투명도: 하단 탭바, 필터 버튼, 짐(체크/텍스트) 배경, 설정 메뉴 미선택 버튼 배경 등
// --surface-2를 쓰는 모든 곳에 공통으로 적용된다. globals.css에 정의된 고정값 대신
// 이 CSS 변수를 인라인으로 덮어써서 색상은 그대로 두고 투명도만 조절한다
// (100%일 때는 color-mix 결과가 원래 색과 동일해서 기존 모습 그대로 유지됨).
function applyBaseOpacity(resolved: "light" | "dark", opacity: number) {
  const root = document.documentElement.style;
  const pct = Math.round(Math.max(0, Math.min(1, opacity)) * 100);
  const base = SURFACE_2_BASE[resolved];
  root.setProperty("--surface-2", `color-mix(in srgb, ${base} ${pct}%, transparent)`);
}

// 가방/팩 카드 배경 톤 + 투명도를 CSS 변수에 반영.
// color-mix()로 "실제 색 pct% + transparent"를 섞어서, 투명도를 낮출수록
// 카드 뒤에 있는 페이지 배경(라이트=흰색/다크=검정 계열)이 비쳐 보이게 한다.
// "기본(default)"이어도 --surface를 기준으로 똑같이 투명도를 적용한다 (완전 불투명=100%일 땐
// 기존과 동일한 모습).
// cssVar와 함께 "{cssVar}-pct"도 같이 내보낸다 - 팩 하나하나에 개별 색(pack.color)을 지정했을 때
// PackCard/EditorPackCard가 그 색에 color-mix()로 이 퍼센트를 그대로 적용해서, 개별 색 팩도
// 이 슬라이더(팩 카드 기본 투명도)를 그대로 따라가게 하기 위함 (예전엔 개별 색 팩만 15% 고정값
// 하드코딩이라 슬라이더를 움직여도 안 바뀌는 버그가 있었음).
function applyCardColor(
  cssVar: string,
  colorId: string,
  customHex: string,
  resolved: "light" | "dark",
  opacity: number
) {
  const root = document.documentElement.style;
  const pct = Math.round(Math.max(0, Math.min(1, opacity)) * 100);
  const baseColor =
    colorId === DEFAULT_CARD_COLOR_ID
      ? "var(--surface)"
      : colorId === "custom"
        ? deriveAccentTone(customHex, resolved).soft
        : getAccentPreset(colorId)[resolved].soft;
  root.setProperty(cssVar, `color-mix(in srgb, ${baseColor} ${pct}%, transparent)`);
  root.setProperty(`${cssVar}-pct`, `${pct}%`);
}

// 가방 카드 / 팩 카드 / 팩 라이브러리 타일 크기 배율 + 가방 카드/팩카드 글자 크기 배율을
// CSS 변수로 반영 (라이트/다크 무관, 그냥 숫자). 각 컴포넌트(BagCard/PackCard/PackTile/
// ItemRow)에서 padding·아이콘·글자 크기를 calc(기본값 * var(--xxx-scale)) 형태로 계산할 때 쓴다.
// 가방 카드와 팩 카드 둘 다, 글자 크기는 카드 크기(--bag-card-scale/--pack-card-scale)가
// 아니라 별도의 --bag-card-font-scale/--pack-card-font-scale을 따로 곱해서 "카드 크기"와
// "글자 크기"를 완전히 독립적으로 조절할 수 있게 한다.
function applyCardScale(
  bagScale: number,
  bagFontScale: number,
  packScale: number,
  packLibraryScale: number,
  packCardFontScale: number
) {
  const root = document.documentElement.style;
  root.setProperty("--bag-card-scale", String(bagScale));
  root.setProperty("--bag-card-font-scale", String(bagFontScale));
  root.setProperty("--pack-card-scale", String(packScale));
  root.setProperty("--pack-library-card-scale", String(packLibraryScale));
  root.setProperty("--pack-card-font-scale", String(packCardFontScale));
}

// 글자 크기 설정: html 루트에 data-font-scale 속성을 세팅해서 globals.css의
// .text-[Npx] 클래스별 오버라이드 규칙이 적용되게 한다 (앱 전반 - 아이콘/여백은 그대로 두고
// 글자만 커지고 작아짐). 동시에 --font-scale-factor 숫자 변수도 세팅해서, 가방/팩 카드처럼
// "카드 크기" 배율과 곱해서 써야 하는 곳(calc 기반)에서도 같은 배율을 가져다 쓸 수 있게 한다.
function applyFontScale(scale: FontScale) {
  if (scale === "md") {
    document.documentElement.removeAttribute("data-font-scale");
  } else {
    document.documentElement.setAttribute("data-font-scale", scale);
  }
  document.documentElement.style.setProperty("--font-scale-factor", String(FONT_SCALE_RATIO[scale]));
}

const ThemeContext = createContext<{
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  accentId: string;
  setAccent: (id: string) => void;
  customHex: string;
  setCustomAccent: (hex: string) => void;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  bagColorId: string;
  setBagColor: (id: string) => void;
  bagCustomHex: string;
  setCustomBagColor: (hex: string) => void;
  bagColorOpacity: number;
  setBagColorOpacity: (opacity: number) => void;
  bagCardScale: number;
  setBagCardScale: (scale: number) => void;
  bagCardFontScale: number;
  setBagCardFontScale: (scale: number) => void;
  packGridColorId: string;
  setPackGridColor: (id: string) => void;
  packGridCustomHex: string;
  setCustomPackGridColor: (hex: string) => void;
  packGridColorOpacity: number;
  setPackGridColorOpacity: (opacity: number) => void;
  packCardScale: number;
  setPackCardScale: (scale: number) => void;
  packCardFontScale: number;
  setPackCardFontScale: (scale: number) => void;
  packLibraryColorId: string;
  setPackLibraryColor: (id: string) => void;
  packLibraryCustomHex: string;
  setCustomPackLibraryColor: (hex: string) => void;
  packLibraryColorOpacity: number;
  setPackLibraryColorOpacity: (opacity: number) => void;
  packLibraryCardScale: number;
  setPackLibraryCardScale: (scale: number) => void;
  baseOpacity: number;
  setBaseOpacity: (opacity: number) => void;
  resetThemeSettings: () => void;
}>({
  mode: "system",
  setMode: () => {},
  accentId: ACCENT_PRESETS[0].id,
  setAccent: () => {},
  customHex: DEFAULT_CUSTOM,
  setCustomAccent: () => {},
  fontScale: "md",
  setFontScale: () => {},
  bagColorId: DEFAULT_CARD_COLOR_ID,
  setBagColor: () => {},
  bagCustomHex: DEFAULT_CUSTOM,
  setCustomBagColor: () => {},
  bagColorOpacity: DEFAULT_OPACITY,
  setBagColorOpacity: () => {},
  bagCardScale: DEFAULT_CARD_SCALE,
  setBagCardScale: () => {},
  bagCardFontScale: DEFAULT_CARD_SCALE,
  setBagCardFontScale: () => {},
  packGridColorId: DEFAULT_CARD_COLOR_ID,
  setPackGridColor: () => {},
  packGridCustomHex: DEFAULT_CUSTOM,
  setCustomPackGridColor: () => {},
  packGridColorOpacity: DEFAULT_OPACITY,
  setPackGridColorOpacity: () => {},
  packCardScale: PACK_CARD_SCALE_BASE,
  setPackCardScale: () => {},
  packCardFontScale: PACK_CARD_FONT_SCALE_BASE,
  setPackCardFontScale: () => {},
  packLibraryColorId: DEFAULT_CARD_COLOR_ID,
  setPackLibraryColor: () => {},
  packLibraryCustomHex: DEFAULT_CUSTOM,
  setCustomPackLibraryColor: () => {},
  packLibraryColorOpacity: DEFAULT_OPACITY,
  setPackLibraryColorOpacity: () => {},
  packLibraryCardScale: DEFAULT_CARD_SCALE,
  setPackLibraryCardScale: () => {},
  baseOpacity: DEFAULT_OPACITY,
  setBaseOpacity: () => {},
  resetThemeSettings: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile, updateThemePrefs, updateFontScale } = useAuth();
  const appliedRemoteRef = useRef(false);

  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    return (window.localStorage.getItem(MODE_KEY) as ThemeMode | null) ?? "system";
  });
  const [accentId, setAccentState] = useState<string>(() => {
    if (typeof window === "undefined") return ACCENT_PRESETS[0].id;
    return window.localStorage.getItem(ACCENT_KEY) ?? ACCENT_PRESETS[0].id;
  });
  const [customHex, setCustomHexState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CUSTOM;
    return window.localStorage.getItem(CUSTOM_KEY) ?? DEFAULT_CUSTOM;
  });
  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    if (typeof window === "undefined") return "md";
    return (window.localStorage.getItem(FONT_SCALE_KEY) as FontScale | null) ?? "md";
  });
  const [bagColorId, setBagColorState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CARD_COLOR_ID;
    return window.localStorage.getItem(BAG_COLOR_KEY) ?? DEFAULT_CARD_COLOR_ID;
  });
  const [bagCustomHex, setBagCustomHexState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CUSTOM;
    return window.localStorage.getItem(BAG_CUSTOM_KEY) ?? DEFAULT_CUSTOM;
  });
  const [bagColorOpacity, setBagColorOpacityState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_OPACITY;
    const raw = window.localStorage.getItem(BAG_OPACITY_KEY);
    return raw !== null ? Number(raw) : DEFAULT_OPACITY;
  });
  const [bagCardScale, setBagCardScaleState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_CARD_SCALE;
    const raw = window.localStorage.getItem(BAG_SCALE_KEY);
    return raw !== null ? Number(raw) : DEFAULT_CARD_SCALE;
  });
  const [bagCardFontScale, setBagCardFontScaleState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_CARD_SCALE;
    const raw = window.localStorage.getItem(BAG_CARD_FONT_SCALE_KEY);
    return raw !== null ? Number(raw) : DEFAULT_CARD_SCALE;
  });
  const [packGridColorId, setPackGridColorState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CARD_COLOR_ID;
    return window.localStorage.getItem(PACK_GRID_COLOR_KEY) ?? DEFAULT_CARD_COLOR_ID;
  });
  const [packGridCustomHex, setPackGridCustomHexState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CUSTOM;
    return window.localStorage.getItem(PACK_GRID_CUSTOM_KEY) ?? DEFAULT_CUSTOM;
  });
  const [packGridColorOpacity, setPackGridColorOpacityState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_OPACITY;
    const raw = window.localStorage.getItem(PACK_GRID_OPACITY_KEY);
    return raw !== null ? Number(raw) : DEFAULT_OPACITY;
  });
  const [packCardScale, setPackCardScaleState] = useState<number>(() => {
    if (typeof window === "undefined") return PACK_CARD_SCALE_BASE;
    const raw = window.localStorage.getItem(PACK_SCALE_KEY);
    return raw !== null ? Number(raw) : PACK_CARD_SCALE_BASE;
  });
  const [packCardFontScale, setPackCardFontScaleState] = useState<number>(() => {
    if (typeof window === "undefined") return PACK_CARD_FONT_SCALE_BASE;
    const raw = window.localStorage.getItem(PACK_CARD_FONT_SCALE_KEY);
    return raw !== null ? Number(raw) : PACK_CARD_FONT_SCALE_BASE;
  });
  const [packLibraryColorId, setPackLibraryColorState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CARD_COLOR_ID;
    return window.localStorage.getItem(PACK_LIBRARY_COLOR_KEY) ?? DEFAULT_CARD_COLOR_ID;
  });
  const [packLibraryCustomHex, setPackLibraryCustomHexState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CUSTOM;
    return window.localStorage.getItem(PACK_LIBRARY_CUSTOM_KEY) ?? DEFAULT_CUSTOM;
  });
  const [packLibraryColorOpacity, setPackLibraryColorOpacityState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_OPACITY;
    const raw = window.localStorage.getItem(PACK_LIBRARY_OPACITY_KEY);
    return raw !== null ? Number(raw) : DEFAULT_OPACITY;
  });
  const [packLibraryCardScale, setPackLibraryCardScaleState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_CARD_SCALE;
    const raw = window.localStorage.getItem(PACK_LIBRARY_SCALE_KEY);
    return raw !== null ? Number(raw) : DEFAULT_CARD_SCALE;
  });
  const [baseOpacity, setBaseOpacityState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_OPACITY;
    const raw = window.localStorage.getItem(BASE_OPACITY_KEY);
    return raw !== null ? Number(raw) : DEFAULT_OPACITY;
  });

  const currentSettings = (): ColorSettings => ({
    mode,
    accentId,
    customHex,
    bagColorId,
    bagCustomHex,
    bagColorOpacity,
    packGridColorId,
    packGridCustomHex,
    packGridColorOpacity,
    packLibraryColorId,
    packLibraryCustomHex,
    packLibraryColorOpacity,
    baseOpacity,
  });

  useEffect(() => {
    applyAll(currentSettings());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    accentId,
    customHex,
    bagColorId,
    bagCustomHex,
    bagColorOpacity,
    packGridColorId,
    packGridCustomHex,
    packGridColorOpacity,
    packLibraryColorId,
    packLibraryCustomHex,
    packLibraryColorOpacity,
    baseOpacity,
  ]);

  useEffect(() => {
    applyFontScale(fontScale);
  }, [fontScale]);

  useEffect(() => {
    applyCardScale(bagCardScale, bagCardFontScale, packCardScale, packLibraryCardScale, packCardFontScale);
  }, [bagCardScale, bagCardFontScale, packCardScale, packLibraryCardScale, packCardFontScale]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyAll({ ...currentSettings(), mode: "system" });
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 계정(Firestore)에 저장된 테마 설정이 있으면, 이 기기 최초 로드 시 한 번 덮어써서
  // 다른 기기에서 바꾼 설정이 여기에도 반영되게 한다 (이후로는 이 기기에서의 변경이 우선).
  // Firestore(외부 시스템)에서 온 값을 반영하는 의도된 동기화라 set-state-in-effect 규칙은 비활성화한다.
  useEffect(() => {
    if (!profile || appliedRemoteRef.current) return;
    appliedRemoteRef.current = true;
    const {
      themeMode: remoteMode,
      accentId: remoteAccent,
      customAccentHex: remoteCustom,
      fontScale: remoteFontScale,
      bagColorId: remoteBagColorId,
      customBagColorHex: remoteBagCustom,
      bagColorOpacity: remoteBagOpacity,
      bagCardScale: remoteBagScale,
      bagCardFontScale: remoteBagCardFontScale,
      packGridColorId: remotePackGridColorId,
      customPackGridColorHex: remotePackGridCustom,
      packGridColorOpacity: remotePackGridOpacity,
      packCardScale: remotePackScale,
      packCardFontScale: remotePackCardFontScale,
      packLibraryColorId: remotePackLibraryColorId,
      customPackLibraryColorHex: remotePackLibraryCustom,
      packLibraryColorOpacity: remotePackLibraryOpacity,
      packLibraryCardScale: remotePackLibraryScale,
      baseOpacity: remoteBaseOpacity,
    } = profile;
    if (
      !remoteMode &&
      !remoteAccent &&
      !remoteFontScale &&
      !remoteBagColorId &&
      !remotePackGridColorId &&
      !remotePackLibraryColorId &&
      remoteBagOpacity === undefined &&
      remoteBagScale === undefined &&
      remoteBagCardFontScale === undefined &&
      remotePackGridOpacity === undefined &&
      remotePackScale === undefined &&
      remotePackCardFontScale === undefined &&
      remotePackLibraryOpacity === undefined &&
      remotePackLibraryScale === undefined &&
      remoteBaseOpacity === undefined
    )
      return; // 계정에 저장된 값이 아직 없으면 기기 값 유지

    if (remoteMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModeState(remoteMode);
      window.localStorage.setItem(MODE_KEY, remoteMode);
    }
    if (remoteAccent) {
      setAccentState(remoteAccent);
      window.localStorage.setItem(ACCENT_KEY, remoteAccent);
    }
    if (remoteCustom) {
      setCustomHexState(remoteCustom);
      window.localStorage.setItem(CUSTOM_KEY, remoteCustom);
    }
    if (remoteFontScale) {
      setFontScaleState(remoteFontScale);
      window.localStorage.setItem(FONT_SCALE_KEY, remoteFontScale);
    }
    if (remoteBagColorId) {
      setBagColorState(remoteBagColorId);
      window.localStorage.setItem(BAG_COLOR_KEY, remoteBagColorId);
    }
    if (remoteBagCustom) {
      setBagCustomHexState(remoteBagCustom);
      window.localStorage.setItem(BAG_CUSTOM_KEY, remoteBagCustom);
    }
    if (remoteBagOpacity !== undefined) {
      setBagColorOpacityState(remoteBagOpacity);
      window.localStorage.setItem(BAG_OPACITY_KEY, String(remoteBagOpacity));
    }
    if (remoteBagScale !== undefined) {
      setBagCardScaleState(remoteBagScale);
      window.localStorage.setItem(BAG_SCALE_KEY, String(remoteBagScale));
    }
    if (remoteBagCardFontScale !== undefined) {
      setBagCardFontScaleState(remoteBagCardFontScale);
      window.localStorage.setItem(BAG_CARD_FONT_SCALE_KEY, String(remoteBagCardFontScale));
    }
    if (remotePackGridColorId) {
      setPackGridColorState(remotePackGridColorId);
      window.localStorage.setItem(PACK_GRID_COLOR_KEY, remotePackGridColorId);
    }
    if (remotePackGridCustom) {
      setPackGridCustomHexState(remotePackGridCustom);
      window.localStorage.setItem(PACK_GRID_CUSTOM_KEY, remotePackGridCustom);
    }
    if (remotePackGridOpacity !== undefined) {
      setPackGridColorOpacityState(remotePackGridOpacity);
      window.localStorage.setItem(PACK_GRID_OPACITY_KEY, String(remotePackGridOpacity));
    }
    if (remotePackScale !== undefined) {
      setPackCardScaleState(remotePackScale);
      window.localStorage.setItem(PACK_SCALE_KEY, String(remotePackScale));
    }
    if (remotePackCardFontScale !== undefined) {
      setPackCardFontScaleState(remotePackCardFontScale);
      window.localStorage.setItem(PACK_CARD_FONT_SCALE_KEY, String(remotePackCardFontScale));
    }
    if (remotePackLibraryColorId) {
      setPackLibraryColorState(remotePackLibraryColorId);
      window.localStorage.setItem(PACK_LIBRARY_COLOR_KEY, remotePackLibraryColorId);
    }
    if (remotePackLibraryCustom) {
      setPackLibraryCustomHexState(remotePackLibraryCustom);
      window.localStorage.setItem(PACK_LIBRARY_CUSTOM_KEY, remotePackLibraryCustom);
    }
    if (remotePackLibraryOpacity !== undefined) {
      setPackLibraryColorOpacityState(remotePackLibraryOpacity);
      window.localStorage.setItem(PACK_LIBRARY_OPACITY_KEY, String(remotePackLibraryOpacity));
    }
    if (remotePackLibraryScale !== undefined) {
      setPackLibraryCardScaleState(remotePackLibraryScale);
      window.localStorage.setItem(PACK_LIBRARY_SCALE_KEY, String(remotePackLibraryScale));
    }
    if (remoteBaseOpacity !== undefined) {
      setBaseOpacityState(remoteBaseOpacity);
      window.localStorage.setItem(BASE_OPACITY_KEY, String(remoteBaseOpacity));
    }
  }, [profile]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    window.localStorage.setItem(MODE_KEY, next);
    applyAll({ ...currentSettings(), mode: next });
    updateThemePrefs({ themeMode: next }).catch(() => {});
  };

  const setAccent = (id: string) => {
    setAccentState(id);
    window.localStorage.setItem(ACCENT_KEY, id);
    applyAll({ ...currentSettings(), accentId: id });
    updateThemePrefs({ accentId: id }).catch(() => {});
  };

  const setCustomAccent = (hex: string) => {
    setCustomHexState(hex);
    setAccentState("custom");
    window.localStorage.setItem(CUSTOM_KEY, hex);
    window.localStorage.setItem(ACCENT_KEY, "custom");
    applyAll({ ...currentSettings(), accentId: "custom", customHex: hex });
    updateThemePrefs({ accentId: "custom", customAccentHex: hex }).catch(() => {});
  };

  const setFontScale = (scale: FontScale) => {
    setFontScaleState(scale);
    window.localStorage.setItem(FONT_SCALE_KEY, scale);
    applyFontScale(scale);
    updateFontScale(scale).catch(() => {});
  };

  const setBagColor = (id: string) => {
    setBagColorState(id);
    window.localStorage.setItem(BAG_COLOR_KEY, id);
    applyAll({ ...currentSettings(), bagColorId: id });
    updateThemePrefs({ bagColorId: id }).catch(() => {});
  };

  const setCustomBagColor = (hex: string) => {
    setBagCustomHexState(hex);
    setBagColorState("custom");
    window.localStorage.setItem(BAG_CUSTOM_KEY, hex);
    window.localStorage.setItem(BAG_COLOR_KEY, "custom");
    applyAll({ ...currentSettings(), bagColorId: "custom", bagCustomHex: hex });
    updateThemePrefs({ bagColorId: "custom", customBagColorHex: hex }).catch(() => {});
  };

  const setBagColorOpacity = (opacity: number) => {
    setBagColorOpacityState(opacity);
    window.localStorage.setItem(BAG_OPACITY_KEY, String(opacity));
    applyAll({ ...currentSettings(), bagColorOpacity: opacity });
    updateThemePrefs({ bagColorOpacity: opacity }).catch(() => {});
  };

  const setBagCardScale = (scale: number) => {
    setBagCardScaleState(scale);
    window.localStorage.setItem(BAG_SCALE_KEY, String(scale));
    applyCardScale(scale, bagCardFontScale, packCardScale, packLibraryCardScale, packCardFontScale);
    updateThemePrefs({ bagCardScale: scale }).catch(() => {});
  };

  const setBagCardFontScale = (scale: number) => {
    setBagCardFontScaleState(scale);
    window.localStorage.setItem(BAG_CARD_FONT_SCALE_KEY, String(scale));
    applyCardScale(bagCardScale, scale, packCardScale, packLibraryCardScale, packCardFontScale);
    updateThemePrefs({ bagCardFontScale: scale }).catch(() => {});
  };

  const setPackGridColor = (id: string) => {
    setPackGridColorState(id);
    window.localStorage.setItem(PACK_GRID_COLOR_KEY, id);
    applyAll({ ...currentSettings(), packGridColorId: id });
    updateThemePrefs({ packGridColorId: id }).catch(() => {});
  };

  const setCustomPackGridColor = (hex: string) => {
    setPackGridCustomHexState(hex);
    setPackGridColorState("custom");
    window.localStorage.setItem(PACK_GRID_CUSTOM_KEY, hex);
    window.localStorage.setItem(PACK_GRID_COLOR_KEY, "custom");
    applyAll({ ...currentSettings(), packGridColorId: "custom", packGridCustomHex: hex });
    updateThemePrefs({ packGridColorId: "custom", customPackGridColorHex: hex }).catch(() => {});
  };

  const setPackGridColorOpacity = (opacity: number) => {
    setPackGridColorOpacityState(opacity);
    window.localStorage.setItem(PACK_GRID_OPACITY_KEY, String(opacity));
    applyAll({ ...currentSettings(), packGridColorOpacity: opacity });
    updateThemePrefs({ packGridColorOpacity: opacity }).catch(() => {});
  };

  const setPackCardScale = (scale: number) => {
    setPackCardScaleState(scale);
    window.localStorage.setItem(PACK_SCALE_KEY, String(scale));
    applyCardScale(bagCardScale, bagCardFontScale, scale, packLibraryCardScale, packCardFontScale);
    updateThemePrefs({ packCardScale: scale }).catch(() => {});
  };

  const setPackCardFontScale = (scale: number) => {
    setPackCardFontScaleState(scale);
    window.localStorage.setItem(PACK_CARD_FONT_SCALE_KEY, String(scale));
    applyCardScale(bagCardScale, bagCardFontScale, packCardScale, packLibraryCardScale, scale);
    updateThemePrefs({ packCardFontScale: scale }).catch(() => {});
  };

  const setPackLibraryColor = (id: string) => {
    setPackLibraryColorState(id);
    window.localStorage.setItem(PACK_LIBRARY_COLOR_KEY, id);
    applyAll({ ...currentSettings(), packLibraryColorId: id });
    updateThemePrefs({ packLibraryColorId: id }).catch(() => {});
  };

  const setCustomPackLibraryColor = (hex: string) => {
    setPackLibraryCustomHexState(hex);
    setPackLibraryColorState("custom");
    window.localStorage.setItem(PACK_LIBRARY_CUSTOM_KEY, hex);
    window.localStorage.setItem(PACK_LIBRARY_COLOR_KEY, "custom");
    applyAll({ ...currentSettings(), packLibraryColorId: "custom", packLibraryCustomHex: hex });
    updateThemePrefs({ packLibraryColorId: "custom", customPackLibraryColorHex: hex }).catch(() => {});
  };

  const setPackLibraryColorOpacity = (opacity: number) => {
    setPackLibraryColorOpacityState(opacity);
    window.localStorage.setItem(PACK_LIBRARY_OPACITY_KEY, String(opacity));
    applyAll({ ...currentSettings(), packLibraryColorOpacity: opacity });
    updateThemePrefs({ packLibraryColorOpacity: opacity }).catch(() => {});
  };

  const setPackLibraryCardScale = (scale: number) => {
    setPackLibraryCardScaleState(scale);
    window.localStorage.setItem(PACK_LIBRARY_SCALE_KEY, String(scale));
    applyCardScale(bagCardScale, bagCardFontScale, packCardScale, scale, packCardFontScale);
    updateThemePrefs({ packLibraryCardScale: scale }).catch(() => {});
  };

  const setBaseOpacity = (opacity: number) => {
    setBaseOpacityState(opacity);
    window.localStorage.setItem(BASE_OPACITY_KEY, String(opacity));
    applyAll({ ...currentSettings(), baseOpacity: opacity });
    updateThemePrefs({ baseOpacity: opacity }).catch(() => {});
  };

  const resetThemeSettings = () => {
    setFontScaleState("md");
    window.localStorage.setItem(FONT_SCALE_KEY, "md");
    updateFontScale("md").catch(() => {});

    setAccentState(ACCENT_PRESETS[0].id);
    window.localStorage.setItem(ACCENT_KEY, ACCENT_PRESETS[0].id);

    setCustomHexState(DEFAULT_CUSTOM);
    window.localStorage.setItem(CUSTOM_KEY, DEFAULT_CUSTOM);

    setBagColorState(DEFAULT_CARD_COLOR_ID);
    window.localStorage.setItem(BAG_COLOR_KEY, DEFAULT_CARD_COLOR_ID);

    setBagCustomHexState(DEFAULT_CUSTOM);
    window.localStorage.setItem(BAG_CUSTOM_KEY, DEFAULT_CUSTOM);

    setBagColorOpacityState(DEFAULT_OPACITY);
    window.localStorage.setItem(BAG_OPACITY_KEY, String(DEFAULT_OPACITY));

    setBagCardScaleState(DEFAULT_CARD_SCALE);
    window.localStorage.setItem(BAG_SCALE_KEY, String(DEFAULT_CARD_SCALE));

    setBagCardFontScaleState(DEFAULT_CARD_SCALE);
    window.localStorage.setItem(BAG_CARD_FONT_SCALE_KEY, String(DEFAULT_CARD_SCALE));

    setPackGridColorState(DEFAULT_CARD_COLOR_ID);
    window.localStorage.setItem(PACK_GRID_COLOR_KEY, DEFAULT_CARD_COLOR_ID);

    setPackGridCustomHexState(DEFAULT_CUSTOM);
    window.localStorage.setItem(PACK_GRID_CUSTOM_KEY, DEFAULT_CUSTOM);

    setPackGridColorOpacityState(DEFAULT_OPACITY);
    window.localStorage.setItem(PACK_GRID_OPACITY_KEY, String(DEFAULT_OPACITY));

    setPackCardScaleState(PACK_CARD_SCALE_BASE);
    window.localStorage.setItem(PACK_SCALE_KEY, String(PACK_CARD_SCALE_BASE));

    setPackCardFontScaleState(PACK_CARD_FONT_SCALE_BASE);
    window.localStorage.setItem(PACK_CARD_FONT_SCALE_KEY, String(PACK_CARD_FONT_SCALE_BASE));

    setPackLibraryColorState(DEFAULT_CARD_COLOR_ID);
    window.localStorage.setItem(PACK_LIBRARY_COLOR_KEY, DEFAULT_CARD_COLOR_ID);

    setPackLibraryCustomHexState(DEFAULT_CUSTOM);
    window.localStorage.setItem(PACK_LIBRARY_CUSTOM_KEY, DEFAULT_CUSTOM);

    setPackLibraryColorOpacityState(DEFAULT_OPACITY);
    window.localStorage.setItem(PACK_LIBRARY_OPACITY_KEY, String(DEFAULT_OPACITY));

    setPackLibraryCardScaleState(DEFAULT_CARD_SCALE);
    window.localStorage.setItem(PACK_LIBRARY_SCALE_KEY, String(DEFAULT_CARD_SCALE));

    setBaseOpacityState(DEFAULT_OPACITY);
    window.localStorage.setItem(BASE_OPACITY_KEY, String(DEFAULT_OPACITY));

    applyAll({
      mode,
      accentId: ACCENT_PRESETS[0].id,
      customHex: DEFAULT_CUSTOM,
      bagColorId: DEFAULT_CARD_COLOR_ID,
      bagCustomHex: DEFAULT_CUSTOM,
      bagColorOpacity: DEFAULT_OPACITY,
      packGridColorId: DEFAULT_CARD_COLOR_ID,
      packGridCustomHex: DEFAULT_CUSTOM,
      packGridColorOpacity: DEFAULT_OPACITY,
      packLibraryColorId: DEFAULT_CARD_COLOR_ID,
      packLibraryCustomHex: DEFAULT_CUSTOM,
      packLibraryColorOpacity: DEFAULT_OPACITY,
      baseOpacity: DEFAULT_OPACITY,
    });
    applyFontScale("md");
    applyCardScale(
      DEFAULT_CARD_SCALE,
      DEFAULT_CARD_SCALE,
      PACK_CARD_SCALE_BASE,
      DEFAULT_CARD_SCALE,
      PACK_CARD_FONT_SCALE_BASE
    );

    updateThemePrefs({
      accentId: ACCENT_PRESETS[0].id,
      customAccentHex: DEFAULT_CUSTOM,
      bagColorId: DEFAULT_CARD_COLOR_ID,
      customBagColorHex: DEFAULT_CUSTOM,
      bagColorOpacity: DEFAULT_OPACITY,
      bagCardScale: DEFAULT_CARD_SCALE,
      bagCardFontScale: DEFAULT_CARD_SCALE,
      packGridColorId: DEFAULT_CARD_COLOR_ID,
      customPackGridColorHex: DEFAULT_CUSTOM,
      packGridColorOpacity: DEFAULT_OPACITY,
      packCardScale: PACK_CARD_SCALE_BASE,
      packCardFontScale: PACK_CARD_FONT_SCALE_BASE,
      packLibraryColorId: DEFAULT_CARD_COLOR_ID,
      customPackLibraryColorHex: DEFAULT_CUSTOM,
      packLibraryColorOpacity: DEFAULT_OPACITY,
      packLibraryCardScale: DEFAULT_CARD_SCALE,
      baseOpacity: DEFAULT_OPACITY,
    }).catch(() => {});
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        setMode,
        accentId,
        setAccent,
        customHex,
        setCustomAccent,
        fontScale,
        setFontScale,
        bagColorId,
        setBagColor,
        bagCustomHex,
        setCustomBagColor,
        bagColorOpacity,
        setBagColorOpacity,
        bagCardScale,
        setBagCardScale,
        bagCardFontScale,
        setBagCardFontScale,
        packGridColorId,
        setPackGridColor,
        packGridCustomHex,
        setCustomPackGridColor,
        packGridColorOpacity,
        setPackGridColorOpacity,
        packCardScale,
        setPackCardScale,
        packCardFontScale,
        setPackCardFontScale,
        packLibraryColorId,
        setPackLibraryColor,
        packLibraryCustomHex,
        setCustomPackLibraryColor,
        packLibraryColorOpacity,
        setPackLibraryColorOpacity,
        packLibraryCardScale,
        setPackLibraryCardScale,
        baseOpacity,
        setBaseOpacity,
        resetThemeSettings,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
