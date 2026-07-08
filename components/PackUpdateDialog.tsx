"use client";

import Portal from "@/components/Portal";

export default function PackUpdateDialog({
  onCancel,
  onSaveAsNew,
  onOverwrite,
}: {
  onCancel: () => void;
  onSaveAsNew: () => void;
  onOverwrite: () => void;
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
            <p className="text-[14px] font-medium mb-1">팩을 수정하시겠습니까?</p>
            <p className="text-[12px] text-text-secondary">
              라이브러리에 저장된 팩과 내용이 달라요.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={onOverwrite}
              className="w-full rounded-lg py-2.5 text-[13px] font-medium"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              덮어쓰기
            </button>
            <button
              onClick={onSaveAsNew}
              className="w-full rounded-lg border border-border py-2.5 text-[13px] font-medium"
            >
              새롭게 저장
            </button>
            <button
              onClick={onCancel}
              className="w-full rounded-lg py-2 text-[13px] text-text-secondary"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
