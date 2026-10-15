"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { stopPackShares } from "@/lib/shareCleanup";

// 팩 · 폴더 · 메모 공유 시트의 "공유 끄기"(2026-10-15, share.md 확인 필요 3).
// 끄면 /p 링크가 더 이상 열리지 않는다. 시트를 다시 열면 새 주소로 다시 공유된다.
export function StopShareButton({
  token,
  onStopped,
}: {
  token: string | null;
  onStopped: () => void;
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!token) return null;
  return (
    <>
      <Button variant="danger" size="sm" className="self-start px-0" disabled={busy} onClick={() => setConfirm(true)}>
        {busy ? "끄는 중" : "공유 끄기"}
      </Button>
      <ConfirmSheet
        open={confirm}
        title="공유를 끌까요?"
        message="이 링크는 더 이상 열리지 않아요. 다시 공유하면 새 주소가 만들어져요."
        confirmLabel="공유 끄기"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy(true);
          const ok = await stopPackShares(user, [token]);
          setBusy(false);
          if (!ok) {
            show("공유를 끄지 못했어요. 잠시 후 다시 해 주세요");
            return;
          }
          show("공유를 껐어요");
          onStopped();
        }}
      />
    </>
  );
}
