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
//
// Android 하드웨어 뒤로 가기(2026-10-22, AND-BASE-06)도 같은 스택을 쓴다. Esc로 닫히는 것은 뒤로 가기로도 닫히고,
// Esc는 없지만 뒤로 가기는 있는 화면(swipeBack SlideScreen)은 useHardwareBack으로 escape=false 칸을 쌓는다.
// Esc는 escape 칸 중 맨 위, 뒤로 가기는 종류와 상관없이 맨 위를 부른다(lib/v2/androidBack.ts)
// run이 false를 돌려주면 "지금은 내 차례가 아님"(예: 안 보이는 탭의 PageStack) → 뒤로 가기는 그 아래 칸으로
type CloseFn = () => boolean | void;
type Entry = { run: CloseFn; escape: boolean };
const stack: Entry[] = [];
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
      for (let i = stack.length - 1; i >= 0; i--) {
        if (!stack[i].escape) continue;
        stack[i].run();
        return;
      }
    },
    true
  );
}

// 하드웨어 뒤로 가기: 맨 위에 떠 있는 것을 닫았으면 true, 닫을 것이 없으면 false
export function closeTopLayer(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].run() !== false) return true;
  }
  return false;
}

function useLayer(onClose: CloseFn | undefined, active: boolean, escape: boolean) {
  const onCloseRef = useRef(onClose);
  // 렌더 중에 ref를 바꾸지 않도록 effect에서 최신 값으로 갈아 끼운다(Esc는 커밋 뒤에만 눌린다)
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!active || !onClose) return;
    if (escape) ensureListenerInstalled();
    const entry: Entry = { run: () => onCloseRef.current?.(), escape };
    stack.push(entry);
    return () => {
      const idx = stack.lastIndexOf(entry);
      if (idx !== -1) stack.splice(idx, 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, !!onClose, escape]);
}

// active(기본 true)를 false로 넘기면(예: 조건부로만 열려있는 모달) 스택에 등록하지 않는다.
// onClose는 매 렌더마다 새로 만들어지는 인라인 함수여도 상관없다 - ref로 최신 값만 갈아
// 끼우고, 실제 스택 push/pop은 active/onClose 유무가 바뀔 때만 일어난다(불필요한 재등록 방지).
export function useEscapeToClose(onClose: (() => void) | undefined, active = true) {
  useLayer(onClose, active, true);
}

// Esc로는 닫지 않고 Android 뒤로 가기로만 닫는 층(swipeBack SlideScreen)
export function useHardwareBack(onBack: CloseFn | undefined, active = true) {
  useLayer(onBack, active, false);
}
