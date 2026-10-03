"use client";

import { createContext } from "react";

// 리디자인 v2: SlideScreen(swipeBack)이 "손가락을 따라오는 뒤로가기"를 직접 처리할 때,
// 그 안의 화면이 useSwipeBack으로 넘긴 뒤로가기 함수를 여기에 등록한다.
// 등록된 화면은 예전 방식(손을 뗀 뒤에 한 번에 닫힘)의 리스너를 달지 않는다.
// SlideScreen이 swipeBack을 쓰지 않으면 null을 내려서, 바깥 SlideScreen의 등록소로 새지 않게 막는다.
export interface SwipeBackRegistry {
  register: (onBack: () => void) => () => void;
}

export const SwipeBackRegistryContext = createContext<SwipeBackRegistry | null>(null);
