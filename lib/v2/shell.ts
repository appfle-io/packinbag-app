"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

// 하단 탭(팩 · 가방 · 설정)
export type TabKey = "home" | "packs" | "settings";

// 셸(단축키·레일)이 탭 화면 안쪽 동작(검색 열기, 새로 만들기)을 부르는 통로.
// 화면 상태(검색창 열림 등)는 각 화면이 갖고 있으므로, 셸은 window 이벤트로 "지금 탭에서 이걸 해 줘"만 보낸다.
export type ShellCommand = "search" | "new";
const EVENT = "pib:shell-command";

export function sendShellCommand(tab: TabKey, command: ShellCommand) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { tab, command } }));
}

// 화면 쪽: 자기 탭으로 온 명령만 받는다. 핸들러는 매 렌더 최신 것을 쓴다(리스너는 한 번만 단다)
export function useShellCommands(tab: TabKey, handlers: Partial<Record<ShellCommand, () => void>>) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    const onCommand = (e: Event) => {
      const d = (e as CustomEvent<{ tab: TabKey; command: ShellCommand }>).detail;
      if (d?.tab === tab) ref.current[d.command]?.();
    };
    window.addEventListener(EVENT, onCommand);
    return () => window.removeEventListener(EVENT, onCommand);
  }, [tab]);
}

// 알림 시트의 문의 답변 알림 → 설정 > 문의하기 그 문의(2026-10-27, shell.md SHELL-NOTI-03).
// AppShell이 설정 탭으로 바꾸고, 설정 화면이 받아서 연다. 설정 화면이 아직 안 그려졌으면 그려질 때 남은 요청을 가져간다
const OPEN_INQUIRY_EVENT = "pib:open-inquiry";
let pendingInquiry: { id: string | null } | null = null;

export function requestOpenInquiry(inquiryId: string | null) {
  pendingInquiry = { id: inquiryId };
  window.dispatchEvent(new CustomEvent(OPEN_INQUIRY_EVENT));
}

// 요청이 왔다는 것만 듣는다(탭 바꾸기용, 요청은 남겨 둔다)
export function useOpenInquiryListener(onRequest: () => void) {
  const ref = useRef(onRequest);
  useEffect(() => {
    ref.current = onRequest;
  });
  useEffect(() => {
    const on = () => ref.current();
    window.addEventListener(OPEN_INQUIRY_EVENT, on);
    return () => window.removeEventListener(OPEN_INQUIRY_EVENT, on);
  }, []);
}

// 요청을 받아 처리한다(그려질 때 남은 요청 + 그 뒤에 오는 요청)
export function useOpenInquiryRequests(onOpen: (inquiryId: string | null) => void) {
  const ref = useRef(onOpen);
  useEffect(() => {
    ref.current = onOpen;
  });
  useEffect(() => {
    const take = () => {
      if (!pendingInquiry) return;
      const { id } = pendingInquiry;
      pendingInquiry = null;
      ref.current(id);
    };
    take();
    window.addEventListener(OPEN_INQUIRY_EVENT, take);
    return () => window.removeEventListener(OPEN_INQUIRY_EVENT, take);
  }, []);
}

// 미디어 쿼리 구독(서버 렌더 때는 false). useSyncExternalStore라 첫 화면 깜빡임이 없다
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// 화면 폭 기준(셸 통합 2026-10-03): 900px 이상은 목록+상세 2단, 1200px 이상은 왼쪽 레일까지 3단.
// 시트는 1024px 이상에서 가운데 창으로 뜬다
export const WIDE_QUERY = "(min-width: 900px)";
export const RAIL_QUERY = "(min-width: 1200px)";
export const DIALOG_QUERY = "(min-width: 1024px)";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// 툴팁용 단축키 표기: 맥 "⌘K", 윈도우 "Ctrl+K"
export function shortcutLabel(key: string) {
  return isMac() ? `⌘${key.toUpperCase()}` : `Ctrl+${key.toUpperCase()}`;
}

// 넓은 화면 단축키. 맥 ⌘ / 윈도우 Ctrl(둘 다 받는다).
// N 새로 만들기 · K 검색 · I 설정(메모 본문 안에서는 기울임이라 무시) · P 빠른팩 입력 · Esc 상세 닫기(열린 시트가 없을 때)
// 브라우저 탭에서 ⌘N/Ctrl+N은 브라우저가 먼저 가져가 동작하지 않는다(포터블 앱에서는 동작)
export function useAppShortcuts(
  enabled: boolean,
  handlers: { onNew: () => void; onSearch: () => void; onSettings: () => void; onQuickAdd: () => void; onEscape: () => void },
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.defaultPrevented) return;
      const h = ref.current;
      if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // 시트·창이 열려 있으면 그쪽이 닫는다
        if (document.querySelector('[aria-modal="true"]')) return;
        const el = document.activeElement as HTMLElement | null;
        if (el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
          el.blur();
          return;
        }
        h.onEscape();
        return;
      }
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === "i") {
        const target = e.target as HTMLElement | null;
        if (target?.isContentEditable || target?.closest?.(".ProseMirror")) return;
      }
      const action = { n: h.onNew, k: h.onSearch, i: h.onSettings, p: h.onQuickAdd }[key];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
