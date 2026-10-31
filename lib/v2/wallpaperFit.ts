// 위젯 "배경화면" 바탕(2026-10-31). iOS 기본 홈 화면에서 위젯이 배경화면을 비치게 하는 공개 API가 없어서
// (_secrets/docs/packinbag_위젯_투명배경_실험.md) 빈 홈 화면 스크린샷에서 위젯 자리만 잘라 사진 바탕으로 깐다.
// 위젯 자리는 기종 표 대신 직접 잰다: 꾸미기를 분홍 단색(WALLPAPER_MARK_COLOR)으로 두고 홈 화면을 스크린샷 →
// 분홍 칸을 찾는다(findMarkRect). 그다음 빈 페이지 스크린샷에서 그 자리를 잘라(cropWallpaper) 사진으로 올린다.
// 위젯(Swift)은 지금 있는 사진 · 단색 바탕을 그대로 쓰므로 네이티브 변경이 없다(1.7 이상 앱에서 됨).
import type { WidgetWallpaper } from "@/lib/types";

export const WALLPAPER_MARK_COLOR = "#FF00FF";

export interface MarkRect {
  // 스크린샷 폭 · 높이에 대한 비율(0~1)
  x: number;
  y: number;
  w: number;
  h: number;
  // 스크린샷 픽셀 폭 · 높이(같은 기기 · 방향인지 확인. 기종마다 비율이 거의 같아 비율로는 못 가른다)
  sw: number;
  sh: number;
}

const isMark = (r: number, g: number, b: number) => r > 180 && b > 180 && g < 110 && Math.abs(r - b) < 80;

// RGBA 픽셀에서 분홍 칸을 찾는다. 위젯 글자가 칸 안을 조금 가리므로 칸 넓이의 절반 이상이 분홍이면 칸으로 본다.
// 분홍이 너무 작거나, 두 군데 이상이라 칸이 비면(채움 50% 미만) · 작은 위젯 모양(정사각형)이 아니면 null
export function findMarkRect(data: Uint8ClampedArray, width: number, height: number): MarkRect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < height; y++) {
    let i = y * width * 4;
    for (let x = 0; x < width; x++, i += 4) {
      if (!isMark(data[i], data[i + 1], data[i + 2])) continue;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (count === 0) return null;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  if (w < width * 0.15 || count < w * h * 0.5 || h / w < 0.85 || h / w > 1.15) return null;
  return { x: minX / width, y: minY / height, w: w / width, h: h / height, sw: width, sh: height };
}

// 자리를 잰 스크린샷과 같은 크기인지(같은 기기 · 같은 방향)
export function sameScreen(wp: WidgetWallpaper, width: number, height: number): boolean {
  return wp.sw === width && wp.sh === height;
}

export function toWallpaper(rect: MarkRect): WidgetWallpaper {
  const r = (v: number) => Math.round(v * 10000) / 10000;
  return { x: r(rect.x), y: r(rect.y), w: r(rect.w), h: r(rect.h), sw: rect.sw, sh: rect.sh };
}

// ---- 기종별 위젯 자리(스크린샷 1장으로 맞추기, 10/31) ----
// 빈 페이지 스크린샷 높이(px)로 기종을 알아보고, 작은 위젯이 놓일 수 있는 6칸(왼 · 오른 × 위 · 가운데 · 아래)을 보여 준다.
// 값은 Scriptable 투명 위젯 스크립트(mzeryck, "iOS 18에서 확인")의 표: [작은 위젯 한 변, 왼쪽 x, 오른쪽 x, 위 y, 가운데 y, 아래 y] px.
// 표에 없는 기종 · 어긋나는 경우는 분홍 표시로 직접 잰다(findMarkRect)
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

// 이 스크린샷 크기에서 작은 위젯이 놓일 수 있는 칸들. 모르는 기종 · 가로 화면이면 null
export function widgetSlotLayouts(width: number, height: number): SlotLayout[] | null {
  if (width >= height) return null;
  const layouts = LAYOUTS[height];
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
          wallpaper: { x: r(x / width), y: r([top, middle, bottom][ri] / height), w: r(size / width), h: r(size / height), sw: width, sh: height },
        })),
      ),
    }));
  return out.length > 0 ? out : null;
}

// ---- 브라우저 ----

async function readPixels(file: Blob): Promise<{ data: Uint8ClampedArray; width: number; height: number; bitmap: ImageBitmap }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("사진을 읽지 못했어요");
  ctx.drawImage(bitmap, 0, 0);
  return { data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data, width: bitmap.width, height: bitmap.height, bitmap };
}

export async function detectMark(file: Blob): Promise<WidgetWallpaper | null> {
  const { data, width, height, bitmap } = await readPixels(file);
  bitmap.close?.();
  const rect = findMarkRect(data, width, height);
  return rect ? toWallpaper(rect) : null;
}

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
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("사진을 읽지 못했어요");
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) throw new Error("사진을 읽지 못했어요");
    return blob;
  } finally {
    bitmap.close?.();
  }
}
