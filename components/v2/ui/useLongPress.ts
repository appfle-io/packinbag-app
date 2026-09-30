"use client";

import { useCallback, useRef } from "react";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 8;

// 길게 누르기(터치) + 우클릭(데스크톱)으로 같은 동작을 연다.
// 길게 누른 직후 따라오는 click은 무시해서, 체크가 같이 토글되지 않게 한다.
export function useLongPress(onLongPress: () => void, onClick: () => void) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return; // 마우스는 우클릭(contextmenu)으로
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = null;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [onLongPress],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    if (Math.abs(e.clientX - s.x) > MOVE_TOLERANCE || Math.abs(e.clientY - s.y) > MOVE_TOLERANCE) clear();
  }, []);

  const handleClick = useCallback(() => {
    if (fired.current) {
      fired.current = false;
      return;
    }
    onClick();
  }, [onClick]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onLongPress();
    },
    [onLongPress],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onClick: handleClick,
    onContextMenu,
  };
}