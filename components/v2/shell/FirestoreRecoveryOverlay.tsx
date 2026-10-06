"use client";

import { IconLoader2, IconRefresh } from "@tabler/icons-react";
import { Button, cx } from "@/components/v2/ui";
import { reloadNow, useFirestoreRecovery } from "@/lib/v2/firestoreRecovery";

// Firestore가 멈췄을 때(lib/v2/firestoreRecovery) 화면을 덮는 층.
// - reloading: 가운데 동그라미 + "다시 연결하고 있어요" 후 자동 새로고침
// - stuck: 방금 새로고침했는데 또 멈춘 경우. 자동으로 되풀이하지 않고 버튼만
// BusyOverlay와 같은 층·같은 모양(바탕을 덮는 형태)
export function FirestoreRecoveryOverlay() {
  const state = useFirestoreRecovery();
  const visible = state !== "ok";
  return (
    <div
      aria-hidden={!visible}
      className={cx(
        // eslint-disable-next-line pib-v2/no-arbitrary-values -- BusyOverlay와 같은 층(210, 시트·화면 위)
        "pib-v2 pib-v2-overlay fixed inset-0 z-[210] flex items-center justify-center px-6 transition-opacity duration-200 ease-snappy",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-canvas" />
      {state === "stuck" ? (
        <div role="alert" className="relative flex max-w-72 flex-col items-center gap-3 text-center">
          <p className="m-0 text-body font-semibold text-ink">연결을 다시 맞추지 못했어요</p>
          <p className="m-0 text-caption text-sub">새로고침하면 이어서 쓸 수 있어요. 저장해 둔 내용은 그대로예요</p>
          <Button onClick={reloadNow}>
            <IconRefresh size={18} stroke={1.9} aria-hidden="true" />
            새로고침
          </Button>
        </div>
      ) : (
        <div role="status" aria-live="polite" className="relative flex flex-col items-center gap-3">
          <IconLoader2 size={28} stroke={1.9} className="animate-spin text-faint" aria-hidden="true" />
          <p className="m-0 text-caption text-sub">다시 연결하고 있어요</p>
        </div>
      )}
    </div>
  );
}
