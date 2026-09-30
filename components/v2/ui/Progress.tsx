import { cx } from "./cx";

function clamp01(v: number) {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

// 가로 진행률 막대(가방 상단). value: 0~1
export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = clamp01(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cx("h-1 w-full overflow-hidden rounded-full bg-line", className)}
    >
      <div className="h-full rounded-full bg-brand transition-[width] duration-240 ease-snappy" style={{ width: `${v * 100}%` }} />
    </div>
  );
}

// 원형 진행률(가방 목록 줄). size 36 고정.
export function ProgressRing({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = clamp01(value);
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 36 36"
      role="img"
      aria-label={`${label} ${Math.round(v * 100)}%`}
      className={cx("size-9 shrink-0 -rotate-90", className)}
    >
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-line" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-brand transition-[stroke-dashoffset] duration-240 ease-snappy"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
      />
    </svg>
  );
}
