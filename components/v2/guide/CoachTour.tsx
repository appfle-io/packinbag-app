"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Portal from "@/components/Portal";
import { POPOVER_OFFSET, useOverlayLayer } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import type { TourStep } from "@/lib/v2/guide";
import { Button } from "@/components/v2/ui";

// 강조 박스 여백·모서리, 화면 끝 여유, 강조 박스 최대 높이(화면 대비), 카드와의 간격
const PAD = 6;
const RADIUS = 14;
const EDGE = 8;
const MAX_HOLE_RATIO = 0.45;
const GAP = 12;

interface Hole {
  x: number;
  y: number;
  w: number;
  h: number;
  // 길게 누르기 원을 그릴 위치(없으면 그리지 않음)
  press?: { x: number; y: number };
}

function findTarget(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-guide="${id}"]`);
}

function isShown(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  const x2 = x + w;
  const y2 = y + h;
  return `M${x + rr} ${y}H${x2 - rr}A${rr} ${rr} 0 0 1 ${x2} ${y + rr}V${y2 - rr}A${rr} ${rr} 0 0 1 ${x2 - rr} ${y2}H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y2 - rr}V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`;
}

// 코치마크 투어: 화면을 어둡게 덮고 대상(data-guide)만 밝게 비춘 뒤, 반대쪽에 설명 카드를 띄운다.
// - 대상이 없거나 숨겨져 있으면 그 단계는 건너뛴다(열 때 한 번 정한다)
// - 대상이 화면 밖이면 스크롤해서 가져온다. 스크롤·회전·창 크기 변화에 맞춰 다시 잰다
// - 투어 중에는 아래 화면을 누를 수 없다(실수로 시트가 열리는 것 방지). Esc·건너뛰기로 닫는다
export function CoachTour({ open, steps, onClose }: { open: boolean; steps: TourStep[]; onClose: () => void }) {
  const layer = useOverlayLayer();
  const zIndex = layer + POPOVER_OFFSET;
  useEscapeToClose(onClose, open);

  const [active, setActive] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const nextRef = useRef<HTMLButtonElement>(null);

  // 열릴 때 지금 화면에 실제로 보이는 단계만 고른다
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 닫힐 때 초기화
      setActive([]);
      setHole(null);
      return;
    }
    const shown = steps.filter((s) => isShown(findTarget(s.target)));
    if (shown.length === 0) {
      onClose();
      return;
    }
    setActive(shown);
    setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열리는 순간에만 고른다
  }, [open]);

  const step = active[index];

  const measure = useCallback(() => {
    if (!step) return;
    const el = findTarget(step.target);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setViewport({ w: vw, h: vh });
    if (!isShown(el)) {
      setHole(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const x = Math.max(EDGE, r.left - PAD);
    const y = Math.max(EDGE, r.top - PAD);
    const right = Math.min(vw - EDGE, r.right + PAD);
    const bottom = Math.min(vh - EDGE, r.bottom + PAD, y + vh * MAX_HOLE_RATIO);
    let press: Hole["press"];
    if (step.gesture === "press") {
      const first = el.querySelector<HTMLElement>("[data-item-id]") ?? el;
      const fr = first.getBoundingClientRect();
      const py = fr.top + Math.min(fr.height, 48) / 2;
      if (py > y && py < bottom) press = { x: fr.left + 28, y: py };
    }
    setHole({ x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y), press });
  }, [step]);

  // 단계가 바뀌면 대상을 화면 안으로 가져오고 잰다
  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = findTarget(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.top < EDGE || r.bottom > vh - EDGE) {
        el.scrollIntoView({ block: r.height > vh * MAX_HOLE_RATIO ? "start" : "center", behavior: "smooth" });
      }
    }
    const raf = requestAnimationFrame(measure);
    // 부드러운 스크롤이 끝난 뒤 한 번 더
    const t = window.setTimeout(measure, 400);
    nextRef.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [open, step, measure]);

  // 스크롤(안쪽 스크롤 영역 포함)·창 크기 변화에 맞춰 다시 잰다
  useEffect(() => {
    if (!open || !step) return;
    let raf = 0;
    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
    };
  }, [open, step, measure]);

  if (!open || !step) return null;

  const last = index === active.length - 1;
  const next = () => (last ? onClose() : setIndex((i) => i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  // 강조 박스가 화면 위쪽이면 카드는 아래, 아래쪽이면 위에
  const holeCenter = hole ? hole.y + hole.h / 2 : viewport.h / 2;
  const cardBelow = holeCenter < viewport.h / 2;
  const cardPos = hole
    ? cardBelow
      ? { top: hole.y + hole.h + GAP }
      : { bottom: viewport.h - hole.y + GAP }
    : { top: viewport.h / 3 };

  const outer = `M0 0H${viewport.w}V${viewport.h}H0Z`;
  const path = hole ? `${outer}${roundedRectPath(hole.x, hole.y, hole.w, hole.h, RADIUS)}` : outer;

  return (
    <Portal>
      <div className="pib-v2 fixed inset-0" style={{ zIndex }} role="dialog" aria-modal="true" aria-label="사용 가이드">
        <svg className="absolute inset-0 size-full" aria-hidden="true">
          <path d={path} fillRule="evenodd" className="fill-scrim" />
          {hole && (
            <rect
              x={hole.x}
              y={hole.y}
              width={hole.w}
              height={hole.h}
              rx={Math.min(RADIUS, hole.w / 2, hole.h / 2)}
              className="fill-none stroke-brand"
              strokeWidth={2}
            />
          )}
        </svg>

        {/* 길게 누르기: 퍼지는 원 */}
        {hole?.press && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: hole.press.x, top: hole.press.y }}
          >
            <span className="absolute size-10 rounded-full border-2 border-brand motion-safe:animate-ping" />
            <span className="size-5 rounded-full bg-brand opacity-60" />
          </span>
        )}

        <div
          className="absolute inset-x-4 mx-auto flex max-w-sm flex-col gap-3 rounded-card bg-canvas p-5 text-ink shadow-sheet"
          style={cardPos}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 text-body-lg font-bold">{step.title}</h2>
            <span className="shrink-0 text-caption text-faint" aria-live="polite">
              {index + 1} / {active.length}
            </span>
          </div>
          <p className="m-0 text-body text-sub">{step.body}</p>
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={onClose} className="h-11 bg-transparent pr-3 text-body text-sub active:opacity-60">
              {last ? "닫기" : "건너뛰기"}
            </button>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <Button variant="secondary" size="sm" onClick={prev}>
                  이전
                </Button>
              )}
              <Button ref={nextRef} size="sm" onClick={next}>
                {last ? "시작하기" : "다음"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
