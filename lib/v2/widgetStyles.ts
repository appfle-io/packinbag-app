// 북마크 위젯(가방 바로가기) 꾸미기(2026-10-18, 1.7).
// - 꾸미기는 users/{uid}.widgetStyles 배열(AuthProvider.updateWidgetStyles). 이미 구독 중인 문서라 읽기가 늘지 않는다
// - 사진 배경: 고른 사진을 긴 변 1024px JPEG로 줄여 Storage users/{uid}/widgetPhotos/{id}-{시각}.jpg에 올린다.
//   자르기는 값(zoom · x · y)만 둔다 → 웹은 CSS transform, 위젯(Swift)은 같은 값으로 그린다
// - 무료: 꾸미기 1개 · 기본 바탕만(사진 · 단색은 프리미엄). 지금은 FREE_LAUNCH라 모두 프리미엄
// - iOS 위젯에는 nativeBridge.pushWidgetStyles로 넘긴다(사진은 네이티브가 주소로 내려받아 App Group에 둔다)
import { deleteObject, getDownloadURL, listAll, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";
import type { WidgetStyle, WidgetStylePos, WidgetStyleShow } from "@/lib/types";

export const FREE_WIDGET_STYLES = 1;
export const MAX_WIDGET_STYLES = 20;
export const WIDGET_NAME_MAX = 20;
export const WIDGET_ZOOM_MIN = 1;
export const WIDGET_ZOOM_MAX = 3;
export const WIDGET_DIM_MAX = 70;
const PHOTO_MAX_SIDE = 1024;

export const WIDGET_SWATCHES: { hex: string; label: string }[] = [
  { hex: "#2E5E4E", label: "딥그린" },
  { hex: "#1F2321", label: "먹색" },
  { hex: "#2F5D7C", label: "바다" },
  { hex: "#C8643B", label: "노을" },
  { hex: "#FFFFFF", label: "흰색" },
  { hex: "#E9E1D3", label: "모래" },
  { hex: "#E8C5C8", label: "분홍" },
];

export const WIDGET_POSITIONS: { key: WidgetStylePos; label: string }[] = [
  { key: "tl", label: "왼쪽 위" },
  { key: "tc", label: "위 가운데" },
  { key: "tr", label: "오른쪽 위" },
  { key: "ml", label: "가운데 왼쪽" },
  { key: "mc", label: "정가운데" },
  { key: "mr", label: "가운데 오른쪽" },
  { key: "bl", label: "왼쪽 아래" },
  { key: "bc", label: "아래 가운데" },
  { key: "br", label: "오른쪽 아래" },
];

export const WIDGET_SHOW_FIELDS: { key: keyof WidgetStyleShow; label: string; hint?: string }[] = [
  { key: "name", label: "가방 이름" },
  { key: "dday", label: "D-Day", hint: "D-Day가 있을 때만" },
  { key: "progress", label: "챙긴 개수" },
  { key: "left", label: "남은 개수" },
  { key: "bar", label: "진행 막대" },
  { key: "packed", label: "다 싼 날", hint: "반복 가방 · 마지막으로 다 싼 날" },
];

export const DEFAULT_WIDGET_SHOW: WidgetStyleShow = {
  name: true,
  dday: true,
  progress: true,
  left: false,
  bar: true,
  packed: false,
};

export function newWidgetStyle(): WidgetStyle {
  return {
    id: `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    bg: "plain",
    color: WIDGET_SWATCHES[0].hex,
    zoom: 1,
    x: 0,
    y: 0,
    dim: 40,
    ink: "auto",
    pos: "bl",
    show: { ...DEFAULT_WIDGET_SHOW },
    updatedAt: new Date().toISOString(),
  };
}

const HEX = /^#[0-9A-F]{6}$/;
const POS = new Set(WIDGET_POSITIONS.map((p) => p.key));

// 저장 전 값 정리(범위 밖 · 모르는 값은 기본으로). 무료면 배경을 기본으로
export function normalizeWidgetStyle(s: WidgetStyle, premium: boolean): WidgetStyle {
  const zoom = clamp(Number(s.zoom) || 1, WIDGET_ZOOM_MIN, WIDGET_ZOOM_MAX);
  const bg = !premium ? "plain" : s.bg === "photo" && !s.photoUrl ? "plain" : s.bg;
  const color = typeof s.color === "string" && HEX.test(s.color.toUpperCase()) ? s.color.toUpperCase() : WIDGET_SWATCHES[0].hex;
  const inkColor = typeof s.inkColor === "string" && HEX.test(s.inkColor.toUpperCase()) ? s.inkColor.toUpperCase() : undefined;
  const ink = s.ink === "custom" && !inkColor ? "auto" : (["auto", "white", "black", "custom"].includes(s.ink) ? s.ink : "auto");
  return {
    ...s,
    name: (s.name ?? "").trim().slice(0, WIDGET_NAME_MAX) || "내 꾸미기",
    bg,
    color,
    zoom,
    x: clampOffset(Number(s.x) || 0, zoom),
    y: clampOffset(Number(s.y) || 0, zoom),
    dim: clamp(Math.round(Number(s.dim ?? 40)), 0, WIDGET_DIM_MAX),
    ink,
    inkColor: ink === "custom" ? inkColor : undefined,
    pos: POS.has(s.pos) ? s.pos : "bl",
    show: { ...DEFAULT_WIDGET_SHOW, ...(s.show ?? {}) },
    updatedAt: new Date().toISOString(),
  };
}

// 무료로 쓸 때 실제로 보이는 모양: 첫 번째만 쓰고(배경은 기본), 나머지는 잠김
export function widgetStyleLocked(index: number, premium: boolean): boolean {
  return !premium && index >= FREE_WIDGET_STYLES;
}

export function effectiveWidgetStyles(list: WidgetStyle[] | undefined, premium: boolean): WidgetStyle[] {
  const all = Array.isArray(list) ? list : [];
  if (premium) return all;
  return all.slice(0, FREE_WIDGET_STYLES).map((s) => ({ ...s, bg: "plain" as const }));
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// 사진을 크게 했을 때만 옮길 수 있다(가장자리에 빈 곳이 생기지 않게)
export function clampOffset(v: number, zoom: number): number {
  const m = ((zoom - 1) / 2) * 100;
  return Math.round(clamp(v, -m, m) * 10) / 10;
}

// 배경 밝기(0~1). 글자색 "자동"을 정할 때
function hexLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return 1;
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// 글자색: 기본 바탕은 null(테마 글자색), 사진은 자동이면 흰색, 단색은 밝기로
export function widgetInkColor(s: Pick<WidgetStyle, "bg" | "color" | "ink" | "inkColor">): string | null {
  if (s.bg === "plain") return null;
  if (s.ink === "white") return "#FFFFFF";
  if (s.ink === "black") return "#17171A";
  if (s.ink === "custom" && s.inkColor) return s.inkColor;
  if (s.bg === "photo") return "#FFFFFF";
  return hexLuminance(s.color ?? "#2E5E4E") > 0.62 ? "#17171A" : "#FFFFFF";
}

// ---- 위젯에 보이는 가방 정보(미리 보기 · iOS PackInBagBookmarkWidget과 같은 문구) ----

export interface WidgetBagStats {
  name: string;
  dday: string | null;
  done: number;
  total: number;
  packed: string | null;
}

// "D-3" · "D-Day" · "D+2". 날짜가 없거나 이상하면 null. dayOne(당일을 1일로 세기)이면 당일부터 D+1
export function ddayText(travelDate: string | undefined, now: Date = new Date(), dayOne = false): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(travelDate ?? "");
  if (!m) return null;
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff > 0) return `D-${diff}`;
  if (dayOne) return `D+${-diff + 1}`;
  return diff === 0 ? "D-Day" : `D+${-diff}`;
}

// "오늘 다 쌌어요" · "어제 다 쌌어요" · "10/17 다 쌌어요"
function packedText(lastPackedAt: string | undefined, now: Date = new Date()): string | null {
  if (!lastPackedAt) return null;
  const d = new Date(lastPackedAt);
  if (Number.isNaN(d.getTime())) return null;
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  if (diff === 0) return "오늘 다 쌌어요";
  if (diff === 1) return "어제 다 쌌어요";
  return `${d.getMonth() + 1}/${d.getDate()} 다 쌌어요`;
}

// 보여 줄 정보 한 줄: "12/20 챙김 · 남은 8개 · 10/17 다 쌌어요"
export function widgetMetaLine(stats: WidgetBagStats, show: WidgetStyleShow): string {
  const left = stats.total - stats.done;
  const parts: string[] = [];
  if (show.progress) parts.push(`${stats.done}/${stats.total} 챙김`);
  if (show.left) parts.push(stats.total > 0 && left === 0 ? "다 챙겼어요" : `남은 ${left}개`);
  if (show.packed && stats.packed) parts.push(stats.packed);
  return parts.join(" · ");
}

// 체크리스트 팩의 체크 아이템만 센다(네이티브 요약과 같은 기준, 폴더 · 메모 · 글 아이템 빼고)
export function widgetBagStats(
  bag: { name?: string; travelDate?: string; ddayCountTodayAsDayOne?: boolean; lastPackedAt?: string; packs?: { kind?: string; type?: string; items?: { type?: string; checked?: boolean }[] }[] },
  now: Date = new Date(),
): WidgetBagStats {
  let done = 0;
  let total = 0;
  for (const p of bag.packs ?? []) {
    if (!p || p.kind === "editor" || p.type === "folder") continue;
    for (const i of p.items ?? []) {
      if (!i || i.type === "text") continue;
      total += 1;
      if (i.checked) done += 1;
    }
  }
  return { name: bag.name || "가방", dday: ddayText(bag.travelDate, now, !!bag.ddayCountTodayAsDayOne), done, total, packed: packedText(bag.lastPackedAt, now) };
}

export const SAMPLE_WIDGET_BAG: WidgetBagStats = { name: "제주 3박 4일", dday: "D-3", done: 12, total: 20, packed: "10/17 다 쌌어요" };

// ---- 사진 ----------------------------------------------------------------

async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("사진을 읽지 못했어요");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("사진을 읽지 못했어요");
  return blob;
}

// 고른 사진을 줄여 올리고 { url, path }를 돌려준다. 예전 사진은 부르는 쪽이 저장 뒤 지운다(deleteWidgetPhoto)
export async function uploadWidgetPhoto(uid: string, styleId: string, file: File): Promise<{ url: string; path: string }> {
  const blob = await toJpeg(file);
  const path = `users/${uid}/widgetPhotos/${styleId}-${Date.now()}.jpg`;
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: "image/jpeg", cacheControl: "private, max-age=31536000, immutable" });
  return { url: await getDownloadURL(r), path };
}

export async function deleteWidgetPhoto(path: string | undefined): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // 이미 지워졌으면 그대로
  }
}

// 지금 쓰는 꾸미기가 안 쓰는 사진을 지운다(저장을 안 하고 나간 새 사진 등). 실패해도 괜찮다
async function deleteUnusedWidgetPhotos(uid: string, styles: WidgetStyle[]): Promise<void> {
  const used = new Set(styles.map((s) => s.photoPath).filter(Boolean));
  try {
    const res = await listAll(ref(storage, `users/${uid}/widgetPhotos`));
    await Promise.all(res.items.filter((it) => !used.has(it.fullPath)).map((it) => deleteObject(it).catch(() => {})));
  } catch {
    // 목록을 못 받으면 그대로 둔다
  }
}

// 탈퇴 정리: 위젯 사진 모두
export async function deleteAllWidgetPhotos(uid: string): Promise<void> {
  await deleteUnusedWidgetPhotos(uid, []);
}
