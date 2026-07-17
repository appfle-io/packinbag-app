"use client";

// 진행률을 보여주는 작은 캡슐형(가로 바) 표시.
// ratio: 0~1. accentHex를 안주면 현재 accent 색상을 그대로 씀.
// size는 기존 도넛형일 때의 지름값과 같은 자리에 넘겨도 되도록 그대로 두고, 여기서
// 가로/세로 비율로 환산해서 캡슐 크기를 만든다 (콜사이트를 바꿀 필요 없게 하기 위함).
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
  const height = Math.max(6, Math.round(size * 0.42));
  const width = Math.max(24, Math.round(size * 1.8));

  return (
    <div
      className="rounded-full shrink-0 overflow-hidden"
      style={{
        width,
        height,
        background: "var(--border)",
      }}
      aria-label={`진행률 ${pct}%`}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: color,
          transition: "width 150ms ease",
        }}
      />
    </div>
  );
}
