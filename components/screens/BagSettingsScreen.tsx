"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useSwipeBack } from "@/lib/useSwipeBack";

export default function BagSettingsScreen({ onBack }: { onBack: () => void }) {
  const { profile, updateDefaultBagViewMode } = useAuth();
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  // 명시적으로 고른 적이 없으면 기본값은 팩뷰(카드 그리드)
  const defaultBagViewMode = profile?.defaultBagViewMode ?? "pack";

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">가방설정</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
        <p className="text-[11px] text-text-muted -mb-1">
          가방 속 팩을 보여주는 기본 방식을 설정해요. 각 가방 안에서 개별로 바꿀 수도 있어요.
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
      </div>
    </div>
  );
}
