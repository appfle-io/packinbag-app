import { cx } from "./cx";

type Size = "sm" | "md";

export interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: Size;
  tone?: "brand" | "neutral";
  online?: boolean;
  className?: string;
}

const SIZE: Record<Size, string> = {
  sm: "size-7 text-micro",
  md: "size-10 text-body",
};

// 멤버 아바타. 사진이 없으면 이름 첫 글자.
export function Avatar({ name, imageUrl, size = "md", tone = "neutral", online, className }: AvatarProps) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span className={cx("relative inline-flex shrink-0", className)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 이미지(외부 URL), next/image 최적화 대상 아님
        <img src={imageUrl} alt="" className={cx("rounded-full object-cover", SIZE[size])} />
      ) : (
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex items-center justify-center rounded-full font-bold",
            tone === "brand" ? "bg-brand-soft text-brand" : "bg-fill text-sub",
            SIZE[size],
          )}
        >
          {initial}
        </span>
      )}
      <span className="sr-only">{name}</span>
      {online && <span aria-label="접속 중" className="absolute -right-px -bottom-px size-3 rounded-full border-2 border-canvas bg-brand" />}
    </span>
  );
}
