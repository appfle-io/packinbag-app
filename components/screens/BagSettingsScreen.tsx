"use client";

import { useState } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useSwipeBack } from "@/lib/useSwipeBack";
import ToggleSwitch from "@/components/ToggleSwitch";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

export default function BagSettingsScreen({ onBack }: { onBack: () => void }) {
  const { profile, updateDefaultBagViewMode, updateBagSettings } = useAuth();
  const { show } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  // 명시적으로 고른 적이 없으면 기본값은 팩뷰(카드 그리드)
  const defaultBagViewMode = profile?.defaultBagViewMode ?? "pack";
  const packTreeHintEnabled = profile?.bagSettings?.packTreeHintEnabled ?? profile?.packSettings?.packTreeHintEnabled ?? true;

  const handleReset = async () => {
    try {
      await updateDefaultBagViewMode("pack");
      await updateBagSettings({ packTreeHintEnabled: true });
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
            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[13px] outline-none"
            style={{ background: "var(--surface-2)", color: "var(--foreground)" }}
          >
            <option value="pack">팩뷰</option>
            <option value="notebook">심플뷰</option>
          </select>
        </div>

        <div className="rounded-lg border border-border bg-surface-2 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">팩 보관함 이동 버튼</p>
            <p className="text-[11.5px] text-text-secondary mt-0.5">
              가방 보관함 왼쪽 가장자리에 팩 보관함으로 이동하는 플로팅 버튼을 띄워줘요. 꺼도 가장자리를 스와이프하면 화면을 오갈 수 있어요.
            </p>
          </div>
          <ToggleSwitch
            checked={packTreeHintEnabled}
            onChange={(v) => updateBagSettings({ packTreeHintEnabled: v })}
            ariaLabel="팩 보관함 이동 버튼"
          />
        </div>

        <div className="mt-4 mb-2 flex justify-center">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="rounded-lg border border-border px-4 py-2 text-[12.5px] text-text-secondary hover:text-foreground bg-surface-2 transition-colors"
          >
            가방 설정 초기화
          </button>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="가방 설정을 초기화하시겠어요?"
          message="가방 기본 보기(팩뷰) 및 플로팅 버튼 설정이 기본값으로 돌아가요."
          confirmLabel="초기화"
          tone="accent"
          onCancel={() => setConfirmReset(false)}
          onConfirm={handleReset}
        />
      )}
    </div>
  );
}
