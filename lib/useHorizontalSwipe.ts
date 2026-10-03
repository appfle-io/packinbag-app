"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// 손가락을 따라오는 가로 스와이프 공용 훅(리디자인 v2).
// 탭 넘기기(AppShell), 겹쳐 뜬 화면 뒤로가기(SlideScreen), 폴더·보관함 뒤로가기(PageStack)가 같이 쓴다.
//
// - 터치 이벤트로 처리한다. 가로로 판정된 순간부터 touchmove를 막아(preventDefault) 세로 스크롤과 섞이지 않게 한다.
// - 안쪽 요소가 먼저 가져가면(같은 이벤트에 표시) 바깥쪽은 물러난다. 예: 폴더 안에서 오른쪽으로 밀면
//   폴더 뒤로가기가 가져가고, 왼쪽으로 밀면 탭 넘기기가 가져간다.
// - 입력칸·메모 편집 영역에서 시작한 스와이프는 무시한다(글자 선택과 부딪힘). 단 화면 왼쪽 끝에서 시작하면 허용.
// - 가로로 스크롤되는 영역(칩 줄, 캐러셀 등)이 그 방향으로 더 넘어갈 수 있으면 그 영역에 양보한다.
// - 끌기가 끝난 직후 따라오는 click은 막는다(밀다가 손을 뗀 자리의 버튼이 눌리지 않게).

// 이 거리(px)를 넘게 움직여야 가로/세로를 판정한다
const LOCK_PX = 10;
// 가로 이동이 세로 이동의 이 배수보다 커야 가로로 본다
const DIR_RATIO = 1.15;
// 화면 왼쪽 끝 이 폭 안에서 시작하면 "끝에서 밀기"로 본다
export const EDGE_PX = 24;

const TEXT_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [contenteditable=""], [data-swipe-ignore]';

export interface SwipeStart {
  x: number;
  y: number;
  edge: boolean;
}

export interface HorizontalSwipeHandlers {
  // 가로로 판정된 순간 한 번. dir 1 = 손가락이 오른쪽으로, -1 = 왼쪽으로. true면 이 제스처를 가져간다.
  claim: (dir: 1 | -1, start: SwipeStart, el: HTMLElement) => boolean;
  // dx = 판정된 지점부터 움직인 거리(px)
  move: (dx: number, el: HTMLElement) => void;
  // velocity = 손을 떼기 직전 속도(px/ms, 오른쪽이 +)
  end: (dx: number, velocity: number, el: HTMLElement) => void;
}

type MarkedTouchEvent = TouchEvent & { pibSwipeTaken?: boolean };

function blockedByContent(target: EventTarget | null, root: HTMLElement, dir: 1 | -1, edge: boolean): boolean {
  if (!(target instanceof Element)) return false;
  if (!edge && target.closest(TEXT_SELECTOR)) return true;
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const ox = getComputedStyle(el).overflowX;
    if (ox !== "auto" && ox !== "scroll") continue;
    const max = el.scrollWidth - el.clientWidth;
    // 손가락이 오른쪽으로 가면 내용은 앞쪽(왼쪽)으로 넘어가야 한다
    if (dir === 1 ? el.scrollLeft > 1 : el.scrollLeft < max - 1) return true;
  }
  return false;
}

// 반환값은 붙일 요소에 넘기는 ref 콜백이다. enabled가 false면 아무것도 하지 않는다.
export function useHorizontalSwipe<T extends HTMLElement>(handlers: HorizontalSwipeHandlers, enabled = true) {
  const [el, setEl] = useState<T | null>(null);
  const ref = useCallback((node: T | null) => setEl(node), []);

  // 리스너는 다시 달지 않고 매 렌더의 최신 핸들러만 바라보게 한다
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!el || !enabled) return;

    let state: "idle" | "pending" | "drag" | "off" = "idle";
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let edge = false;
    let target: EventTarget | null = null;
    let samples: { x: number; t: number }[] = [];

    const swallowClick = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };
    const suppressNextClick = () => {
      el.addEventListener("click", swallowClick, true);
      window.setTimeout(() => el.removeEventListener("click", swallowClick, true), 350);
    };

    const finishDrag = (x: number, time: number) => {
      const dx = x - originX;
      const recent = samples.filter((s) => time - s.t <= 100);
      const first = recent[0] ?? samples[0];
      const velocity = first && time > first.t ? (x - first.x) / (time - first.t) : 0;
      state = "off";
      samples = [];
      suppressNextClick();
      handlersRef.current.end(dx, velocity, el);
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        // 두 손가락이 닿으면 지금 끌던 것은 제자리로
        if (state === "drag") handlersRef.current.end(0, 0, el);
        state = "off";
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      edge = startX <= EDGE_PX;
      target = e.target;
      samples = [];
      state = "pending";
    };

    const onMove = (e: TouchEvent) => {
      const ev = e as MarkedTouchEvent;
      const t = e.touches[0];
      if (!t) return;
      if (state === "pending") {
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
        if (ev.pibSwipeTaken || Math.abs(dx) < Math.abs(dy) * DIR_RATIO) {
          state = "off";
          return;
        }
        const dir: 1 | -1 = dx > 0 ? 1 : -1;
        if (blockedByContent(target, el, dir, edge) || !handlersRef.current.claim(dir, { x: startX, y: startY, edge }, el)) {
          state = "off";
          return;
        }
        state = "drag";
        originX = t.clientX;
      }
      if (state !== "drag") return;
      ev.pibSwipeTaken = true;
      if (e.cancelable) e.preventDefault();
      samples.push({ x: t.clientX, t: e.timeStamp });
      if (samples.length > 8) samples.shift();
      handlersRef.current.move(t.clientX - originX, el);
    };

    const onEnd = (e: TouchEvent) => {
      if (state === "drag") {
        const t = e.changedTouches[0];
        finishDrag(t ? t.clientX : originX, e.timeStamp);
      }
      if (e.touches.length === 0) state = "idle";
    };

    const onCancel = () => {
      if (state === "drag") handlersRef.current.end(0, 0, el);
      state = "idle";
      samples = [];
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      el.removeEventListener("click", swallowClick, true);
    };
  }, [el, enabled]);

  return ref;
}

// 손을 뗀 속도에 맞춰 남은 거리를 마저 가는 시간(ms). 감속 곡선(EASE_OUT)의 처음 기울기 ≈ 4.5
export function settleDuration(remaining: number, velocity: number, min: number, max: number): number {
  const v = Math.max(Math.abs(velocity), 0.5);
  return Math.round(Math.min(max, Math.max(min, (4.5 * Math.abs(remaining)) / v)));
}

export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

// 끝까지 넘길지: 30% 넘게 끌었거나, 그 방향으로 빠르게 튕겼으면
export function shouldCommit(dx: number, velocity: number, width: number): boolean {
  if (dx === 0) return false;
  const sameDir = Math.sign(velocity) === Math.sign(dx);
  if (!sameDir && Math.abs(velocity) > 0.2) return false;
  return Math.abs(dx) > width * 0.3 || (sameDir && Math.abs(velocity) > 0.35 && Math.abs(dx) > 16);
}
