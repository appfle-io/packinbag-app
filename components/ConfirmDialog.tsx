"use client";

import { useState } from "react";
import Portal from "@/components/Portal";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "삭제",
  tone = "danger",
  checkboxLabel,
  defaultChecked = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: "danger" | "accent";
  // 있으면 다이얼로그 안에 체크박스를 하나 더 보여주고, 확인 시 그 체크 상태를 onConfirm에
  // 넘겨준다 (예: "라이브러리에 저장된 원본도 함께 삭제"). 없으면 기존처럼 체크박스 없이 동작.
  checkboxLabel?: string;
  defaultChecked?: boolean;
  onConfirm: (checked: boolean) => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(defaultChecked);

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
          {checkboxLabel && (
            <label className="flex items-center gap-2 text-[12px] text-text-secondary">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              {checkboxLabel}
            </label>
          )}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg border border-border py-2 text-[13px]"
            >
              취소
            </button>
            <button
              onClick={() => onConfirm(checked)}
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
