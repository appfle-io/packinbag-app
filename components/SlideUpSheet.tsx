"use client";

import { useEffect, useRef, useState } from "react";
import Portal from "@/components/Portal";

// SlideScreen(좌우 풀스크린)과 같은 문제를 겪는 "아래에서 올라오는 시트" 모달용 래퍼.
// 배경 딤 + 시트 자체가 트랜지션 없이 그냥 나타났다/사라졌다 하던 것을, 아래에서
// 부드럽게 올라오고/내려가도록 만든다. 사용법은 SlideScreen과 동일 - active로만 제어하고,
// active=false가 되어도 내용(children)이 사라지지 않도록 부모가 마지막 값을 캐싱해서 넘겨야 한다.
const TRANSITION_MS = 220;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export default function SlideUpSheet({
  active,
  onBackdropClick,
  children,
  zIndex = 75,
}: {
  active: boolean;
  onBackdropClick?: () => void;
  children: React.ReactNode;
  zIndex?: number;
}) {
  const [shouldRender, setShouldRender] = useState(active);
  const [entered, setEntered] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // active(외부 prop)가 바뀐 순간을 그대로 반영하는 의도된 동기화다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShouldRender(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setShouldRender(false);
    }, TRANSITION_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active]);

  if (!shouldRender) return null;

  return (
    <Portal>
      <div
        className="flex items-end justify-center"
        style={{
          position: "fixed",
          inset: 0,
          zIndex,
          background: "rgba(0,0,0,0.45)",
          opacity: entered ? 1 : 0,
          transition: `opacity ${TRANSITION_MS}ms ${EASING}`,
        }}
        onClick={onBackdropClick}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl md:max-w-4xl rounded-t-2xl bg-background flex flex-col overflow-hidden"
          style={{
            maxHeight: "85vh",
            transform: entered ? "translateY(0%)" : "translateY(100%)",
            transition: `transform ${TRANSITION_MS}ms ${EASING}`,
            willChange: "transform",
          }}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
