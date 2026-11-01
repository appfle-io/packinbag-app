"use client";

import { IconCheck, IconLock, IconRotateClockwise } from "@tabler/icons-react";
import type { AccentPreset } from "@/lib/types";
import { ACCENTS, DEFAULT_ACCENT } from "@/lib/v2/accent";
import { CheckMark, Sheet, cx } from "@/components/v2/ui";

// 설정 > 화면 > 강조색(SET-DISP-08). 글꼴 시트와 같은 모양: 위에 미리 보기, 아래 줄마다 작은 색 동그라미 + 이름.
// 고르면 바로 앱 전체에 적용되고(미리 보기도 같은 토큰이라 같이 바뀜) 시트는 열린 채로 둔다(바꿔 보며 비교할 수 있게).
export function AccentSheet({
  open,
  onClose,
  value,
  onChange,
  locked = false,
  onLocked,
}: {
  open: boolean;
  onClose: () => void;
  value: AccentPreset;
  onChange: (accent: AccentPreset) => void;
  // 무료면 딥그린만. 나머지는 자물쇠 + 누르면 프리미엄 안내
  locked?: boolean;
  onLocked?: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="강조색">
      {/* 미리 보기: 가방 화면 진행 줄 · 체크 · 버튼을 작게 */}
      <div aria-hidden="true" className="mb-3 flex flex-col gap-3 rounded-card border border-line bg-canvas p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-baseline gap-1">
            <span className="text-title font-bold text-ink">3</span>
            <span className="text-caption text-sub">/ 5</span>
            <span className="ml-1 rounded-full bg-brand-soft px-2 text-caption font-semibold text-brand">싸는 중</span>
          </span>
          <span className="flex items-center gap-1 text-caption font-semibold text-brand">
            <IconRotateClockwise size={16} stroke={1.9} />
            다시 싸기
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full w-3/5 rounded-full bg-brand" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-body text-faint">
            <CheckMark checked />
            기저귀 5장
          </span>
          <span className="flex items-center gap-2 text-body text-ink">
            <CheckMark checked={false} />
            물티슈
          </span>
        </div>
        <span className="self-start rounded-field bg-brand px-3 py-1 text-caption font-semibold text-on-brand">완료함 3</span>
      </div>

      <div role="radiogroup" aria-label="강조색" className="flex flex-col">
        {ACCENTS.map((a, i) => {
          const selected = a.id === value;
          const lockedRow = locked && a.id !== DEFAULT_ACCENT;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={lockedRow || undefined}
              onClick={() => (lockedRow ? onLocked?.() : onChange(a.id))}
              className={cx(
                "flex min-h-12 w-full items-center gap-3 bg-transparent py-2 text-left",
                "transition-colors duration-160 ease-snappy active:bg-fill",
                i < ACCENTS.length - 1 && "border-b border-line",
              )}
            >
              <span aria-hidden="true" className="size-5 shrink-0 rounded-full" style={{ backgroundColor: a.swatch }} />
              <span className={cx("min-w-0 flex-1 truncate text-body text-ink", selected ? "font-bold" : "font-medium")}>
                {a.label}
                {a.id === DEFAULT_ACCENT && <span className="ml-1 font-normal text-faint">기본</span>}
              </span>
              {selected && <IconCheck size={20} stroke={2.2} className="shrink-0 text-brand" aria-hidden="true" />}
              {lockedRow && <IconLock size={18} stroke={1.75} className="shrink-0 text-faint" aria-label="프리미엄" />}
            </button>
          );
        })}
      </div>
      <p className="m-0 pt-3 text-caption text-faint">
        {locked
          ? "무료는 딥그린만 쓸 수 있어요. 다른 색은 프리미엄에서 골라요."
          : "체크 · 진행 막대 · 버튼 색이 앱 전체에서 바뀌어요. 아이폰 위젯 · 잠금화면도 같은 색이에요(앱 1.13부터)."}
      </p>
    </Sheet>
  );
}
