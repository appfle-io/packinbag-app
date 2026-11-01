"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export interface ToastOptions {
  // 되돌리기 등 짧은 실행취소 액션이 필요할 때 지정한다. 지정하면 표시 시간이
  // 더 길어지고, 액션 버튼을 누르면 onAction 실행 후 즉시 토스트가 사라진다.
  actionLabel?: string;
  onAction?: () => void;
  // 지정하면 기본 노출시간(1700ms/actionLabel일 때 4000ms) 대신 이 시간(ms)을 쓴다.
  durationMs?: number;
}

interface ToastState extends ToastOptions {
  key: number;
  message: string;
  // 실제로 적용된 노출 시간(ms). CSS 페이드아웃 타이밍(--toast-fade-delay)을 이 값에 맞춘다.
  resolvedDurationMs: number;
}

const ToastContext = createContext<{ show: (message: string, options?: ToastOptions) => void }>({
  show: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);
  const hideTimer = useRef<number | null>(null);

  const show = useCallback((msg: string, options?: ToastOptions) => {
    counter.current += 1;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);

    // 실행취소 버튼이 있는 토스트는 반응할 시간을 더 준다. durationMs가 지정되면 그 값을 최우선한다.
    const resolvedDurationMs = options?.durationMs ?? (options?.actionLabel ? 4000 : 1700);

    setToast({
      key: counter.current,
      message: msg,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
      resolvedDurationMs,
    });

    hideTimer.current = window.setTimeout(() => {
      setToast(null);
    }, resolvedDurationMs);
  }, []);

  // 다른 곳을 누르거나 손으로 스크롤하면 바로 닫는다(2026-11-01). 누른 탭은 막지 않아 아래 화면에 그대로 들어간다.
  // 스크롤은 사용자 동작(wheel · touchmove)만 본다 - 앱이 스스로 굴리는 scroll 이벤트로 방금 띄운 토스트가 닫히지 않게
  const actionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!toast) return;
    const close = (e: Event) => {
      if (actionRef.current && e.target instanceof Node && actionRef.current.contains(e.target)) return;
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      setToast(null);
    };
    const opts = { capture: true, passive: true } as const;
    document.addEventListener("pointerdown", close, opts);
    document.addEventListener("wheel", close, opts);
    document.addEventListener("touchmove", close, opts);
    return () => {
      document.removeEventListener("pointerdown", close, opts);
      document.removeEventListener("wheel", close, opts);
      document.removeEventListener("touchmove", close, opts);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        // 화면 아래쪽 검은 띠 하나(아이콘 없음). 하단 탭바·입력창을 가리지 않게 띄운다(toast-lift: 떠 있는 탭바 높이를 따라감).
        // 띠는 탭이 통과하고 "되돌리기" 버튼만 눌린다(2026-11-01 - 예전엔 되돌리기 토스트 4초 동안 띠 전체가 아래 아이템을 막았다)
        // .pib-v2는 배경을 칠하므로 쓰지 않고 폰트만 font-ui로 맞춘다.
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[300] flex justify-center px-5 toast-lift" role="status">
          <div
            key={toast.key}
            className="pib-toast-pop flex w-full max-w-md items-center gap-3 rounded-card bg-ink px-4 py-3 font-ui text-on-ink shadow-sheet"
            style={{
              ["--toast-fade-delay" as string]: `${Math.max(0, toast.resolvedDurationMs - 220)}ms`,
            }}
          >
            <span className="min-w-0 flex-1 text-body">{toast.message}</span>
            {toast.actionLabel && (
              <button
                ref={actionRef}
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  if (hideTimer.current) window.clearTimeout(hideTimer.current);
                  setToast(null);
                }}
                className="pointer-events-auto -my-2 -mr-2 h-11 shrink-0 rounded-field bg-transparent px-3 text-body font-semibold text-brand-soft active:opacity-60"
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
