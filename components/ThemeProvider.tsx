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
const BAG_OPACITY_KEY = "packinbag-bag-color-opacity";
const PACK_GRID_OPACITY_KEY = "packinbag-pack-grid-color-opacity";
const BAG_SCALE_KEY = "packinbag-bag-card-scale";
const PACK_SCALE_KEY = "packinbag-pack-card-scale";
const DEFAULT_CUSTOM = "#8b5cf6";
// "default"는 커스텀하지 않은 상태 (기본 무채색 카드 배경 = --surface 그대로)
export const DEFAULT_CARD_COLOR_ID = "default";
// 투명도/카드 크기 기본값 (둘 다 "지금 이대로" = 100%)
const DEFAULT_OPACITY = 1;
const DEFAULT_CARD_SCALE = 1;

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
}

// 가방/팩 카드 배경 톤 + 투명도를 CSS 변수에 반영.
// color-mix()로 "실제 색 pct% + transparent"를 섞어서, 투명도를 낮출수록
// 카드 뒤에 있는 페이지 배경(라이트=흰색/다크=검정 계열)이 비쳐 보이게 한다.
// "기본(default)"이어도 --surface를 기준으로 똑같이 투명도를 적용한다 (완전 불투명=100%일 땐
// 기존과 동일한 모습).
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
}

// 가방 카드 / 팩 카드 크기 배율을 CSS 변수로 반영 (라이트/다크 무관, 그냥 숫자).
// 각 컴포넌트(BagCard/PackCard/ItemRow)에서 padding·아이콘·글자 크기를
// calc(기본값 * var(--bag-card-scale)) 형태로 계산할 때 쓴다.
function applyCardScale(bagScale: number, packScale: number) {
  const root = document.documentElement.style;
  root.setProperty("--bag-card-scale", String(bagScale));
  root.setProperty("--pack-card-scale", String(packScale));
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
  packGridColorId: string;
  setPackGridColor: (id: string) => void;
  packGridCustomHex: string;
  setCustomPackGridColor: (hex: string) => void;
  packGridColorOpacity: number;
  setPackGridColorOpacity: (opacity: number) => void;
  packCardScale: number;
  setPackCardScale: (scale: number) => void;
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
  packGridColorId: DEFAULT_CARD_COLOR_ID,
  setPackGridColor: () => {},
  packGridCustomHex: DEFAULT_CUSTOM,
  setCustomPackGridColor: () => {},
  packGridColorOpacity: DEFAULT_OPACITY,
  setPackGridColorOpacity: () => {},
  packCardScale: DEFAULT_CARD_SCALE,
  setPackCardScale: () => {},
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
    if (typeof window === "undefined") return DEFAULT_CARD_SCALE;
    const raw = window.localStorage.getItem(PACK_SCALE_KEY);
    return raw !== null ? Number(raw) : DEFAULT_CARD_SCALE;
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
  ]);

  useEffect(() => {
    applyFontScale(fontScale);
  }, [fontScale]);

  useEffect(() => {
    applyCardScale(bagCardScale, packCardScale);
  }, [bagCardScale, packCardScale]);

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
      packGridColorId: remotePackGridColorId,
      customPackGridColorHex: remotePackGridCustom,
      packGridColorOpacity: remotePackGridOpacity,
      packCardScale: remotePackScale,
    } = profile;
    if (
      !remoteMode &&
      !remoteAccent &&
      !remoteFontScale &&
      !remoteBagColorId &&
      !remotePackGridColorId &&
      remoteBagOpacity === undefined &&
      remoteBagScale === undefined &&
      remotePackGridOpacity === undefined &&
      remotePackScale === undefined
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
    applyCardScale(scale, packCardScale);
    updateThemePrefs({ bagCardScale: scale }).catch(() => {});
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
    applyCardScale(bagCardScale, scale);
    updateThemePrefs({ packCardScale: scale }).catch(() => {});
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
        packGridColorId,
        setPackGridColor,
        packGridCustomHex,
        setCustomPackGridColor,
        packGridColorOpacity,
        setPackGridColorOpacity,
        packCardScale,
        setPackCardScale,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
