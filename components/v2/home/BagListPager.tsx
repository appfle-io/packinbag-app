"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/v2/ui";
import type { BagSummary } from "./homeModel";

// 한 장에 보여줄 가방 수
const BAG_PAGE_SIZE = 5;
// 장이 이보다 많으면 점 대신 "3 / 12"로 보여준다
const MAX_DOTS = 7;

// 홈 "가방" 목록을 5개씩 한 장으로 묶어 옆으로 넘겨 본다.
// - 손으로 밀면 한 번에 한 장씩(scroll-snap). 아래 점을 누르면 그 장으로
// - 한 장뿐이면 그냥 목록(점 없음)
// - 마지막 장에서 더 왼쪽으로 밀면(첫 장에서 오른쪽으로 밀면) 탭 넘기기로 이어진다(useHorizontalSwipe가 양보받음)
// 라이브러리 없이 CSS scroll-snap. 서버 호출 없음.
export function BagListPager({
  items,
  renderRow,
}: {
  items: BagSummary[];
  renderRow: (summary: BagSummary, last: boolean) => React.ReactNode;
}) {
  const pages: BagSummary[][] = [];
  for (let i = 0; i < items.length; i += BAG_PAGE_SIZE) pages.push(items.slice(i, i + BAG_PAGE_SIZE));
  const count = pages.length;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const index = Math.min(active, Math.max(0, count - 1));

  const rafRef = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
      let best = 0;
      let bestDist = Infinity;
      Array.from(el.children).forEach((c, i) => {
        const d = Math.abs((c as HTMLElement).offsetLeft - pad - el.scrollLeft);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      setActive(best);
    });
  };
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    el.scrollTo({ left: child.offsetLeft - pad, behavior: "smooth" });
  };

  if (count <= 1) {
    return <div className="flex flex-col">{items.map((s, i) => renderRow(s, i === items.length - 1))}</div>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        aria-roledescription="carousel"
        className="pib-v2-no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto overscroll-x-contain px-5"
      >
        {pages.map((page, p) => (
          <div
            key={p}
            role="group"
            aria-roledescription="slide"
            aria-label={`${p + 1} / ${count}`}
            className="flex w-full shrink-0 snap-start snap-always flex-col"
          >
            {page.map((s, i) => renderRow(s, i === page.length - 1))}
          </div>
        ))}
      </div>

      {count <= MAX_DOTS ? (
        <div className="flex items-center justify-center">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}번째 장 보기`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => goTo(i)}
              className="flex h-11 w-5 items-center justify-center bg-transparent"
            >
              <span
                className={cx(
                  "h-2 rounded-full transition-all duration-200 ease-snappy",
                  i === index ? "w-4 bg-ink" : "w-2 bg-line-strong",
                )}
              />
            </button>
          ))}
        </div>
      ) : (
        <p className="m-0 flex h-11 items-center justify-center text-caption text-sub" aria-live="polite">
          {index + 1} / {count}
        </p>
      )}
    </div>
  );
}
