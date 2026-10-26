"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { IconButton, cx } from "@/components/v2/ui";
import { EventSlideCard } from "@/components/v2/events/EventScreens";
import type { AppEvent } from "@/lib/events";
import { FeaturedBagCard } from "./BagRows";
import { STATE_LABEL, type BagSummary, type Highlight } from "./homeModel";

const INTERVAL_MS = 5000;
// 멈춤 버튼으로 멈춘 상태는 이 기기에 기억한다(손으로 만져서 잠깐 멈춘 건 기억하지 않음)
const PAUSE_KEY = "packinbag:v2HomeCarouselPaused";

function initialPlaying(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(PAUSE_KEY) === "1") return false;
  } catch {
    // 저장소를 못 쓰면 기본값(재생)
  }
  // 기기 설정 "동작 줄이기"면 처음부터 멈춤
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function eyebrowOf(h: Highlight): string {
  const s = h.summary;
  // "pinned"는 지금 나오지 않는다(고정한 가방은 캐러셀에서 빠짐 - homeModel.buildSections). 예전 값이 오면 그대로 표시만 한다
  if (h.reason === "pinned") return `고정 · ${STATE_LABEL[s.state]}`;
  if (h.reason === "soon") return `곧 D-Day · ${STATE_LABEL[s.state]}`;
  return `지금 싸는 중${s.activityLabel ? ` · ${s.activityLabel}` : ""}`;
}

// 홈 상단 캐러셀: 곧 출발(D-day 7일 이내) → 싸는 중 가방(최대 5장)을 가로로 넘겨 본다.
// 고정한 가방·개인 잠금 가방은 넣지 않는다(고정은 바로 아래 "고정" 구역에 따로 있음). 고르는 규칙은 homeModel.buildSections
// - 폰은 손으로 밀어서, 넓은 화면은 좌우 화살표로. 아래 점을 눌러 바로 이동
// - 5초마다 자동으로 다음 장(마지막 다음은 처음). 손으로 만지면 그 자리에서 멈추고, ▶로 다시 돈다
// - 1장뿐이면 점·버튼·자동 넘김 없이 카드만
// 라이브러리 없이 CSS scroll-snap. 서버 호출 없음.
// 이벤트(2026-10-19, EVT-HOME): 게시 기간 안의 이벤트를 가방 뒤에 이어 붙인다(부르는 쪽이 골라 넘김). 가방이 없어도 이벤트만으로 보인다
export function BagCarousel({
  highlights,
  lockedIds,
  events = [],
  onOpen,
  onMenu,
  onOpenEvent,
}: {
  highlights: Highlight[];
  lockedIds?: Set<string>;
  events?: AppEvent[];
  onOpen: (s: BagSummary) => void;
  onMenu: (s: BagSummary) => void;
  onOpenEvent?: (e: AppEvent) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slides: ({ key: string; bag: Highlight } | { key: string; event: AppEvent })[] = [
    ...highlights.map((h) => ({ key: `b:${h.summary.bag.id}`, bag: h })),
    ...events.map((e) => ({ key: `e:${e.id}`, event: e })),
  ];
  const count = slides.length;
  const [active, setActive] = useState(0);
  const index = Math.min(active, Math.max(0, count - 1));
  const [playing, setPlaying] = useState(initialPlaying);
  // 손으로 만져서 잠깐 멈춤(이 화면에서만)
  const [held, setHeld] = useState(false);
  const running = playing && !held && count > 1;

  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const goTo = useCallback((i: number) => {
    const el = scrollerRef.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    el.scrollTo({ left: child.offsetLeft - pad, behavior: "smooth" });
  }, []);

  // 스크롤 위치로 지금 보이는 장을 정한다(손으로 넘겨도, 자동으로 넘어가도)
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

  // 자동 넘김. 앱이 화면 뒤에 있으면 넘기지 않는다
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      goTo((indexRef.current + 1) % count);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [running, count, goTo]);

  const togglePlay = () => {
    const next = !running;
    setPlaying(next);
    setHeld(false);
    try {
      if (next) window.localStorage.removeItem(PAUSE_KEY);
      else window.localStorage.setItem(PAUSE_KEY, "1");
    } catch {
      // 무시
    }
  };
  const hold = () => setHeld(true);
  const step = (delta: number) => {
    hold();
    goTo((index + delta + count) % count);
  };

  if (count === 0) return null;

  return (
    <section aria-roledescription="carousel" aria-label="눈여겨볼 가방 · 이벤트" data-guide="home-carousel" className="flex flex-col gap-1">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onPointerDown={hold}
        onWheel={hold}
        className="pib-v2-no-scrollbar relative -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5"
      >
        {slides.map((s, i) => (
          <div
            key={s.key}
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}`}
            className="w-full shrink-0 snap-start"
          >
            {"bag" in s ? (
              <FeaturedBagCard
                summary={s.bag.summary}
                eyebrow={eyebrowOf(s.bag)}
                locked={lockedIds?.has(s.bag.summary.bag.id)}
                onOpen={() => onOpen(s.bag.summary)}
                onMenu={() => onMenu(s.bag.summary)}
              />
            ) : (
              <EventSlideCard event={s.event} onOpen={() => onOpenEvent?.(s.event)} />
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="flex items-center justify-between">
          <IconButton label={running ? "자동 넘김 멈추기" : "자동 넘김 켜기"} onClick={togglePlay}>
            {running ? <IconPlayerPause size={18} stroke={1.9} /> : <IconPlayerPlay size={18} stroke={1.9} />}
          </IconButton>

          <div className="flex items-center">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={`${i + 1}번째 ${"bag" in s ? "가방" : "이벤트"} 보기`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => {
                  hold();
                  goTo(i);
                }}
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

          {/* 넓은 화면만 좌우 화살표. 폰은 같은 폭의 빈 칸으로 점을 가운데에 둔다 */}
          <div className="hidden items-center md:flex">
            <IconButton label="이전 가방" onClick={() => step(-1)}>
              <IconChevronLeft size={20} stroke={1.9} />
            </IconButton>
            <IconButton label="다음 가방" onClick={() => step(1)}>
              <IconChevronRight size={20} stroke={1.9} />
            </IconButton>
          </div>
          <span aria-hidden="true" className="size-11 md:hidden" />
        </div>
      )}
    </section>
  );
}
