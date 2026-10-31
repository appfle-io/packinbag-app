// 위젯 "배경화면" 바탕(2026-10-31). iOS 기본 홈 화면에서 위젯이 배경화면을 비치게 하는 공개 API가 없어서
// (_secrets/docs/packinbag_위젯_투명배경_실험.md) 빈 홈 화면 스크린샷에서 위젯 자리만 잘라 사진 바탕으로 깐다.
// 빈 페이지 스크린샷 1장 → 기종 표의 위젯 칸 중 누른 칸을 잘라(cropWallpaper) 사진으로 올린다.
// 위젯(Swift)은 지금 있는 사진 바탕을 그대로 쓰므로 네이티브 변경이 없다(1.7 이상 앱에서 됨).
import type { WidgetWallpaper } from "@/lib/types";

// 예전(10/31 1.10.1 첫 배포) 분홍 자리 표시 방식의 색. 그때 저장된 꾸미기를 정리할 때만 쓴다(normalizeWidgetStyle)
export const WALLPAPER_MARK_COLOR = "#FF00FF";

// 칸을 잡은 스크린샷과 같은 크기인지(같은 기기 · 같은 방향)
export function sameScreen(wp: WidgetWallpaper, width: number, height: number): boolean {
  return wp.sw === width && wp.sh === height;
}

// ---- 기종별 위젯 자리(스크린샷 1장으로 맞추기, 10/31) ----
// 빈 페이지 스크린샷 높이(px)로 기종을 알아보고, 작은 위젯이 놓일 수 있는 6칸(왼 · 오른 × 위 · 가운데 · 아래)을 보여 준다.
// 값은 Scriptable 투명 위젯 스크립트(mzeryck, "iOS 18에서 확인")의 표: [작은 위젯 한 변, 왼쪽 x, 오른쪽 x, 위 y, 가운데 y, 아래 y] px.
// 표에 없는 기종은 못 쓴다
// iOS 26부터 홈 화면 배치가 달라져(위젯이 커짐) iOS 18 표가 안 맞는다 → LAYOUTS_26(실기기에서 잰 값만, 10/31 사용자 아이폰 iOS 27 스크린샷)
type Layout = { key: string; label: string; v: [number, number, number, number, number, number] };

const LAYOUTS: Record<number, Layout[]> = {
  2868: [
    { key: "text", label: "앱 이름 보임", v: [510, 114, 696, 276, 912, 1548] },
    { key: "notext", label: "앱 이름 숨김(크게)", v: [530, 91, 699, 276, 882, 1488] },
  ],
  2796: [
    { key: "text", label: "앱 이름 보임", v: [510, 98, 681, 252, 888, 1524] },
    { key: "notext", label: "앱 이름 숨김(크게)", v: [530, 75, 684, 252, 858, 1464] },
  ],
  2622: [
    { key: "text", label: "앱 이름 보임", v: [486, 87, 633, 261, 872, 1485] },
    { key: "notext", label: "앱 이름 숨김(크게)", v: [495, 84, 626, 270, 810, 1350] },
  ],
  2556: [
    { key: "text", label: "앱 이름 보임", v: [474, 81, 624, 240, 828, 1416] },
    { key: "notext", label: "앱 이름 숨김(크게)", v: [495, 66, 618, 243, 795, 1347] },
  ],
  2778: [{ key: "text", label: "", v: [510, 96, 678, 246, 882, 1518] }],
  2688: [{ key: "text", label: "", v: [507, 81, 654, 228, 858, 1488] }],
  2532: [{ key: "text", label: "", v: [474, 78, 618, 231, 819, 1407] }],
  2436: [
    { key: "x", label: "X · XS · 11 Pro", v: [465, 69, 591, 213, 783, 1353] },
    { key: "mini", label: "mini", v: [465, 69, 591, 231, 801, 1371] },
  ],
  1792: [{ key: "text", label: "", v: [338, 55, 437, 159, 579, 999] }],
  2208: [{ key: "text", label: "", v: [471, 99, 672, 114, 696, 1278] }],
  1334: [
    { key: "text", label: "앱 이름 보임", v: [296, 54, 400, 60, 412, 764] },
    { key: "notext", label: "앱 이름 숨김(크게)", v: [309, 41, 399, 67, 425, 783] },
  ],
};

const LAYOUTS_26: Record<number, Layout[]> = {
  2622: [{ key: "ios26", label: "", v: [509, 63, 632, 270, 838, 1408] }],
};

// 아이폰 iOS 큰 버전(웹 · 모르면 null). WKWebView UA "CPU iPhone OS 27_0 like Mac OS X"
export function iosMajor(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): number | null {
  const m = /iPhone OS (\d+)_/.exec(ua);
  return m ? Number(m[1]) : null;
}

// iOS 26부터 위젯 바탕에 옅은 흰 유리가 덮인다(10/31 실기기: 짙은 바탕 약 7%, 파란 배경화면 약 10%가 밝아짐).
// 자른 배경화면을 그만큼 미리 어둡게 해서 덮인 뒤 주변과 같아 보이게 한다(%)
export function defaultVeil(ios: number | null = iosMajor()): number {
  return ios !== null && ios >= 26 ? 8 : 0;
}

// 덮일 유리를 미리 빼 둔 픽셀 값. veil > 0: 흰 유리(v = 결과·(1-a) + 255a를 거꾸로), veil < 0: 검은 유리
export function unveil(v: number, veil: number): number {
  const a = veil / 100;
  const out = a >= 0 ? (v - 255 * a) / (1 - a) : v / (1 + a);
  return Math.max(0, Math.min(255, Math.round(out)));
}

export interface WidgetSlot {
  key: string;
  label: string;
  wallpaper: WidgetWallpaper;
}

export interface SlotLayout {
  key: string;
  label: string;
  slots: WidgetSlot[];
}

const ROWS = [
  ["t", "위"],
  ["m", "가운데"],
  ["b", "아래"],
] as const;

// 이 스크린샷 크기에서 작은 위젯이 놓일 수 있는 칸들. 모르는 기종 · 가로 화면이면 null.
// iOS 26 이상은 잰 값이 있는 기종만(iOS 18 표는 안 맞음)
export function widgetSlotLayouts(width: number, height: number, ios: number | null = iosMajor()): SlotLayout[] | null {
  if (width >= height) return null;
  const layouts = (ios !== null && ios >= 26 ? LAYOUTS_26 : LAYOUTS)[height];
  if (!layouts) return null;
  const r = (v: number) => Math.round(v * 10000) / 10000;
  const out = layouts
    .filter(({ v: [size, , right] }) => right + size <= width)
    .map(({ key, label, v: [size, left, right, top, middle, bottom] }) => ({
      key,
      label,
      slots: ROWS.flatMap(([rk, rl], ri) =>
        ([["l", "왼쪽", left], ["r", "오른쪽", right]] as const).map(([ck, cl, x]) => ({
          key: rk + ck,
          label: `${cl} ${rl}`,
          wallpaper: { x: r(x / width), y: r([top, middle, bottom][ri] / height), w: r(size / width), h: r(size / height), sw: width, sh: height } as WidgetWallpaper,
        })),
      ),
    }));
  return out.length > 0 ? out : null;
}

// ---- 브라우저 ----

// 빈 홈 화면 스크린샷에서 위젯 자리를 잘라 JPEG로. 다른 기기 · 방향이면 "screen"
export async function cropWallpaper(file: Blob, wp: WidgetWallpaper): Promise<Blob | "screen"> {
  const bitmap = await createImageBitmap(file);
  try {
    if (!sameScreen(wp, bitmap.width, bitmap.height)) return "screen";
    const sx = Math.round((wp.x ?? 0) * bitmap.width);
    const sy = Math.round((wp.y ?? 0) * bitmap.height);
    const sw = Math.max(1, Math.round((wp.w ?? 0) * bitmap.width));
    const sh = Math.max(1, Math.round((wp.h ?? 0) * bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    // 아이폰 스크린샷은 Display P3라 sRGB로 바꾸면 색이 조금 달라진다 → 되는 브라우저(WebKit)는 P3 그대로
    const ctx = canvas.getContext("2d", { colorSpace: "display-p3", willReadFrequently: true });
    if (!ctx) throw new Error("사진을 읽지 못했어요");
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    const veil = wp.veil ?? 0;
    if (veil !== 0) {
      const img = ctx.getImageData(0, 0, sw, sh);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = unveil(d[i], veil);
        d[i + 1] = unveil(d[i + 1], veil);
        d[i + 2] = unveil(d[i + 2], veil);
      }
      ctx.putImageData(img, 0, 0);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) throw new Error("사진을 읽지 못했어요");
    return blob;
  } finally {
    bitmap.close?.();
  }
}
