"use client";

// 설정 > 위젯 > 팩 위젯(1.12, 2026-11-01). 팩 위젯은 꾸미기를 홈 화면 위젯 편집에서 하므로, 그 화면을 그림으로 보여 주고 따라 하게 한다.
// 투명 위치는 크기마다 고르는 게 다르다(작게 6칸 · 중간 줄 3개 · 크게 위/아래 두 줄, Swift PIBWallSlot · PIBWallRow · PIBWallHalf).
// 1.11 앱은 "배경화면" · 6칸 하나뿐이라(homeWallpaperState v 없음) 그 앱에서 고를 글자로 바꿔 보여 준다
import { useState } from "react";
import { Button, SegmentedControl, cx } from "@/components/v2/ui";
import type { HomeWallpaperState } from "@/lib/v2/nativeBridge";
import { SubScreen } from "./SubScreen";

type Size = "s" | "m" | "l";
// 그림 속 홈 화면(120 × 261px)에서 위젯 자리. 값은 iOS 26 1206×2622 실측을 줄인 것(lib/v2/wallpaperFit LAYOUTS_26)
type Opt = { label: string; old: string; l: number; t: number; w: number; h: number };

const CELL = 51;
const COL = [6, 63];
const ROW = [27, 84, 140];

const OPTIONS: Record<Size, Opt[]> = {
  s: [
    { label: "위 왼쪽", old: "위 왼쪽", l: COL[0], t: ROW[0], w: CELL, h: CELL },
    { label: "위 오른쪽", old: "위 오른쪽", l: COL[1], t: ROW[0], w: CELL, h: CELL },
    { label: "가운데 왼쪽", old: "가운데 왼쪽", l: COL[0], t: ROW[1], w: CELL, h: CELL },
    { label: "가운데 오른쪽", old: "가운데 오른쪽", l: COL[1], t: ROW[1], w: CELL, h: CELL },
    { label: "아래 왼쪽", old: "아래 왼쪽", l: COL[0], t: ROW[2], w: CELL, h: CELL },
    { label: "아래 오른쪽", old: "아래 오른쪽", l: COL[1], t: ROW[2], w: CELL, h: CELL },
  ],
  m: [
    { label: "위 줄", old: "위 왼쪽", l: COL[0], t: ROW[0], w: COL[1] + CELL - COL[0], h: CELL },
    { label: "가운데 줄", old: "가운데 왼쪽", l: COL[0], t: ROW[1], w: COL[1] + CELL - COL[0], h: CELL },
    { label: "아래 줄", old: "아래 왼쪽", l: COL[0], t: ROW[2], w: COL[1] + CELL - COL[0], h: CELL },
  ],
  l: [
    { label: "위 두 줄", old: "위 왼쪽", l: COL[0], t: ROW[0], w: COL[1] + CELL - COL[0], h: ROW[1] + CELL - ROW[0] },
    { label: "아래 두 줄", old: "가운데 왼쪽", l: COL[0], t: ROW[1], w: COL[1] + CELL - COL[0], h: ROW[2] + CELL - ROW[1] },
  ],
};

const SIZE_OPTIONS: { value: Size; label: string }[] = [
  { value: "s", label: "작게" },
  { value: "m", label: "중간" },
  { value: "l", label: "크게" },
];

const CAPTION: Record<Size, string> = {
  s: "작게는 6칸 중 놓인 칸",
  m: "중간은 놓인 줄",
  l: "크게는 위쪽인지 아래쪽인지",
};

export function PackWidgetGuide({
  onBack,
  state,
  onStartWizard,
}: {
  onBack: () => void;
  state: HomeWallpaperState | null;
  onStartWizard: () => void;
}) {
  const [size, setSize] = useState<Size>("s");
  const [pos, setPos] = useState(0);
  // 1.12 앱부터 위젯 편집이 "투명" · 크기별 목록
  const v2 = (state?.v ?? 0) >= 2;
  const opts = OPTIONS[size];
  const sel = opts[Math.min(pos, opts.length - 1)];
  const bgName = v2 ? "투명" : "배경화면";
  const posName = v2 ? "투명 위치" : "배경화면 위치";
  const pick = v2 ? sel.label : sel.old;

  return (
    <SubScreen title="팩 위젯" onBack={onBack} bodyClassName="gap-5">
      <p className="m-0 text-body text-sub">체크리스트를 보며 위젯에서 바로 체크해요. 꾸미기는 홈 화면에서 위젯을 길게 눌러 해요.</p>

      {state === null && (
        <p className="m-0 rounded-card bg-brand-soft px-4 py-3 text-caption text-ink">팩 위젯 투명은 앱을 최신으로 업데이트하면 쓸 수 있어요.</p>
      )}
      {state && !state.set && (
        <div className="flex items-center justify-between gap-3 rounded-card bg-brand-soft px-4 py-3">
          <span className="text-caption text-ink">투명은 이 아이폰에서 먼저 한 번 맞춰요</span>
          <Button size="sm" variant="secondary" onClick={onStartWizard}>
            맞추기
          </Button>
        </div>
      )}

      {/* 설명 그림: 홈 화면 위젯 편집 */}
      <section className="flex flex-col gap-2 rounded-card bg-brand-soft p-4">
        <span className="text-caption font-semibold text-brand">홈 화면 › 위젯 길게 누르기 › 위젯 편집</span>
        <div className="flex flex-col rounded-card bg-card px-4 py-1" aria-hidden="true">
          <SheetRow name="가방" value="시우 기저귀가방" />
          <SheetRow name="팩" value="가방 전체" />
          <SheetRow name="배경" value={bgName} n={2} />
          <SheetRow name={posName} value={pick} n={3} last />
        </div>
      </section>

      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        <Step n={1}>팩 위젯을 길게 눌러 위젯 편집</Step>
        <Step n={2}>배경을 {bgName}으로</Step>
        <Step n={3}>{posName}는 위젯이 놓인 곳</Step>
      </ol>

      {/* 투명 위치: 크기마다 다름 */}
      <section className="flex flex-col gap-3 rounded-card border border-line bg-card p-4">
        <SegmentedControl
          label="위젯 크기"
          options={SIZE_OPTIONS}
          value={size}
          onChange={(v) => {
            setSize(v);
            setPos(0);
          }}
          className="grid-cols-3"
        />
        <span className="text-caption text-sub">{CAPTION[size]}</span>
        <div className="flex items-start gap-4">
          <div className="pib-tw-wall relative h-50 w-30 shrink-0 overflow-hidden rounded-field" aria-hidden="true">
            {OPTIONS.s.map((c) => (
              <span
                key={c.label}
                className="absolute rounded-field border border-dashed border-white/70"
                // 그림 속 칸 자리(표에서 계산한 값)
                style={{ left: c.l, top: c.t, width: c.w, height: c.h }}
              />
            ))}
            <span
              className="absolute rounded-field border-2 border-white bg-brand/40 transition-all duration-160"
              // 고른 위치(런타임)
              style={{ left: sel.l, top: sel.t, width: sel.w, height: sel.h }}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            {opts.map((o, i) => {
              const on = o === sel;
              return (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPos(i)}
                  className={cx(
                    "h-8 rounded-field px-3 text-left text-caption",
                    on ? "border-2 border-brand bg-brand-soft font-bold text-brand" : "border border-line bg-card text-ink active:bg-fill",
                  )}
                >
                  {v2 ? o.label : o.old}
                </button>
              );
            })}
          </div>
        </div>
        {!v2 && size !== "s" && (
          <span className="text-micro text-faint">
            지금 앱은 칸 이름으로 골라요. 앱을 업데이트하면 {size === "m" ? "줄" : "위 · 아래"}로 고를 수 있어요
          </span>
        )}
      </section>

      <p className="m-0 text-micro text-faint">글꼴 · 글자 크기 · 열 수도 같은 위젯 편집에서 바꿔요. 잠금화면 위젯에는 투명이 없어요.</p>
    </SubScreen>
  );
}

function SheetRow({ name, value, n, last }: { name: string; value: string; n?: number; last?: boolean }) {
  return (
    <span
      className={cx(
        "flex h-9 items-center justify-between text-caption",
        !last && "border-b border-line",
        n ? "-mx-4 bg-brand-soft px-4 font-bold text-brand" : "text-ink",
      )}
    >
      <span className="flex items-center gap-2">
        {n && <span className="flex size-5 items-center justify-center rounded-full bg-brand text-micro text-on-brand">{n}</span>}
        {name}
      </span>
      <span className={n ? undefined : "text-faint"}>{value}</span>
    </span>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-body text-ink">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-micro font-bold text-on-ink">{n}</span>
      {children}
    </li>
  );
}
