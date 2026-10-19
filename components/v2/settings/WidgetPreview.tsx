"use client";

// 북마크 위젯(가방 바로가기) 미리 보기(2026-10-18). iOS PackInBagBookmarkWidget과 같은 배치 · 문구.
// 크기는 감싸는 쪽이 정한다(정사각형, 기본 164px = 아이폰 작은 위젯과 비슷)
import type { WidgetStyle } from "@/lib/types";
import { cx } from "@/components/v2/ui";
import { DEFAULT_WIDGET_SHOW, widgetInkColor, widgetMetaLine, type WidgetBagStats } from "@/lib/v2/widgetStyles";

const ROW: Record<string, string> = { t: "justify-start", m: "justify-center", b: "justify-end" };
const COL: Record<string, string> = { l: "items-start text-left", c: "items-center text-center", r: "items-end text-right" };

export function WidgetPreview({
  style,
  stats,
  photoSrc,
  className,
}: {
  // null = 기본(꾸미기 안 고름)
  style: WidgetStyle | null;
  stats: WidgetBagStats;
  // 아직 안 올린 새 사진(blob 주소). 없으면 style.photoUrl
  photoSrc?: string | null;
  className?: string;
}) {
  const bg = style?.bg ?? "plain";
  const show = style?.show ?? DEFAULT_WIDGET_SHOW;
  const pos = style?.pos ?? "bl";
  const ink = style ? widgetInkColor(style) : null;
  const light = ink === "#FFFFFF" || (ink !== null && ink !== "#17171A" && isLight(ink));
  const meta = widgetMetaLine(stats, show);
  const photo = bg === "photo" ? photoSrc ?? style?.photoUrl ?? null : null;
  const dim = (style?.dim ?? 40) / 100;
  const shade = light ? "0, 0, 0" : "255, 255, 255";
  const row = pos[0];
  const ratio = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const many = meta.includes(" · ") || (show.dday && !!stats.dday && show.bar);

  return (
    <div
      className={cx(
        "relative aspect-square shrink-0 overflow-hidden rounded-widget shadow-dock",
        bg === "plain" && "bg-card text-ink",
        bg === "none" && "bg-checker",
        className,
      )}
      // 배경색 · 글자색은 사용자가 고른 값(런타임). 배경 제거는 체크무늬(투명 표시)
      style={
        bg === "plain"
          ? undefined
          : bg === "none"
            ? { color: ink ?? undefined }
            : { background: bg === "solid" ? style?.color : "#333333", color: ink ?? undefined }
      }
      aria-label="위젯 미리 보기"
    >
      {photo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- 자르기 미리 보기(transform)라 next/image를 쓰지 않는다 */}
          <img
            src={photo}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 size-full select-none object-cover"
            // 사용자가 맞춘 크기 · 위치(런타임)
            style={{ transform: `translate(${style?.x ?? 0}%, ${style?.y ?? 0}%) scale(${style?.zoom ?? 1})` }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            // 글자 쪽 어둡게(런타임)
            style={{
              background:
                row === "m"
                  ? `rgba(${shade}, ${dim * 0.7})`
                  : `linear-gradient(to ${row === "b" ? "top" : "bottom"}, rgba(${shade}, ${dim}) 0%, rgba(${shade}, 0) 75%)`,
            }}
          />
        </>
      )}
      <div className={cx("absolute inset-0 flex flex-col gap-1 p-4", ROW[row], COL[pos[1]])}>
        {show.dday && stats.dday && (
          <span
            className={cx(
              "rounded-full border px-2 text-micro font-bold",
              bg === "plain" ? "border-brand-soft bg-brand-soft text-brand" : "border-current",
            )}
          >
            {stats.dday}
          </span>
        )}
        {show.name && (
          <span className={cx("max-w-full overflow-hidden text-body font-bold", many ? "line-clamp-1" : "line-clamp-2")}>{stats.name}</span>
        )}
        {meta && <span className={cx("max-w-full truncate text-micro", bg === "plain" ? "text-sub" : "opacity-90")}>{meta}</span>}
        {show.bar && (
          <span className={cx("mt-1 block h-1 self-stretch overflow-hidden rounded-full", bg === "plain" ? "bg-fill" : light ? "bg-white/30" : "bg-black/10")}>
            <span
              className={cx("block h-1 rounded-full", bg === "plain" ? "bg-brand" : "bg-current")}
              // 챙긴 비율(런타임)
              style={{ width: `${ratio}%` }}
            />
          </span>
        )}
      </div>
    </div>
  );
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.5;
}
