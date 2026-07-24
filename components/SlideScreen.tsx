"use client";

import { useEffect, useRef, useState } from "react";
import Portal from "@/components/Portal";
import { useIsDesktop } from "@/lib/useIsDesktop";

// 스택으로 쌓이는 풀스크린 화면(가방 편집기, 팩 트리, 설정 하위화면 등)을 오른쪽에서
// 슬라이드-인/아웃 시키는 공용 래퍼. 기존엔 부모가 `if (editingBag) return <..>` 식으로
// 조건부 렌더링을 해서, 열고 닫을 때 트랜지션 없이 화면이 순간적으로 바뀌었다
// (뒤로가기 버튼을 눌렀을 때도, 엣지 스와이프(useSwipeBack)로 닫을 때도 동일).
//
// 사용법: 부모는 화면을 열고 닫는 boolean 상태(`active`)를 그대로 넘기기만 하면 된다.
// 단, 그 화면이 열려있는 동안 필요한 데이터(예: editingBag)가 `active=false`가 되는
// 순간 함께 null이 되어버리는 경우엔, 부모 쪽에서 "마지막으로 열려있던 값"을 따로
// 캐싱해서 자식에 계속 넘겨줘야 한다 (닫힘 애니메이션 도중에도 내용이 유지되도록).
// AppShell.tsx의 displayedBag/displayedPack 패턴 참고.
const TRANSITION_MS = 250;
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

export default function SlideScreen({
  active,
  children,
  zIndex = 60,
  innerClassName = "flex flex-col h-full w-full mx-auto max-w-3xl md:max-w-4xl bg-background pib-safe-top",
  from = "right",
  onBackdropClick,
  desktopTransition = "slide",
}: {
  active: boolean;
  children: React.ReactNode;
  // 겹치는 다른 오버레이(팩 에디터 시트 z-[75], 스플래시 z-[210] 등)와의 순서를 맞추기 위함.
  zIndex?: number;
  // 화면마다 필요한 레이아웃 클래스(relative 필요 여부 등)가 달라서 오버라이드 가능하게 열어둠.
  innerClassName?: string;
  // 어느 쪽에서 슬라이드-인 되는지. 대부분의 스택 화면(가방편집기, 설정 하위화면 등)은
  // 여는 제스처가 왼→오 스와이프(엣지에서 오른쪽으로) 또는 버튼 탭이라 오른쪽에서 들어오는 게
  // 자연스럽다. 반대로 팩보관함은 여는 제스처 자체가 "왼쪽에서 오른쪽으로" 화면을 당겨서
  // 여는 방향이라, 왼쪽에서 들어와야 방향이 맞는다.
  from?: "right" | "left";
  // 백드롭 클릭 시 닫기 동작이 필요하면만 넘긴다(없으면 순수 시각적 백드롭만).
  onBackdropClick?: () => void;
  // "slide"(기본)는 기존처럼 좌우 방향으로 밀어들어온다/나간다 - 엣지 스와이프나 버튼 탭처럼
  // 좌우 제스처가 있는 화면에 어울린다. "fade"는 PC 웹(useIsDesktop)에서만 사이드 슬라이드 대신
  // 살짝 확대+페이드로 전환한다(터치/모바일에서는 여전히 slide) - 마우스 클릭으로만 열고 닫는
  // 화면(가방 속 메모팩 등)에 쓰면 PC에서 좌우로 밀리는 게 부자연스러운 문제를 해결한다.
  desktopTransition?: "slide" | "fade";
}) {
  const isDesktop = useIsDesktop();
  const useFade = desktopTransition === "fade" && isDesktop;
  // active=false가 되어도 곧바로 사라지지 않고, 닫힘 트랜지션이 끝난 뒤에야 실제로
  // 렌더링을 멈춘다 (그래야 슬라이드 아웃되는 모습이 보인다).
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
      // 마운트되자마자 바로 entered=true를 주면 브라우저가 시작 위치(화면 바깥)를
      // 페인트할 틈이 없어 트랜지션이 재생되지 않는 경우가 있어, 한 프레임 뒤로 미룬다.
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

  const offscreen = from === "left" ? "translateX(-100%)" : "translateX(100%)";

  return (
    <Portal>
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", zIndex }}>
        <div
          aria-hidden
          onClick={onBackdropClick}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            opacity: entered ? 1 : 0,
            transition: `opacity ${TRANSITION_MS}ms ${EASING}`,
            pointerEvents: onBackdropClick ? "auto" : "none",
          }}
        />
        <div
          className={innerClassName}
          style={
            useFade
              ? {
                  transform: entered ? "scale(1)" : "scale(0.97)",
                  opacity: entered ? 1 : 0,
                  transition: `transform ${TRANSITION_MS}ms ${EASING}, opacity ${TRANSITION_MS}ms ${EASING}`,
                  willChange: "transform, opacity",
                }
              : {
                  transform: entered ? "translateX(0%)" : offscreen,
                  transition: `transform ${TRANSITION_MS}ms ${EASING}`,
                  willChange: "transform",
                }
          }
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
