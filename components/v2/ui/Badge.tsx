import { cx } from "./cx";

type Tone = "neutral" | "brand" | "solid";

const TONE: Record<Tone, string> = {
  neutral: "bg-fill text-sub",
  brand: "bg-brand-soft text-brand",
  solid: "bg-brand text-on-brand",
};

// 반복 / D-3 / 가방에 있음 / 담당자 이름 같은 짧은 라벨.
export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cx("inline-flex h-5 shrink-0 items-center rounded-field px-2 text-micro font-semibold", TONE[tone], className)}>
      {children}
    </span>
  );
}
