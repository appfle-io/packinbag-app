"use client";

import { useState } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useSwipeBack } from "@/lib/useSwipeBack";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

export default function BagSettingsScreen({ onBack }: { onBack: () => void }) {
  const { profile, updateDefaultBagViewMode, updateBagSettings } = useAuth();
  const { show } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  // 명시적으로 고른 적이 없으면 기본값은 팩뷰(카드 그리드)
  const defaultBagViewMode = profile?.defaultBagViewMode ?? "pack";
  const showTodayTasksOnStartup = profile?.bagSettings?.showTodayTasksOnStartup !== false;

  const handleToggleTodayTasks = async () => {
    try {
      await updateBagSettings({ showTodayTasksOnStartup: !showTodayTasksOnStartup });
      show(!showTodayTasksOnStartup ? "앱 실행 시 오늘 마감 내용을 보여줘요" : "오늘 마감 알림을 껐어요");
    } catch {
      show("설정 저장에 실패했어요");
    }
  };

  const handleReset = async () => {
    try {
      await updateDefaultBagViewMode("pack");
      await updateBagSettings({ showTodayTasksOnStartup: true });
      setConfirmReset(false);
      show("가방 설정이 기본값으로 초기화되었어요");
    } catch {
      show("설정 초기화에 실패했어요");
    }
  };

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1" aria-label="뒤로가기">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">가방설정</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
        <p className="text-[11px] text-text-muted -mb-1">
          가방 보관함 및 팩 표시 방식을 설정해요.
        </p>

        <div className="rounded-lg border border-border bg-surface-2 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">가방 기본 보기</p>
            <p className="text-[11.5px] text-text-secondary mt-0.5">
              팩뷰는 지금처럼 카드 형태로, 심플뷰는 팩을 헤더+내용이 이어지는 문서 형태로 보여줘요.
            </p>
          </div>
          <select
            value={defaultBagViewMode}
            onChange={(e) => updateDefaultBagViewMode(e.target.value as "pack" | "notebook")}
            aria-label="가방 기본 보기"
            className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[13px] outline-none"
            style={{ background: "var(--surface-2)", color: "var(--foreground)" }}
          >
            <option value="pack">팩뷰</option>
            <option value="notebook">심플뷰</option>
          </select>
        </div>

        <div className="rounded-lg border border-border bg-surface-2 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">앱 실행 시 오늘 마감 내용 보기</p>
            <p className="text-[11.5px] text-text-secondary mt-0.5">
              앱을 열 때 오늘 마감인 업무나 짐 목록을 팝업으로 모아서 보여줘요.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showTodayTasksOnStartup}
            onClick={handleToggleTodayTasks}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
              showTodayTasksOnStartup ? "bg-accent" : "bg-border"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-0.5 ${
                showTodayTasksOnStartup ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="mt-4 mb-2 flex justify-center">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="rounded-md border border-border px-4 py-2 text-[12.5px] text-text-secondary hover:text-foreground bg-surface-2 transition-colors"
          >
            가방 설정 초기화
          </button>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="가방 설정을 초기화하시겠어요?"
          message="가방 기본 보기(팩뷰) 설정이 기본값으로 돌아가요."
          confirmLabel="초기화"
          tone="accent"
          onCancel={() => setConfirmReset(false)}
          onConfirm={handleReset}
        />
      )}
    </div>
  );
}
