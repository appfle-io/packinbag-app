// 설정 > 강조 색상에서 고를 수 있는 프리셋들.
// 라이트/다크 모드 각각에 맞는 accent / accent-strong(눌림·강조) / accent-soft(연한배경)를
// 미리 조율해뒀다. 기본값은 앱 아이콘과 같은 브랜드 오렌지(#FF7637) - 첫 번째 항목이 기본값.

export interface AccentTone {
  accent: string;
  strong: string;
  soft: string;
}

export interface AccentPreset {
  id: string;
  label: string;
  swatch: string; // 설정 화면에 보여줄 대표색(라이트 기준)
  light: AccentTone;
  dark: AccentTone;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: "orange",
    label: "오렌지",
    swatch: "#FF6E2D",
    light: { accent: "#FF6E2D", strong: "#BF5322", soft: "#FFE4D6" },
    dark: { accent: "#FF8A52", strong: "#FFA679", soft: "#3A1D10" },
  },
  {
    id: "blue",
    label: "블루",
    swatch: "#2563eb",
    light: { accent: "#2563eb", strong: "#1d4ed8", soft: "#dbeafe" },
    dark: { accent: "#3b82f6", strong: "#60a5fa", soft: "#172554" },
  },
  {
    id: "red",
    label: "레드",
    swatch: "#dc2626",
    light: { accent: "#dc2626", strong: "#b91c1c", soft: "#fee2e2" },
    dark: { accent: "#f87171", strong: "#fca5a5", soft: "#450a0a" },
  },
  {
    id: "amber",
    label: "옐로",
    swatch: "#d97706",
    light: { accent: "#d97706", strong: "#b45309", soft: "#fef3c7" },
    dark: { accent: "#fbbf24", strong: "#fcd34d", soft: "#451a03" },
  },
  {
    id: "green",
    label: "그린",
    swatch: "#16a34a",
    light: { accent: "#16a34a", strong: "#15803d", soft: "#dcfce7" },
    dark: { accent: "#4ade80", strong: "#86efac", soft: "#052e12" },
  },
  {
    id: "teal",
    label: "틸",
    swatch: "#0d9488",
    light: { accent: "#0d9488", strong: "#0f766e", soft: "#ccfbf1" },
    dark: { accent: "#2dd4bf", strong: "#5eead4", soft: "#042f2c" },
  },
  {
    id: "purple",
    label: "퍼플",
    swatch: "#7c3aed",
    light: { accent: "#7c3aed", strong: "#6d28d9", soft: "#ede9fe" },
    dark: { accent: "#a78bfa", strong: "#c4b5fd", soft: "#2e1065" },
  },
  {
    id: "pink",
    label: "핑크",
    swatch: "#db2777",
    light: { accent: "#db2777", strong: "#be185d", soft: "#fce7f3" },
    dark: { accent: "#f472b6", strong: "#f9a8d4", soft: "#500724" },
  },
  {
    id: "gray",
    label: "그레이",
    swatch: "#4b5563",
    light: { accent: "#4b5563", strong: "#374151", soft: "#e5e7eb" },
    dark: { accent: "#9ca3af", strong: "#d1d5db", soft: "#27272a" },
  },
];

export function getAccentPreset(id: string | null | undefined): AccentPreset {
  return ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
}

// ---- 커스텀 색상(사용자가 색상 휠/헥스코드로 직접 고른 색) 계산용 ----

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const num = parseInt(full, 16) || 0;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360;
  h /= 360;
  s /= 100;
  l /= 100;
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  };
}

// 사용자가 고른 임의의 hex 색상 하나로 라이트/다크 각각에 어울리는
// accent / accent-strong / accent-soft 조합을 계산한다.
// accent 자체는 고른 색 그대로 쓰고, strong/soft만 명도를 조절해서 대비를 맞춘다.
export function deriveAccentTone(hex: string, mode: "light" | "dark"): AccentTone {
  const { r, g, b } = hexToRgb(hex);
  const { h, s } = rgbToHsl(r, g, b);
  const strongL = mode === "light" ? 38 : 68;
  const softL = mode === "light" ? 94 : 16;
  const softS = clamp(s * 0.6, 15, 55);
  const strongRgb = hslToRgb(h, clamp(s, 40, 95), strongL);
  const softRgb = hslToRgb(h, softS, softL);
  return {
    accent: rgbToHex(r, g, b),
    strong: rgbToHex(strongRgb.r, strongRgb.g, strongRgb.b),
    soft: rgbToHex(softRgb.r, softRgb.g, softRgb.b),
  };
}
