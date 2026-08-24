"use client";

import Portal from "@/components/Portal";

import { IconEdit, IconLayoutGrid, IconSparkles, IconX, IconTable } from "@tabler/icons-react";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

export default function NewBagOptionsSheet({
  onClose,
  onBlank,
  onFromSample,
  onFromNote,
  onFromSpreadsheet,
}: {
  onClose: () => void;
  onBlank: () => void;
  onFromSample: () => void;
  onFromNote: () => void;
  onFromSpreadsheet: () => void;
}) {
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(onClose);

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: ambientLayer + POPOVER_OFFSET, background: "rgba(0,0,0,0.45)" }}
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
            className="flex items-center gap-3 rounded-lg bg-surface-2 p-3 text-left hover:bg-surface-3 transition-colors cursor-pointer"
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
            className="flex items-center gap-3 rounded-lg bg-surface-2 p-3 text-left hover:bg-surface-3 transition-colors cursor-pointer"
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
            className="flex items-center gap-3 rounded-lg p-3 text-left transition-colors cursor-pointer"
            style={{ background: "var(--accent-soft)" }}
          >
            <IconSparkles size={18} stroke={1.75} color="var(--accent-strong)" />
            <div>
              <div className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: "var(--accent-strong)" }}>
                클립보드에서 가져오기
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-accent text-white">
                  AI
                </span>
              </div>
              <div className="text-[11px] text-text-secondary">
                메모장에서 복사한 내용을 붙여넣으면 AI가 자동으로 분류해줘요
              </div>
            </div>
          </button>

          <button
            onClick={onFromSpreadsheet}
            className="flex items-center gap-3 rounded-lg p-3 text-left bg-accent-soft/60 border border-accent/20 hover:bg-accent-soft transition-colors cursor-pointer"
          >
            <IconTable size={20} stroke={1.75} className="text-accent shrink-0" />
            <div>
              <div className="text-[13px] font-bold text-accent-strong flex items-center gap-1.5">
                스프레드시트 / 엑셀 링크
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-accent text-white">
                  AI
                </span>
              </div>
              <div className="text-[11px] text-text-secondary">
                구글 시트/엑셀 링크를 넣으면 표와 체크리스트를 자동 분석해요
              </div>
            </div>
          </button>
        </div>
      </div>
    </Portal>
  );
}
