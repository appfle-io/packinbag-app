"use client";

import { createContext, useContext } from "react";

// 문제였던 것: SlideScreen/SlideUpSheet/Portal 모달을 새로 하나 추가할 때마다 "지금 이게
// 몇 겹째 화면 안에 떠 있는지"를 사람이 직접 세어서 zIndex 숫자를 하드코딩해야 했다.
// 화면 구조가 바뀌거나(A 화면 안에 B 화면, 그 안에 다시 시트 C처럼) 중첩 깊이가 달라지면
// 그 숫자가 금방 안 맞아서 "떴는데 안 보임 / 뒤에 숨음" 버그가 반복됐다.
//
// 해결: SlideScreen이 열릴 때마다 "지금 층수"를 이 컨텍스트에 담아 자식에게 물려준다.
// 그 안에서 열리는 SlideUpSheet 등은 zIndex를 명시하지 않으면 이 컨텍스트 값 + offset을
// 자동으로 써서 "부모보다 항상 위"를 보장받는다. 즉 개발자가 부모의 정확한 zIndex 숫자를
// 몰라도(또는 나중에 부모 숫자가 바뀌어도) 항상 올바르게 그 위에 뜬다.
//
// 기존 화면들(AppShell의 SlideScreen zIndex=60/65/70, SlideUpSheet zIndex=75 등)은 그대로
// 명시적 zIndex를 넘겨서 지금까지의 순서를 그대로 유지한다 - zIndex prop은 항상 이 자동
// 계산보다 우선하는 "수동 오버라이드"로 남아있다. 새로 추가되는(또는 깊이가 가변적인)
// 중첩 오버레이만 zIndex를 생략해서 이 자동 계산의 혜택을 받으면 된다.
export const ROOT_LAYER = 40;
export const LAYER_STEP = 20;
export const SHEET_OFFSET = 10;
export const POPOVER_OFFSET = 30;

const OverlayLayerContext = createContext<number>(ROOT_LAYER);

export const OverlayLayerProvider = OverlayLayerContext.Provider;

export function useOverlayLayer(): number {
  return useContext(OverlayLayerContext);
}
