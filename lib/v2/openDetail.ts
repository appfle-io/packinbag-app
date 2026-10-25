"use client";

import { createContext, useContext } from "react";

// 넓은 화면(목록 | 상세)에서 지금 상세 칸에 열려 있는 가방·팩. 목록이 그 줄을 강조하는 데만 쓴다.
// AppShell이 목록 칸을 이걸로 감싼다(좁은 화면은 상세가 목록을 덮으므로 비워 둔다).
export interface OpenDetail {
  bagId?: string;
  packId?: string;
}

export const OpenDetailContext = createContext<OpenDetail>({});

export function useOpenDetail(): OpenDetail {
  return useContext(OpenDetailContext);
}

// 넓은 화면에서 목록 칸이 여는 겹 화면(설정 하위 화면 등)을 화면 전체가 아니라 상세 칸 안에 띄울 자리.
// WideShell이 설정 탭 목록을 감싸 상세 칸의 요소를 넘기고, SlideScreen이 이 값이 있으면 거기에 그린다.
export const DetailPaneContext = createContext<HTMLElement | null>(null);

// 같은 자리를 상세 칸 쪽(가방 화면 등)에 넘긴다. 이 값이 있으면 넓은 화면이다.
// 여기에 그리는 겹 화면은 `SlideScreen inDetailPane`처럼 스스로 고른다(가방 안 메모, 2026-10-25)
export const DetailSlotContext = createContext<HTMLElement | null>(null);

export function useDetailSlot(): HTMLElement | null {
  return useContext(DetailSlotContext);
}
