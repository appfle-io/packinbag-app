"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastType = "success" | "error";

interface ToastState {
  key: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<{ show: (message: string) => void }>({
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

  const show = useCallback((msg: string) => {
    counter.current += 1;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);

    setToast({ key: counter.current, message: msg, type: detectType(msg) });

    hideTimer.current = window.setTimeout(() => {
      setToast(null);
    }, 1700);
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
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
