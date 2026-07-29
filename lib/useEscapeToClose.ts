"use client";

import { useEffect, useRef } from "react";

// 데스크톱에서 Esc 키로 지금 뜬 모달/시트/화면을 닫기 위한 공용 훅.
//
// 예전 구현(capture 단계 window 리스너 여러 개)의 실제 버그: 같은 target(window)에 등록된
// 캡처 리스너는 "가장 나중에 등록된 것부터" 실행되는 게 아니라 등록 순서(먼저 등록된 것부터)
// 로 실행된다. 그래서 모달 A 위에 모달 B가 겹쳐 열리면(A가 먼저 마운트) Esc를 눌렀을 때
// B가 아니라 A의 onClose가 먼저(때로는 유일하게) 실행돼서 "엉뚱한 게 닫히거나 아예 안 닫히는"
// 것처럼 보였다.
//
// 이제는 DOM 리스너 순서에 기대지 않고, 지금 열려있는 "닫기" 콜백들을 이 모듈 안의 스택에
// 직접 쌓아둔다 - 실제 window keydown 리스너는 단 하나만 설치하고, Esc가 눌리면 항상 스택의
// 맨 위(가장 나중에 mount된, 즉 가장 위에 떠있는 모달)만 호출한다.
type CloseFn = () => void;
const stack: CloseFn[] = [];
let listenerInstalled = false;

function ensureListenerInstalled() {
  if (listenerInstalled || typeof window === "undefined") return;
  listenerInstalled = true;
  // capture 단계에 단 하나만 등록한다 - 이렇게 해야 메모 편집기(TipTap/ProseMirror)처럼
  // 자체적으로 Esc를 처리하면서 stopPropagation까지 불러주는 내부 요소 안에 포커스가
  // 있을 때도(버블링 단계에서 막혀버릴 수 있다) 우리 리스너가 먼저(이벤트가 window에서
  // target으로 내려가기 전) 반응해서 항상 닫힌다.
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;
      if (stack.length === 0) return;
      const top = stack[stack.length - 1];
      top();
    },
    true
  );
}

// active(기본 true)를 false로 넘기면(예: 조건부로만 열려있는 모달) 스택에 등록하지 않는다.
// onClose는 매 렌더마다 새로 만들어지는 인라인 함수여도 상관없다 - ref로 최신 값만 갈아
// 끼우고, 실제 스택 push/pop은 active/onClose 유무가 바뀔 때만 일어난다(불필요한 재등록 방지).
export function useEscapeToClose(onClose: (() => void) | undefined, active = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active || !onClose) return;
    ensureListenerInstalled();
    const fn: CloseFn = () => onCloseRef.current?.();
    stack.push(fn);
    return () => {
      const idx = stack.lastIndexOf(fn);
      if (idx !== -1) stack.splice(idx, 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, !!onClose]);
}
