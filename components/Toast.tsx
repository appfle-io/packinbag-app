"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastType = "success" | "error";

export interface ToastOptions {
  // 되돌리기 등 짧은 실행취소 액션이 필요할 때 지정한다. 지정하면 표시 시간이
  // 더 길어지고, 액션 버튼을 누르면 onAction 실행 후 즉시 토스트가 사라진다.
  actionLabel?: string;
  onAction?: () => void;
  // 지정하면 기본 노출시간(1700ms/actionLabel일 때 4000ms) 대신 이 시간(ms)을 쓴다.
  // 짐 더블클릭 복사 토스트처럼 사용자가 설정한 노출시간을 반영할 때 쓴다.
  durationMs?: number;
}

interface ToastState extends ToastOptions {
  key: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<{ show: (message: string, options?: ToastOptions) => void }>({
  show: () => {},
});

function detectType(message: string): ToastType {
  if (message.includes("실패") || message.includes("찾을 수 없")) {
    return "error";
  }
  return "success";
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);
  const hideTimer = useRef<number | null>(null);

  const show = useCallback((msg: string, options?: ToastOptions) => {
    counter.current += 1;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);

    setToast({
      key: counter.current,
      message: msg,
      type: detectType(msg),
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
    });

    // 실행취소 버튼이 있는 토스트는 반응할 시간을 더 준다. durationMs가 지정되면 그 값을 최우선한다.
    hideTimer.current = window.setTimeout(() => {
      setToast(null);
    }, options?.durationMs ?? (options?.actionLabel ? 4000 : 1700));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center px-8"
          role="status"
        >
          <div
            key={toast.key}
            className="pib-toast-pop flex flex-col items-center gap-2.5 rounded-2xl px-6 py-5 text-center shadow-lg"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              minWidth: 148,
              maxWidth: 260,
              pointerEvents: toast.actionLabel ? "auto" : "none",
            }}
          >
            {toast.type === "success" ? (
              <span
                className="pib-toast-circle flex items-center justify-center rounded-full shrink-0"
                style={{ width: 40, height: 40, background: "var(--accent)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12.5L9.5 18L20 6"
                    stroke="#fff"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pib-toast-check"
                    pathLength={1}
                  />
                </svg>
              </span>
            ) : (
              <span
                className="pib-toast-circle flex items-center justify-center rounded-full shrink-0"
                style={{ width: 40, height: 40, background: "var(--danger)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6L18 18M18 6L6 18"
                    stroke="#fff"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pib-toast-check"
                    pathLength={1}
                  />
                </svg>
              </span>
            )}
            <span
              className="text-[13px] font-medium leading-snug"
              style={{ color: "var(--foreground)" }}
            >
              {toast.message}
            </span>
            {toast.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  if (hideTimer.current) window.clearTimeout(hideTimer.current);
                  setToast(null);
                }}
                className="text-[12.5px] font-semibold rounded-lg px-3 py-1.5 -mb-1"
                style={{ color: "var(--accent)" }}
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
