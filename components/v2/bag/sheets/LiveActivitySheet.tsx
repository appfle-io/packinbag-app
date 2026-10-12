"use client";

import { useEffect, useMemo, useState } from "react";
import { IconCircle, IconCircleCheckFilled, IconColorPicker, IconRefresh } from "@tabler/icons-react";
import type { Bag } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, Chip, SectionHeader, SegmentedControl, Sheet, cx } from "@/components/v2/ui";
import { buildNativeSummary, type NativeSummaryItem } from "@/lib/nativeSummary";
import {
  endLiveActivity,
  getLiveActivityState,
  nativeSummaryLockProfile,
  pickNativeColor,
  startLiveActivity,
  type LiveActivityFont,
  type LiveActivitySize,
  type LiveActivityState,
  type LiveActivityTextTone,
  type LiveActivityTheme,
} from "@/lib/v2/nativeBridge";
import { usePrivateLock } from "@/components/v2/lock/usePrivateLock";

// 가방 더보기 > 잠금화면에 띄우기(iOS 실시간 현황, 2026-10-10). 팩 하나(또는 가방 전체)를 잠금화면 · 다이내믹 아일랜드에 띄우고 거기서 바로 체크한다.
// 최대 8시간(iOS 규칙), 다 챙기면 내려간다. 꾸미기(배경 · 글자색 · 글꼴 · 글자 크기)는 이 기기에 기억한다.
// 10/11: 팩 맨 앞 "전체"(packId "*"), 배경 "직접"(색 + 불투명도)
// 10/12: 맨 위에 실제 잠금화면 카드와 같은 미리 보기(고르는 즉시 바뀜), 글자색(자동 · 흰색 · 검정 · 직접), 화면 정리.
//   미리 보기는 ios/App/PackInBagWidget/PackInBagWidgetLiveActivity.swift(여백 18/14 · 2열 2줄 · 진행 막대 · "외 N개 · 시각")와
//   PIBStyle.swift(PIBPalette 색 · 글자 크기 배율)를 그대로 옮긴 것. 둘 중 하나를 바꾸면 같이 바꾼다
const STYLE_KEY = "pib_live_activity_style";
const WHOLE_BAG = "*";
// 잠금화면 카드에 보이는 아이템 수(2열 × 2줄, 네이티브 maxShown과 같게)
const MAX_SHOWN = 4;

const THEMES: { value: LiveActivityTheme; label: string }[] = [
  { value: "system", label: "시스템" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "custom", label: "직접" },
];
const TEXT_TONES: { value: LiveActivityTextTone; label: string }[] = [
  { value: "auto", label: "자동" },
  { value: "white", label: "흰색" },
  { value: "black", label: "검정" },
  { value: "custom", label: "직접" },
];
const FONTS: { id: LiveActivityFont; label: string }[] = [
  { id: "system", label: "기본" },
  { id: "pretendard", label: "프리텐다드" },
  { id: "gmarket", label: "지마켓 산스" },
  { id: "gaegu", label: "개구" },
  { id: "d2coding", label: "D2코딩" },
];
const SIZES: { value: LiveActivitySize; label: string }[] = [
  { value: "small", label: "작게" },
  { value: "medium", label: "보통" },
  { value: "large", label: "크게" },
];
// 바로 고르는 배경색(그 밖은 iOS 색 고르기 창)
const BG_SWATCHES: { hex: string; label: string }[] = [
  { hex: "#2E5E4E", label: "딥그린" },
  { hex: "#17171A", label: "블랙" },
  { hex: "#FFFFFF", label: "화이트" },
  { hex: "#ECF1EE", label: "민트 그레이" },
  { hex: "#1E3A5F", label: "네이비" },
  { hex: "#6B4E9B", label: "퍼플" },
  { hex: "#C65A3A", label: "테라코타" },
  { hex: "#E8B931", label: "머스터드" },
];
// 바로 고르는 글자색
const TEXT_SWATCHES: { hex: string; label: string }[] = [
  { hex: "#FFFFFF", label: "화이트" },
  { hex: "#17171A", label: "블랙" },
  { hex: "#2E5E4E", label: "딥그린" },
  { hex: "#9ED8C3", label: "민트" },
  { hex: "#E8B931", label: "머스터드" },
  { hex: "#F08A6C", label: "코랄" },
  { hex: "#8EC5FF", label: "스카이" },
  { hex: "#C3B1F2", label: "라벤더" },
];
const MIN_ALPHA = 0;

type Style = {
  theme: LiveActivityTheme;
  font: LiveActivityFont;
  size: LiveActivitySize;
  bgColor: string;
  bgAlpha: number;
  textTone: LiveActivityTextTone;
  textColor: string;
};
const DEFAULT_STYLE: Style = {
  theme: "system",
  font: "system",
  size: "medium",
  bgColor: "#2E5E4E",
  bgAlpha: 1,
  textTone: "auto",
  textColor: "#FFFFFF",
};

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);
const clampAlpha = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(MIN_ALPHA, v)) : 1);

function rgbOf(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
// 밝은 색이면 글자를 진하게(잠금화면 PIBCustomColor와 같은 기준)
function isLightHex(hex: string): boolean {
  const [r, g, b] = rgbOf(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
const rgba = (hex: string, a: number) => {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

function loadStyle(): Style {
  try {
    const saved = JSON.parse(localStorage.getItem(STYLE_KEY) ?? "null");
    if (saved && typeof saved === "object") {
      return {
        theme: saved.theme ?? DEFAULT_STYLE.theme,
        font: saved.font ?? DEFAULT_STYLE.font,
        size: saved.size ?? DEFAULT_STYLE.size,
        bgColor: isHex(saved.bgColor) ? saved.bgColor.toUpperCase() : DEFAULT_STYLE.bgColor,
        bgAlpha: clampAlpha(saved.bgAlpha),
        textTone: TEXT_TONES.some((t) => t.value === saved.textTone) ? saved.textTone : DEFAULT_STYLE.textTone,
        textColor: isHex(saved.textColor) ? saved.textColor.toUpperCase() : DEFAULT_STYLE.textColor,
      };
    }
  } catch {}
  return DEFAULT_STYLE;
}

// ---- 미리 보기 색 · 글자(PIBStyle.swift PIBPalette와 같은 값) ----------------------------------------

const PALETTE = {
  dark: { background: "#161817", ink: "rgb(240, 242, 240)", sub: "rgb(158, 166, 161)", brand: "rgb(125, 189, 163)", track: "rgba(255, 255, 255, 0.16)" },
  light: { background: "#FFFFFF", ink: "rgb(26, 28, 27)", sub: "rgb(115, 122, 117)", brand: "#2E5E4E", track: "rgba(0, 0, 0, 0.1)" },
};
const SCALE: Record<LiveActivitySize, number> = { small: 0.88, medium: 1, large: 1.14 };
// "기본" 글꼴 = 아이폰 시스템 글꼴. 나머지는 앱 글꼴 클래스(lib/v2/appFonts)
const FONT_CLASS: Record<LiveActivityFont, string | undefined> = {
  system: undefined,
  pretendard: "font-app-pretendard",
  gmarket: "font-app-gmarket",
  gaegu: "font-app-gaegu",
  d2coding: "font-app-d2coding",
};
const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", system-ui, sans-serif';
// 잠금화면 배경화면 흉내(카드가 놓이는 자리). 고른 색 · 불투명도가 어떻게 보이는지 보여 주려고 어두운 사진 느낌으로
const WALLPAPER = "linear-gradient(160deg, #46597d 0%, #23304a 45%, #121821 100%)";

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const on = () => setDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark;
}

interface PreviewData {
  title: string;
  subtitle: string;
  items: NativeSummaryItem[];
  done: number;
  total: number;
}

function LockScreenPreview({ data, style, systemDark }: { data: PreviewData | null; style: Style; systemDark: boolean }) {
  const custom = style.theme === "custom";
  const scheme: "light" | "dark" = custom
    ? isLightHex(style.bgColor)
      ? "light"
      : "dark"
    : style.theme === "light" || style.theme === "dark"
      ? style.theme
      : systemDark
        ? "dark"
        : "light";
  const base = PALETTE[scheme];
  const ink =
    style.textTone === "white" ? "#FFFFFF" : style.textTone === "black" ? "#17171A" : style.textTone === "custom" ? style.textColor : base.ink;
  const sub =
    style.textTone === "white"
      ? "rgba(255, 255, 255, 0.72)"
      : style.textTone === "black"
        ? "rgba(23, 23, 26, 0.62)"
        : style.textTone === "custom"
          ? rgba(style.textColor, 0.72)
          : base.sub;
  const background = custom ? rgba(style.bgColor, style.bgAlpha) : base.background;
  const s = SCALE[style.size];
  const px = (n: number) => `${Math.round(n * s)}px`;
  const fontClass = FONT_CLASS[style.font];

  const now = new Date();
  const synced = `${now.getHours()}시 ${String(now.getMinutes()).padStart(2, "0")}분에 새로고침`;
  const shown = data ? data.items.slice(0, MAX_SHOWN) : [];
  const hidden = data ? Math.max(0, data.total - shown.length) : 0;
  const footer = [hidden > 0 ? `외 ${hidden}개` : null, synced].filter(Boolean).join(" · ");
  const left = data ? data.total - data.done : 0;
  const ratio = data && data.total > 0 ? data.done / data.total : 0;

  // 네이티브 값을 그대로 옮긴 크기라 런타임 style로 넘긴다
  const wallpaperStyle = { backgroundImage: WALLPAPER };
  const clockStyle = { color: "#FFFFFF" };
  const cardStyle = { backgroundColor: background, color: ink, fontFamily: fontClass ? undefined : SYSTEM_FONT, padding: "14px 18px" };
  const clock = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="overflow-hidden rounded-card px-3 pt-4 pb-3" style={wallpaperStyle} aria-label="잠금화면 미리 보기">
      <p className="m-0 pb-4 text-center text-title font-semibold opacity-90" style={clockStyle} aria-hidden="true">
        {clock}
      </p>
      <div className={cx("flex flex-col gap-2 rounded-card", fontClass)} style={cardStyle}>
        {data ? (
          <>
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="truncate font-bold" style={{ fontSize: px(15) }}>
                {data.title}
              </span>
              <span className="truncate" style={{ fontSize: px(11), color: sub }}>
                {data.subtitle}
              </span>
              <span className="ml-auto shrink-0 font-bold" style={{ fontSize: px(13), color: base.brand }}>
                {left === 0 && data.total > 0 ? "다 챙겼어요" : `${data.done}/${data.total}`}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: base.track }}>
              <div className="h-full rounded-full" style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: base.brand }} />
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {shown.map((item) => (
                <span key={item.id} className="flex min-w-0 items-center gap-2" style={{ minHeight: px(22) }}>
                  {item.checked ? (
                    <IconCircleCheckFilled size={Math.round(16 * s)} className="shrink-0" style={{ color: base.brand }} aria-hidden="true" />
                  ) : (
                    <IconCircle size={Math.round(16 * s)} stroke={1.8} className="shrink-0" style={{ color: sub }} aria-hidden="true" />
                  )}
                  <span className={cx("truncate", item.checked && "line-through")} style={{ fontSize: px(14), color: item.checked ? sub : ink }}>
                    {item.text}
                  </span>
                </span>
              ))}
              {shown.length === 0 && (
                <span className="col-span-2" style={{ fontSize: px(13), color: sub }}>
                  체크할 아이템이 없어요
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2" style={{ fontSize: px(11), color: sub }}>
              <span className="truncate">{footer}</span>
              <IconRefresh size={Math.round(13 * s)} stroke={2.2} className="shrink-0" aria-hidden="true" />
            </div>
          </>
        ) : (
          <span style={{ fontSize: px(13), color: sub }}>띄울 팩이 없어요</span>
        )}
      </div>
    </div>
  );
}

// ---- 시트 ---------------------------------------------------------------------------------

export function LiveActivitySheet({ open, onClose, bag }: { open: boolean; onClose: () => void; bag: Bag }) {
  const { user } = useAuth();
  const { show } = useToast();
  const privacy = usePrivateLock();
  const systemDark = useSystemDark();
  const bagLocked = privacy.bagLocked(bag.id);

  // 실제로 잠금화면에 갈 요약과 같은 기준(체크 아이템만 · 잠근 팩 제외 · 미분류 먼저)
  const summaryBag = useMemo(
    () => (user ? buildNativeSummary([bag], user.uid, new Date(), { ...nativeSummaryLockProfile(), lockedBagIds: [] }).bags[0] : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 잠금 설정이 바뀌면 다시
    [bag, user, privacy.lock],
  );
  const packs = (summaryBag?.packs ?? []).filter((p) => p.items.length > 0);

  const [packId, setPackId] = useState<string | null>(null);
  const [style, setStyle] = useState<Style>(loadStyle);
  const [state, setState] = useState<LiveActivityState | null>(null);
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // 열릴 때마다 지금 떠 있는지 확인한다
  const key = open ? bag.id : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key) {
      setPackId(null);
      getLiveActivityState().then(setState);
    }
  }

  const activeHere = !!state?.active && state.bagId === bag.id;
  // 기본은 "전체". 이 가방이 떠 있으면 떠 있는 팩
  const selected = packs.length === 0 ? null : packId ?? (activeHere ? state?.packId : undefined) ?? WHOLE_BAG;

  const preview = useMemo<PreviewData | null>(() => {
    if (!summaryBag || !selected) return null;
    const order = (items: NativeSummaryItem[]) => [...items.filter((i) => !i.checked), ...items.filter((i) => i.checked)];
    if (selected === WHOLE_BAG) {
      const seen = new Set<string>();
      const all = packs.flatMap((p) => p.items).filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
      return { title: summaryBag.name, subtitle: "가방 전체", items: order(all), done: all.filter((i) => i.checked).length, total: all.length };
    }
    const p = packs.find((x) => x.id === selected);
    if (!p) return null;
    return { title: p.name, subtitle: summaryBag.name, items: order(p.items), done: p.items.filter((i) => i.checked).length, total: p.items.length };
  }, [summaryBag, packs, selected]);

  const changeStyle = (next: Partial<Style>) => {
    const merged = { ...style, ...next };
    setStyle(merged);
    try {
      localStorage.setItem(STYLE_KEY, JSON.stringify(merged));
    } catch {}
  };

  const pickColor = async (target: "bg" | "text") => {
    const picked = await pickNativeColor(target === "bg" ? style.bgColor : style.textColor, target === "bg" ? style.bgAlpha : 1);
    if (!picked) {
      show("앱을 최신 버전으로 업데이트하면 색을 자유롭게 고를 수 있어요");
      return;
    }
    if (!isHex(picked.color)) return;
    if (target === "bg") changeStyle({ bgColor: picked.color.toUpperCase(), bgAlpha: clampAlpha(picked.alpha) });
    else changeStyle({ textColor: picked.color.toUpperCase() });
  };

  const start = async () => {
    if (!user || !selected) return;
    setBusy(true);
    try {
      const custom = style.theme === "custom";
      await startLiveActivity(bag, user.uid, {
        packId: selected,
        theme: style.theme,
        font: style.font,
        size: style.size,
        ...(custom ? { bgColor: style.bgColor, bgAlpha: style.bgAlpha } : {}),
        textTone: style.textTone,
        ...(style.textTone === "custom" ? { textColor: style.textColor } : {}),
      });
      show("잠금화면에 띄웠어요");
      onClose();
    } catch (err) {
      show(err instanceof Error && err.message ? err.message : "잠금화면에 띄우지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await endLiveActivity();
      show("잠금화면에서 내렸어요");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const alphaPercent = Math.round(style.bgAlpha * 100);
  const blocked = bagLocked || state?.enabled === false;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="잠금화면에 띄우기"
      size="tall"
      footer={
        <div className="flex flex-col gap-2">
          <Button block disabled={busy || !selected || blocked} onClick={start}>
            {activeHere ? "이 설정으로 다시 띄우기" : "잠금화면에 띄우기"}
          </Button>
          {state?.active && (
            <Button block variant="secondary" disabled={busy} onClick={stop}>
              잠금화면에서 내리기
            </Button>
          )}
        </div>
      }
    >
      {/* 미리 보기: 스크롤해도 맨 위에 붙어 있다. 아래에서 고르는 즉시 바뀐다 */}
      <div className="sticky top-0 z-10 -mx-5 -mt-3 bg-canvas px-5 pt-3 pb-4">
        <LockScreenPreview data={preview} style={style} systemDark={systemDark} />
      </div>

      <div className="flex flex-col gap-6 pt-2">
        {bagLocked && (
          <p className="m-0 rounded-card bg-fill px-4 py-3 text-caption text-sub">잠근 가방은 잠금화면에 띄울 수 없어요. 가방 잠금을 풀면 띄울 수 있어요.</p>
        )}
        {state?.enabled === false && (
          <p className="m-0 rounded-card bg-fill px-4 py-3 text-caption text-sub">
            실시간 현황이 꺼져 있어요. 아이폰 설정 &gt; 팩인백 &gt; 실시간 현황을 켜 주세요.
          </p>
        )}

        <section className="flex flex-col gap-3">
          <SectionHeader>팩</SectionHeader>
          {packs.length > 0 ? (
            <div className="pib-v2-no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              <Chip label="전체" selected={selected === WHOLE_BAG} onClick={() => setPackId(WHOLE_BAG)} />
              {packs.map((p) => (
                <Chip key={p.id} label={p.inbox ? "미분류" : p.name} selected={p.id === selected} onClick={() => setPackId(p.id)} />
              ))}
            </div>
          ) : (
            <p className="m-0 text-caption text-sub">체크 아이템이 있는 팩이 없어요.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>배경</SectionHeader>
          <SegmentedControl label="배경" options={THEMES} value={style.theme} onChange={(theme) => changeStyle({ theme })} />
          {style.theme === "custom" && (
            <div className="flex flex-col gap-4 rounded-card border border-line bg-card p-4">
              <SwatchRow
                swatches={BG_SWATCHES}
                value={style.bgColor}
                onPick={(bgColor) => changeStyle({ bgColor })}
                onMore={() => void pickColor("bg")}
                moreLabel="배경색 더 고르기"
              />
              <label className="flex flex-col gap-2">
                <span className="flex items-center justify-between text-caption text-sub">
                  <span>불투명도</span>
                  <span className="font-semibold text-ink">{alphaPercent}%</span>
                </span>
                <input
                  type="range"
                  min={MIN_ALPHA * 100}
                  max={100}
                  step={5}
                  value={alphaPercent}
                  onChange={(e) => changeStyle({ bgAlpha: clampAlpha(Number(e.target.value) / 100) })}
                  className="w-full accent-brand"
                />
              </label>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader>글자</SectionHeader>
          <div className="flex flex-col gap-2">
            <span className="text-caption text-sub">색</span>
            <SegmentedControl label="글자색" options={TEXT_TONES} value={style.textTone} onChange={(textTone) => changeStyle({ textTone })} />
            {style.textTone === "custom" && (
              <div className="rounded-card border border-line bg-card p-4">
                <SwatchRow
                  swatches={TEXT_SWATCHES}
                  value={style.textColor}
                  onPick={(textColor) => changeStyle({ textColor })}
                  onMore={() => void pickColor("text")}
                  moreLabel="글자색 더 고르기"
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-caption text-sub">글꼴</span>
            <div className="pib-v2-no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {FONTS.map((f) => (
                <Chip key={f.id} label={f.label} selected={style.font === f.id} onClick={() => changeStyle({ font: f.id })} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-caption text-sub">크기</span>
            <SegmentedControl label="글자 크기" options={SIZES} value={style.size} onChange={(size) => changeStyle({ size })} />
          </div>
        </section>

        <p className="m-0 text-micro text-faint">
          잠금화면에서 바로 체크할 수 있어요. iOS 규칙으로 최대 8시간 보이고, 다 챙기면 내려가요. 계속 띄워 두려면 단축어 앱 &gt; 자동화에
          “잠금화면 다시 띄우기”를 하루 세 번(예: 0시 · 8시 · 16시) 걸어 두세요. iOS가 카드 뒤에 바탕을 깔아서 실제로는 불투명도가 조금 덜 비쳐 보일 수 있어요.
        </p>
      </div>
    </Sheet>
  );
}

function SwatchRow({
  swatches,
  value,
  onPick,
  onMore,
  moreLabel,
}: {
  swatches: { hex: string; label: string }[];
  value: string;
  onPick: (hex: string) => void;
  onMore: () => void;
  moreLabel: string;
}) {
  const known = swatches.some((s) => s.hex === value);
  const iconStyle = known ? undefined : { color: isLightHex(value) ? "#17171A" : "#FFFFFF" };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {swatches.map((s) => {
        const on = value === s.hex;
        return (
          <button
            key={s.hex}
            type="button"
            aria-label={s.label}
            aria-pressed={on}
            onClick={() => onPick(s.hex)}
            className={cx(
              "size-9 rounded-full border transition-shadow duration-160 ease-snappy",
              on ? "border-ink ring-2 ring-ink ring-offset-2 ring-offset-card" : "border-line",
            )}
            style={{ backgroundColor: s.hex }}
          />
        );
      })}
      <button
        type="button"
        aria-label={moreLabel}
        onClick={onMore}
        className={cx(
          "flex size-9 items-center justify-center rounded-full border bg-fill text-ink active:bg-line",
          !known ? "border-ink ring-2 ring-ink ring-offset-2 ring-offset-card" : "border-line",
        )}
        style={known ? undefined : { backgroundColor: value }}
      >
        <IconColorPicker size={18} stroke={1.9} aria-hidden="true" style={iconStyle} />
      </button>
    </div>
  );
}
