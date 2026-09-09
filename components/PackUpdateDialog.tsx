"use client";

import Portal from "@/components/Portal";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

export default function PackUpdateDialog({
  conflict,
  onCancel,
  onRefresh,
  onSaveAsNew,
  onOverwrite,
}: {
  conflict?: boolean;
  onCancel: () => void;
  onRefresh?: () => void;
  onSaveAsNew: () => void;
  onOverwrite: () => void;
}) {
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(onCancel);

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: ambientLayer + POPOVER_OFFSET, background: "rgba(0,0,0,0.45)" }}
        onClick={onCancel}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div>
            <p className="text-[14px] font-medium mb-1">팩 보관함 동기화</p>
            {conflict ? (
              <p className="text-[12px]" style={{ color: "var(--danger)" }}>
                보관함의 원본 팩이 더 최신 상태예요.
              </p>
            ) : (
              <p className="text-[12px] text-text-secondary">
                보관함에 저장된 팩과 내용이 달라요. 어떻게 진행할까요?
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="w-full rounded-lg py-2.5 text-[13px] font-medium transition-colors"
                style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
              >
                보관함에서 다시 불러오기
              </button>
            )}
            {!conflict && (
              <button
                onClick={onOverwrite}
                className="w-full rounded-lg py-2.5 text-[13px] font-medium transition-colors"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                보관함 원본에 덮어쓰기
              </button>
            )}
            <button
              onClick={onSaveAsNew}
              className="w-full rounded-lg py-2.5 text-[13px] font-medium transition-colors"
              style={
                conflict
                  ? { background: "var(--accent)", color: "#fff" }
                  : { border: "1px solid var(--border)" }
              }
            >
              새로운 팩으로 저장
            </button>
            <button
              onClick={onCancel}
              className="w-full rounded-lg py-2 text-[13px] text-text-secondary hover:bg-surface-2 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
