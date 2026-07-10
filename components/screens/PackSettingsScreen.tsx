"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useSwipeBack } from "@/lib/useSwipeBack";
import ToggleSwitch from "@/components/ToggleSwitch";

export default function PackSettingsScreen({ onBack }: { onBack: () => void }) {
  const { profile, updatePackSettings } = useAuth();
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  // 명시적으로 꺼둔 적이 없으면 기본 켜짐
  const moveCompletedToBottom = profile?.packSettings?.moveCompletedToBottom ?? true;
  // 명시적으로 켜둔 적이 없으면 기본 꺼짐
  const alwaysCollapseOnEntry = profile?.packSettings?.alwaysCollapseOnEntry ?? false;

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">팩 설정</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
        <p className="text-[11px] text-text-muted -mb-1">
          가방/팩 안의 짐 목록이 보여지는 방식을 설정해요
        </p>

        <div className="rounded-lg border border-border bg-surface p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">완료된 항목 맨 아래로 이동</p>
            <p className="text-[11.5px] text-text-secondary mt-0.5">
              체크한 짐을 목록 아래쪽으로 내려서 보여줘요
            </p>
          </div>
          <ToggleSwitch
            checked={moveCompletedToBottom}
            onChange={(v) => updatePackSettings({ moveCompletedToBottom: v })}
            ariaLabel="완료된 항목 맨 아래로 이동"
          />
        </div>

        <div className="rounded-lg border border-border bg-surface p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">가방 열 때 팩 접어서 보기</p>
            <p className="text-[11.5px] text-text-secondary mt-0.5">
              가방에 들어갈 때마다 팩이 접힌 상태로 시작돼요. 이후엔 자유롭게 펼치고 접을 수 있어요.
            </p>
          </div>
          <ToggleSwitch
            checked={alwaysCollapseOnEntry}
            onChange={(v) => updatePackSettings({ alwaysCollapseOnEntry: v })}
            ariaLabel="가방 열 때 팩 접어서 보기"
          />
        </div>
      </div>
    </div>
  );
}
