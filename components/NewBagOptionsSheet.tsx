"use client";

import Portal from "@/components/Portal";
import { IconEdit, IconColumns, IconSparkles, IconX } from "@tabler/icons-react";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { useAuth } from "@/contexts/AuthProvider";

export default function NewBagOptionsSheet({
  onClose,
  onBlank,
  onKanban,
  onFromNote,
}: {
  onClose: () => void;
  onBlank: () => void;
  onKanban: () => void;
  onFromNote: () => void;
}) {
  const { isOfflineMode } = useAuth();
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
                빈 가방에서 자유롭게 시작해요
              </div>
            </div>
          </button>

          <button
            onClick={onKanban}
            className="flex items-center gap-3 rounded-lg bg-surface-2 p-3 text-left hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <IconColumns size={18} stroke={1.75} color="var(--accent)" />
            <div>
              <div className="text-[13px] font-medium flex items-center gap-1.5">
                칸반보드로 시작하기
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                >
                  업무
                </span>
              </div>
              <div className="text-[11px] text-text-muted">
                업무노트 및 대기·진행·완료 팩이 자동 구성돼요
              </div>
            </div>
          </button>

          {!isOfflineMode && (
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
                  메모장에서 복사한 내용을 AI가 자동으로 분류해줘요
                </div>
              </div>
            </button>
          )}
        </div>
      </div>
    </Portal>
  );
}

