"use client";

import { useRef, useState } from "react";

// 이미지 라이트박스 / PDF 미리보기에서 공통으로 쓰는 확대/축소 + 드래그(팬) 로직.
// - 두 손가락 핀치로 확대/축소
// - 더블탭(더블클릭)으로 기본배율<->확대배율 토글
// - 마우스 휠(트랙패드 핀치 포함)로 확대/축소
// - 확대된 상태에서 한 손가락/마우스 드래그로 이동
// 실제 시각 요소에는 이 훅이 돌려주는 transform(translate+scale)만 그대로 적용하면 된다.
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const WHEEL_SENSITIVITY = 0.01;

export function useZoomPan() {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [interacting, setInteracting] = useState(false);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastDistRef = useRef<number | null>(null);
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTapRef = useRef(0);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const reset = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setInteracting(true);
    if (pointers.current.size === 1) {
      panStartRef.current = { x: e.clientX, y: e.clientY, tx, ty };
    } else if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      lastDistRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastDistRef.current) {
        const ratio = dist / lastDistRef.current;
        setScale((s) => clampScale(s * ratio));
      }
      lastDistRef.current = dist;
      return;
    }

    if (pointers.current.size === 1 && scale > 1 && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTx(panStartRef.current.tx + dx);
      setTy(panStartRef.current.ty + dy);
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    lastDistRef.current = null;
    if (pointers.current.size === 0) {
      panStartRef.current = null;
      setInteracting(false);
      if (scale <= 1.02) reset();
    }
  };

  const toggleZoom = () => {
    if (scale > 1) reset();
    else setScale(DOUBLE_TAP_SCALE);
  };

  const onDoubleClick = () => toggleZoom();

  // 터치 환경에서는 dblclick이 잘 안 잡히는 경우가 있어, pointerup 시점의 탭 간격으로도 감지한다.
  const handleTapForDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      toggleZoom();
    }
    lastTapRef.current = now;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasSinglePointer = pointers.current.size === 1;
    const start = panStartRef.current;
    const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) : 0;
    endPointer(e);
    // 핀치(두 손가락)가 아니었고, 거의 움직이지 않았으면(드래그가 아니라 탭) 더블탭 판정을 이어간다.
    if (wasSinglePointer && moved < 10) {
      handleTapForDoubleTap();
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * WHEEL_SENSITIVITY;
    setScale((s) => {
      const next = clampScale(s + delta);
      if (next <= 1) {
        setTx(0);
        setTy(0);
      }
      return next;
    });
  };

  const zoomIn = () => setScale((s) => clampScale(s + 0.5));
  const zoomOut = () =>
    setScale((s) => {
      const next = clampScale(s - 0.5);
      if (next <= 1) {
        setTx(0);
        setTy(0);
      }
      return next;
    });

  return {
    scale,
    tx,
    ty,
    interacting,
    reset,
    zoomIn,
    zoomOut,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onDoubleClick,
      onWheel,
    },
  };
}
