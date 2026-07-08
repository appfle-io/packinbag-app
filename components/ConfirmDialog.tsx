"use client";

import Portal from "@/components/Portal";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "삭제",
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: "danger" | "accent";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Portal>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onCancel}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div>
            <p className="text-[14px] font-medium mb-1">{title}</p>
            {message && (
              <p className="text-[12px] text-text-secondary">{message}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg border border-border py-2 text-[13px]"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-lg py-2 text-[13px] font-medium"
              style={{ background: tone === "accent" ? "var(--accent)" : "var(--danger)", color: "#fff" }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
