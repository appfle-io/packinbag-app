import { useEffect, useRef } from "react";

// 화면 왼쪽 끝 이 정도 픽셀 안에서 시작한 터치만 "엣지 스와이프"로 인정한다
// (본문 아무데서나 오른쪽으로 밀어도 뒤로가기가 되면 스크롤/드래그 등 다른 제스처와 자꾸 부딪히기 때문).
const EDGE_ZONE_PX = 24;
// 이보다 짧게 밀면 실수로 스친 것으로 보고 뒤로가기 처리하지 않는다.
const SWIPE_THRESHOLD_PX = 90;
// 세로로 이만큼 이상 움직이면 스크롤 의도로 보고 추적을 취소한다.
const MAX_VERTICAL_DRIFT_PX = 60;

// iOS의 "화면 왼쪽 끝에서 오른쪽으로 쓸어넘기면 뒤로가기" 제스처를, 실제 페이지 이동이 아니라
// 화면(컴포넌트) 전환으로 동작하는 이 앱의 onBack 콜백에도 동일하게 재현한다.
// Pointer Events 기반이라 iOS/Android 브라우저와 데스크톱 웹 모두 동일하게 동작한다.
export function useSwipeBack<T extends HTMLElement>(onBack: () => void, enabled: boolean = true) {
  const ref = useRef<T | null>(null);
  // 매 렌더마다 최신 콜백을 가리키게만 하고, 리스너 자체는 effect 재실행 없이 유지한다
  // (bag 편집 화면처럼 onBack이 참조하는 상태가 타이핑마다 바뀌는 경우를 위함).
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    let tracking = false;
    let startX = 0;
    let startY = 0;
    let pointerId: number | null = null;

    const handlePointerDown = (e: PointerEvent) => {
      if (pointerId !== null) return; // 멀티터치 중이면 무시
      if (e.clientX > EDGE_ZONE_PX) return; // 왼쪽 끝에서 시작한 터치가 아니면 무시
      tracking = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = Math.abs(e.clientY - startY);
      if (dy > MAX_VERTICAL_DRIFT_PX) {
        tracking = false;
        pointerId = null;
        return;
      }
      if (dx >= SWIPE_THRESHOLD_PX) {
        tracking = false;
        pointerId = null;
        onBackRef.current();
      }
    };

    const stop = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      tracking = false;
      pointerId = null;
    };

    el.addEventListener("pointerdown", handlePointerDown);
    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
    return () => {
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerup", stop);
      el.removeEventListener("pointercancel", stop);
    };
  }, [enabled]);

  return ref;
}
