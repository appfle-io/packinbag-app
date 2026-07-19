"use client";

import Portal from "@/components/Portal";

import { IconEdit, IconLayoutGrid, IconSparkles, IconX } from "@tabler/icons-react";

export default function NewBagOptionsSheet({
  onClose,
  onBlank,
  onFromSample,
  onFromNote,
}: {
  onClose: () => void;
  onBlank: () => void;
  onFromSample: () => void;
  onFromNote: () => void;
}) {
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium">새 가방 만들기</span>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <button
            onClick={onBlank}
            className="flex items-center gap-3 rounded-lg bg-surface-2 p-3 text-left"
          >
            <IconEdit size={18} stroke={1.75} />
            <div>
              <div className="text-[13px] font-medium">직접 만들기</div>
              <div className="text-[11px] text-text-muted">
                빈 가방에서 시작해요
              </div>
            </div>
          </button>

          <button
            onClick={onFromSample}
            className="flex items-center gap-3 rounded-lg bg-surface-2 p-3 text-left"
          >
            <IconLayoutGrid size={18} stroke={1.75} />
            <div className="flex items-center gap-1.5">
              <div>
                <div className="text-[13px] font-medium">샘플로 시작하기</div>
                <div className="text-[11px] text-text-muted">
                  여행, 이사, 장보기 등 상황별 샘플을 바로 채워드려요
                </div>
              </div>
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold"
                style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
              >
                NEW
              </span>
            </div>
          </button>

          <button
            onClick={onFromNote}
            className="flex items-center gap-3 rounded-lg p-3 text-left"
            style={{ background: "var(--accent-soft)" }}
          >
            <IconSparkles size={18} stroke={1.75} color="var(--accent-strong)" />
            <div>
              <div className="text-[13px] font-medium" style={{ color: "var(--accent-strong)" }}>
                클립보드에서 가져오기
              </div>
              <div className="text-[11px] text-text-secondary">
                메모장에서 복사한 내용을 붙여넣으면 AI가 자동으로 분류해줘요
              </div>
            </div>
          </button>
        </div>
      </div>
    </Portal>
  );
}
