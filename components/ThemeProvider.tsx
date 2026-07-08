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
const DEFAULT_CUSTOM = "#8b5cf6";
// "default"는 커스텀하지 않은 상태 (기본 무채색 카드 배경 = --surface 그대로)
export const DEFAULT_CARD_COLOR_ID = "default";

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
  packGridColorId: string;
  packGridCustomHex: string;
}

function applyAll(settings: ColorSettings) {
  const { mode, accentId, customHex, bagColorId, bagCustomHex, packGridColorId, packGridCustomHex } =
    settings;
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
  applyCardColor("--bag-card-bg", bagColorId, bagCustomHex, resolved);
  applyCardColor("--pack-card-bg", packGridColorId, packGridCustomHex, resolved);
}

// 가방/팩 카드 배경 톤 하나를 CSS 변수에 반영. "default"면 커스텀 안 함 (스타일시트의
// --surface 기본값이 그대로 적용되도록 인라인 속성을 제거).
function applyCardColor(
  cssVar: string,
  colorId: string,
  customHex: string,
  resolved: "light" | "dark"
) {
  const root = document.documentElement.style;
  if (colorId === DEFAULT_CARD_COLOR_ID) {
    root.removeProperty(cssVar);
    return;
  }
  const tone =
    colorId === "custom"
      ? deriveAccentTone(customHex, resolved)
      : getAccentPreset(colorId)[resolved];
  root.setProperty(cssVar, tone.soft);
}

// 글자 크기 설정: html 루트에 data-font-scale 속성만 세팅한다. 실제 배율 적용은
// globals.css의 .text-[Npx] 클래스별 오버라이드 규칙에서 처리한다 - 그래야
// 아이콘/여백/레이아웃 크기는 그대로 두고 글자 크기만 커지거나 작아진다.
function applyFontScale(scale: FontScale) {
  if (scale === "md") {
    document.documentElement.removeAttribute("data-font-scale");
  } else {
    document.documentElement.setAttribute("data-font-scale", scale);
  }
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
  packGridColorId: string;
  setPackGridColor: (id: string) => void;
  packGridCustomHex: string;
  setCustomPackGridColor: (hex: string) => void;
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
  packGridColorId: DEFAULT_CARD_COLOR_ID,
  setPackGridColor: () => {},
  packGridCustomHex: DEFAULT_CUSTOM,
  setCustomPackGridColor: () => {},
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
  const [packGridColorId, setPackGridColorState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CARD_COLOR_ID;
    return window.localStorage.getItem(PACK_GRID_COLOR_KEY) ?? DEFAULT_CARD_COLOR_ID;
  });
  const [packGridCustomHex, setPackGridCustomHexState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CUSTOM;
    return window.localStorage.getItem(PACK_GRID_CUSTOM_KEY) ?? DEFAULT_CUSTOM;
  });

  const currentSettings = (): ColorSettings => ({
    mode,
    accentId,
    customHex,
    bagColorId,
    bagCustomHex,
    packGridColorId,
    packGridCustomHex,
  });

  useEffect(() => {
    applyAll(currentSettings());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, accentId, customHex, bagColorId, bagCustomHex, packGridColorId, packGridCustomHex]);

  useEffect(() => {
    applyFontScale(fontScale);
  }, [fontScale]);

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
      packGridColorId: remotePackGridColorId,
      customPackGridColorHex: remotePackGridCustom,
    } = profile;
    if (
      !remoteMode &&
      !remoteAccent &&
      !remoteFontScale &&
      !remoteBagColorId &&
      !remotePackGridColorId
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
    if (remotePackGridColorId) {
      setPackGridColorState(remotePackGridColorId);
      window.localStorage.setItem(PACK_GRID_COLOR_KEY, remotePackGridColorId);
    }
    if (remotePackGridCustom) {
      setPackGridCustomHexState(remotePackGridCustom);
      window.localStorage.setItem(PACK_GRID_CUSTOM_KEY, remotePackGridCustom);
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
        packGridColorId,
        setPackGridColor,
        packGridCustomHex,
        setCustomPackGridColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
