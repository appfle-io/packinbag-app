"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { cx } from "@/components/v2/ui";

// 리디자인 v2 "잠깐 기다려 주세요" 층(가방·팩 만드는 중, 이용권 상태 바뀌는 중, 여러 가방 지우는 중).
// 구 AppShell의 CreatingBagOverlay·CreatingPackOverlay·PremiumSyncOverlay·DeletingBagsOverlay 대체.
// - message만 있으면 화면 전체를 바탕색으로 덮고 가운데 동그라미 + 문구(화면이 바뀌는 중)
// - progress가 있으면 뒤 화면을 어둡게 비치고 가운데 카드에 진행 막대(여러 개 처리 중)
// 보이지 않을 때도 그려 두고 투명도로만 숨긴다(사라지는 모습이 보이게)
export function BusyOverlay({
  visible,
  message,
  progress,
}: {
  visible: boolean;
  message?: string;
  progress?: { total: number; completed: number };
}) {
  const percent = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  return (
    <div
      aria-hidden={!visible}
      className={cx(
        // eslint-disable-next-line pib-v2/no-arbitrary-values -- 구 오버레이와 같은 층(210, 시트·화면 위)
        "pib-v2 pib-v2-overlay fixed inset-0 z-[210] flex items-center justify-center px-6 transition-opacity duration-200 ease-snappy",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div aria-hidden="true" className={cx("absolute inset-0", progress ? "bg-scrim" : "bg-canvas")} />
      {progress ? (
        <div role="status" aria-live="polite" className="relative flex w-full max-w-72 flex-col items-center gap-3 rounded-card bg-card p-6 shadow-sheet">
          <IconLoader2 size={28} stroke={1.9} className="animate-spin text-brand" aria-hidden="true" />
          <p className="m-0 text-body font-semibold text-ink">{message ?? "처리하고 있어요"}</p>
          <p className="m-0 text-caption text-sub tabular-nums">
            {progress.completed} / {progress.total} · {percent}%
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-fill">
            <div className="h-2 rounded-full bg-brand transition-[width] duration-200 ease-snappy" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : (
        <div role="status" aria-live="polite" className="relative flex flex-col items-center gap-3">
          <IconLoader2 size={28} stroke={1.9} className="animate-spin text-faint" aria-hidden="true" />
          {message && <p className="m-0 text-caption text-sub">{message}</p>}
        </div>
      )}
    </div>
  );
}
