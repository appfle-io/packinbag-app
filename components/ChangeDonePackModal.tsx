"use client";

import { useState } from "react";
import { Pack } from "@/lib/types";
import Portal from "@/components/Portal";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

export default function ChangeDonePackModal({
  currentDonePackName,
  availablePacks,
  onConfirm,
  onCancel,
}: {
  currentDonePackName: string;
  availablePacks: Pack[];
  onConfirm: (newDonePackId: string) => void;
  onCancel: () => void;
}) {
  const [selectedPackId, setSelectedPackId] = useState<string>(
    availablePacks[0]?.id || ""
  );
  const ambientLayer = useOverlayLayer();
  const resolvedZIndex = Math.max(ambientLayer + POPOVER_OFFSET, 250);
  useEscapeToClose(onCancel);

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: resolvedZIndex, background: "rgba(0,0,0,0.45)" }}
        onClick={onCancel}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-xl bg-surface p-5 flex flex-col gap-4 shadow-xl border border-border"
        >
          <div>
            <h3 className="text-[15px] font-semibold mb-1 text-foreground">
              완료 팩 삭제 및 변경
            </h3>
            <p className="text-[12.5px] text-text-secondary leading-relaxed">
              &apos;{currentDonePackName}&apos; 팩은 현재 <strong>완료 팩</strong>으로 지정되어 있습니다.
              이 팩을 삭제하려면 완료 항목을 관리할 새로운 완료 팩을 선택해주세요.
            </p>
          </div>

          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto py-1">
            {availablePacks.map((p) => {
              const isSelected = selectedPackId === p.id;
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-accent bg-accent/5 text-foreground font-medium"
                      : "border-border hover:bg-surface-2 text-text-secondary"
                  }`}
                >
                  <input
                    type="radio"
                    name="donePackChoice"
                    value={p.id}
                    checked={isSelected}
                    onChange={() => setSelectedPackId(p.id)}
                    className="accent-accent"
                  />
                  <span className="text-[13px] truncate">{p.name}</span>
                </label>
              );
            })}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg border border-border py-2 text-[13px] font-medium text-foreground hover:bg-surface-2 transition-colors"
            >
              취소
            </button>
            <button
              disabled={!selectedPackId}
              onClick={() => onConfirm(selectedPackId)}
              className="flex-1 rounded-lg py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
              style={{ background: "var(--danger)", color: "#fff" }}
            >
              새 완료 팩 지정 및 삭제
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
