"use client";

// 체크 완료 비율을 보여주는 작은 도넛형 진행률 표시.
// ratio: 0~1. accentHex를 안주면 현재 accent 색상을 그대로 씀.
export default function ProgressRing({
  ratio,
  size = 22,
  accentHex,
}: {
  ratio: number;
  size?: number;
  accentHex?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  const color = accentHex || "var(--accent)";

  return (
    <div
      className="rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${pct}%, var(--border) 0)`,
      }}
      aria-label={`진행률 ${pct}%`}
    >
      <div
        className="rounded-full"
        style={{
          width: size - 6,
          height: size - 6,
          margin: 3,
          background: "var(--surface)",
        }}
      />
    </div>
  );
}
