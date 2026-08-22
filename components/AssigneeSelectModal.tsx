"use client";

import { Bag, Item } from "@/lib/types";
import { IconCheck, IconUser, IconUserOff, IconX } from "@tabler/icons-react";

interface AssigneeSelectModalProps {
  bag: Bag;
  item: Item;
  currentUid: string;
  onSelect: (assigneeUid: string | undefined) => void;
  onClose: () => void;
}

export default function AssigneeSelectModal({
  bag,
  item,
  currentUid,
  onSelect,
  onClose,
}: AssigneeSelectModalProps) {
  const currentAssignee = item.assigneeUid;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-5 shadow-xl animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
          <div>
            <p className="text-[11px] text-text-muted font-medium">짐 담당자 지정</p>
            <h3 className="text-[15px] font-bold text-foreground truncate max-w-[240px]">
              {item.text}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 -mr-1.5 rounded-full hover:bg-surface-2 text-text-muted"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* 내가 챙길게 버튼 */}
        <button
          onClick={() => {
            onSelect(currentUid);
            onClose();
          }}
          className="w-full py-2.5 px-4 mb-3 rounded-xl bg-accent-soft hover:bg-accent/15 active:scale-[0.98] border border-accent/30 text-accent-strong font-bold text-[14px] flex items-center justify-center gap-2 transition-all"
        >
          <IconUser size={16} />
          내가 챙기기 (나를 담당자로 지정)
        </button>

        <div className="space-y-1 max-h-60 overflow-y-auto">
          {/* 담당자 없음 (공용 짐) */}
          <button
            onClick={() => {
              onSelect(undefined);
              onClose();
            }}
            className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left transition-colors ${
              !currentAssignee
                ? "bg-surface-2 font-bold text-foreground"
                : "hover:bg-surface-2 text-text-secondary"
            }`}
          >
            <span className="flex items-center gap-2 text-[13px]">
              <IconUserOff size={16} className="text-text-muted" />
              담당자 없음 (전체 공용)
            </span>
            {!currentAssignee && <IconCheck size={16} className="text-accent" />}
          </button>

          {/* 멤버 목록 */}
          {bag.memberIds.map((uid) => {
            const profile = bag.memberProfiles?.[uid];
            const isSelected = currentAssignee === uid;
            const isMe = uid === currentUid;

            return (
              <button
                key={uid}
                onClick={() => {
                  onSelect(uid);
                  onClose();
                }}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left transition-colors ${
                  isSelected
                    ? "bg-surface-2 font-bold text-foreground"
                    : "hover:bg-surface-2 text-text-secondary"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center text-[11px] font-bold shrink-0">
                    {profile?.nickname?.[0]?.toUpperCase() || <IconUser size={13} />}
                  </div>
                  <span className="text-[13px] truncate">
                    {profile?.nickname || "멤버"} {isMe && "(나)"}
                  </span>
                </div>
                {isSelected && <IconCheck size={16} className="text-accent shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
