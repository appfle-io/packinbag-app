"use client";

import { Item } from "@/lib/types";
import Portal from "@/components/Portal";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { IconCalendarEvent, IconCheck, IconX, IconArrowRight } from "@tabler/icons-react";

export interface TodayTaskItem {
  bagId: string;
  bagName: string;
  packId: string;
  packName: string;
  item: Item;
}

export default function TodayTasksModal({
  tasks,
  onClose,
  onOpenTask,
}: {
  tasks: TodayTaskItem[];
  onClose: () => void;
  onOpenTask?: (bagId: string, packId: string, itemId: string) => void;
}) {
  const ambientLayer = useOverlayLayer();
  const resolvedZIndex = Math.max(ambientLayer + POPOVER_OFFSET, 200);
  useEscapeToClose(onClose);

  const completedCount = tasks.filter((t) => t.item.checked).length;

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: resolvedZIndex, background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-surface p-5 flex flex-col max-h-[80vh] shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-accent/10 text-accent">
                <IconCalendarEvent size={20} stroke={2} />
              </span>
              <div>
                <h3 className="text-[16px] font-bold text-foreground">오늘 마감 업무</h3>
                <p className="text-[12px] text-text-secondary">
                  오늘 마감인 항목이 {tasks.length}개 있습니다 ({completedCount}개 완료)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
              aria-label="닫기"
            >
              <IconX size={18} stroke={1.75} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
            {tasks.map((task) => {
              const isChecked = !!task.item.checked;
              return (
                <div
                  key={`${task.bagId}-${task.item.id}`}
                  onClick={() => {
                    if (onOpenTask) {
                      onOpenTask(task.bagId, task.packId, task.item.id);
                      onClose();
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isChecked
                      ? "bg-surface-2/60 border-border/60 opacity-60"
                      : "bg-surface border-border hover:border-accent hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isChecked ? "bg-accent border-accent text-white" : "border-border"
                      }`}
                    >
                      {isChecked && <IconCheck size={11} stroke={3} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[13.5px] truncate font-medium ${
                          isChecked ? "line-through text-text-muted" : "text-foreground"
                        }`}
                      >
                        {task.item.text}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mt-0.5">
                        <span className="truncate max-w-[120px]">{task.bagName}</span>
                        <span>·</span>
                        <span className="truncate max-w-[100px]">{task.packName}</span>
                      </div>
                    </div>
                  </div>
                  {onOpenTask && (
                    <span className="text-text-muted shrink-0">
                      <IconArrowRight size={15} stroke={2} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-border flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[13px] font-medium bg-surface-2 hover:bg-surface-3 text-foreground transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
