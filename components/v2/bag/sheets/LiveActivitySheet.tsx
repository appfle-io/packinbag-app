"use client";

import { useState } from "react";
import { IconColorPicker } from "@tabler/icons-react";
import type { Bag } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, Chip, SectionHeader, Sheet, cx } from "@/components/v2/ui";
import {
  endLiveActivity,
  getLiveActivityState,
  pickNativeColor,
  startLiveActivity,
  type LiveActivityFont,
  type LiveActivitySize,
  type LiveActivityState,
  type LiveActivityTheme,
} from "@/lib/v2/nativeBridge";

// 가방 더보기 > 잠금화면에 띄우기(iOS 실시간 현황, 2026-10-10). 팩 하나(또는 가방 전체)를 잠금화면 · 다이내믹 아일랜드에 띄우고 거기서 바로 체크한다.
// 최대 8시간(iOS 규칙), 다 챙기면 자동으로 내려간다. 꾸미기(배경 · 글꼴 · 글자 크기)는 이 기기에 기억한다.
// 10/11: 팩 맨 앞 "전체"(packId "*"), 배경 "직접"(색 + 불투명도). 색은 iOS 기본 색 고르기 창(격자 · 스펙트럼 · 슬라이더)
const STYLE_KEY = "pib_live_activity_style";
const WHOLE_BAG = "*";
const THEMES: { id: LiveActivityTheme; label: string }[] = [
  { id: "system", label: "시스템" },
  { id: "light", label: "라이트" },
  { id: "dark", label: "다크" },
  { id: "custom", label: "직접" },
];
const FONTS: { id: LiveActivityFont; label: string }[] = [
  { id: "system", label: "기본" },
  { id: "pretendard", label: "프리텐다드" },
  { id: "gmarket", label: "지마켓 산스" },
  { id: "gaegu", label: "개구" },
  { id: "d2coding", label: "D2코딩" },
];
const SIZES: { id: LiveActivitySize; label: string }[] = [
  { id: "small", label: "작게" },
  { id: "medium", label: "보통" },
  { id: "large", label: "크게" },
];
// 바로 고르는 색(그 밖은 색 고르기 창에서)
const SWATCHES: { hex: string; label: string }[] = [
  { hex: "#2E5E4E", label: "딥그린" },
  { hex: "#17171A", label: "블랙" },
  { hex: "#FFFFFF", label: "화이트" },
  { hex: "#ECF1EE", label: "민트 그레이" },
  { hex: "#1E3A5F", label: "네이비" },
  { hex: "#6B4E9B", label: "퍼플" },
  { hex: "#C65A3A", label: "테라코타" },
  { hex: "#E8B931", label: "머스터드" },
];
const MIN_ALPHA = 0.2;

type Style = {
  theme: LiveActivityTheme;
  font: LiveActivityFont;
  size: LiveActivitySize;
  bgColor: string;
  bgAlpha: number;
};
const DEFAULT_STYLE: Style = { theme: "system", font: "system", size: "medium", bgColor: "#2E5E4E", bgAlpha: 1 };

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);
const clampAlpha = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(MIN_ALPHA, v)) : 1);

// 밝은 색이면 글자를 진하게(잠금화면 PIBCustomColor와 같은 기준)
function isLightHex(hex: string): boolean {
  const v = parseInt(hex.slice(1), 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.6;
}

function hexToRgba(hex: string, alpha: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${alpha})`;
}

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
      };
    }
  } catch {}
  return DEFAULT_STYLE;
}

export function LiveActivitySheet({ open, onClose, bag }: { open: boolean; onClose: () => void; bag: Bag }) {
  const { user } = useAuth();
  const { show } = useToast();
  const packs = bag.packs.filter(
    (p) => p.kind !== "editor" && p.type !== "folder" && p.items.some((i) => i.type !== "text"),
  );
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

  const changeStyle = (next: Partial<Style>) => {
    const merged = { ...style, ...next };
    setStyle(merged);
    try {
      localStorage.setItem(STYLE_KEY, JSON.stringify(merged));
    } catch {}
  };

  const openPicker = async () => {
    const picked = await pickNativeColor(style.bgColor, style.bgAlpha);
    if (!picked) {
      show("앱을 최신 버전으로 업데이트하면 색을 자유롭게 고를 수 있어요");
      return;
    }
    if (isHex(picked.color)) changeStyle({ bgColor: picked.color.toUpperCase(), bgAlpha: clampAlpha(picked.alpha) });
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
  const previewLight = isLightHex(style.bgColor);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="잠금화면에 띄우기"
      footer={
        <div className="flex flex-col gap-2">
          <Button block disabled={busy || !selected || state?.enabled === false} onClick={start}>
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
      <div className="flex flex-col gap-6">
        {state?.enabled === false && (
          <p className="m-0 rounded-card bg-fill px-4 py-3 text-caption text-sub">
            실시간 현황이 꺼져 있어요. 아이폰 설정 &gt; 팩인백 &gt; 실시간 현황을 켜 주세요.
          </p>
        )}

        <section className="flex flex-col gap-3">
          <SectionHeader>팩</SectionHeader>
          {packs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Chip label="전체" selected={selected === WHOLE_BAG} onClick={() => setPackId(WHOLE_BAG)} />
              {packs.map((p) => (
                <Chip key={p.id} label={p.name} selected={p.id === selected} onClick={() => setPackId(p.id)} />
              ))}
            </div>
          ) : (
            <p className="m-0 text-caption text-sub">체크 아이템이 있는 팩이 없어요.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>배경</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <Chip key={t.id} label={t.label} selected={style.theme === t.id} onClick={() => changeStyle({ theme: t.id })} />
            ))}
          </div>

          {style.theme === "custom" && (
            <div className="flex flex-col gap-4 rounded-card border border-line bg-card p-4">
              {/* 미리 보기: 왼쪽 밝은 바탕 · 오른쪽 어두운 바탕 위에 고른 색 · 불투명도(잠금화면 배경이 비치는 정도) */}
              <div className="relative overflow-hidden rounded-card">
                <div aria-hidden="true" className="absolute inset-0 flex">
                  <div className="flex-1 bg-fill" />
                  <div className="flex-1 bg-ink" />
                </div>
                {/* 화면 모드(다크)와 상관없이 고른 색의 밝기로 글자색을 정한다(잠금화면과 같은 규칙) */}
                <div
                  className="relative flex flex-col gap-1 px-4 py-3"
                  style={{ backgroundColor: hexToRgba(style.bgColor, style.bgAlpha), color: previewLight ? "#17171A" : "#FFFFFF" }}
                >
                  <span className="text-caption font-semibold">{bag.name}</span>
                  <span className="text-micro opacity-75">잠금화면에서 이렇게 보여요</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((s) => {
                  const on = style.bgColor === s.hex;
                  return (
                    <button
                      key={s.hex}
                      type="button"
                      aria-label={s.label}
                      aria-pressed={on}
                      onClick={() => changeStyle({ bgColor: s.hex })}
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
                  aria-label="색 더 고르기"
                  onClick={openPicker}
                  className="flex size-9 items-center justify-center rounded-full border border-line bg-fill text-ink active:bg-line"
                >
                  <IconColorPicker size={18} stroke={1.9} aria-hidden="true" />
                </button>
              </div>

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
              <p className="m-0 text-micro text-faint">
                iOS가 잠금화면 카드 뒤에 자기 바탕을 깔아서, 불투명도를 낮춰도 덜 비쳐 보일 수 있어요.
              </p>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>글꼴</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {FONTS.map((f) => (
              <Chip key={f.id} label={f.label} selected={style.font === f.id} onClick={() => changeStyle({ font: f.id })} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>글자 크기</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <Chip key={s.id} label={s.label} selected={style.size === s.id} onClick={() => changeStyle({ size: s.id })} />
            ))}
          </div>
        </section>

        <p className="m-0 text-micro text-faint">
          잠금화면에서 바로 체크할 수 있어요. iOS 규칙으로 최대 8시간 동안 보이고, 다 챙기면 내려가요. 계속 띄워 두려면 단축어 앱 &gt; 자동화에
          “잠금화면 다시 띄우기”를 하루 세 번(예: 0시 · 8시 · 16시) 걸어 두세요.
        </p>
      </div>
    </Sheet>
  );
}
