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
  // 실제로 적용된 노출 시간(ms). CSS 페이드아웃 타이밍(--toast-fade-delay)을 이 값에 맞춰
  // 동적으로 계산하기 위해 별도로 보관한다(아래 render 참고).
  resolvedDurationMs: number;
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

    // 실행취소 버튼이 있는 토스트는 반응할 시간을 더 준다. durationMs가 지정되면 그 값을 최우선한다.
    const resolvedDurationMs = options?.durationMs ?? (options?.actionLabel ? 4000 : 1700);

    setToast({
      key: counter.current,
      message: msg,
      type: detectType(msg),
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
      resolvedDurationMs,
    });

    hideTimer.current = window.setTimeout(() => {
      setToast(null);
    }, resolvedDurationMs);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          // 팩보관함의 바텀시트(z-75)나 이동 시트(z-80) 같은 모달/오버레이 위에서 띄우는 경우에도
          // 토스트가 그 뒤에 가려지면 안 된다 - 앱 전체에서 가장 높은 오버레이(스플래시/프리미엄 동기화 오버레이,
          // z-210)보다도 높게 잡아서 항상 최상단에 보이게 한다.
          className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center px-8"
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
              // pib-toast-pop 애니메이션(globals.css)의 페이드아웃 시작 시점을 실제 노출 시간에 맞춰
              // 동적으로 계산한다 - 예전에는 1480ms로 고정되어 있어서 durationMs를 3~7초로
              // 늘려도 화면에서는 항상 1.7초 만에 사라지는 것처럼 보였다 (페이드아웃이 끝난 뒤
              // 투명한 채로 계속 남아있다가 그때 가서야 언마운트되니, 시간이 안 늘어난 것처럼 느껴졌다).
              ["--toast-fade-delay" as string]: `${Math.max(0, toast.resolvedDurationMs - 220)}ms`,
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
