"use client";

import { useState } from "react";
import { Button, Sheet } from "@/components/v2/ui";

// 구 JoinBagDialog의 v2 버전. 초대 코드를 받아 가방에 참여한다.
// onConfirm이 실패(throw)하면 시트 안에 이유를 보여주고 닫지 않는다.
export function JoinBagSheet({
  open,
  initialCode = "",
  onClose,
  onConfirm,
}: {
  open: boolean;
  initialCode?: string;
  onClose: () => void;
  onConfirm: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // 다시 열릴 때마다 초기화(초대 링크로 들어왔으면 그 코드로)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setCode(initialCode);
      setError("");
    }
  }

  const submit = async () => {
    if (!code.trim() || busy) return;
    setError("");
    setBusy(true);
    try {
      await onConfirm(code.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "참여하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="코드로 참여하기"
      footer={
        <Button block disabled={!code.trim() || busy} onClick={submit}>
          {busy ? "참여하는 중" : "참여하기"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-body text-sub">함께 쓸 사람이 보내준 초대 코드를 입력해 주세요.</p>
        <input
          value={code}
          autoFocus
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={8}
          aria-label="초대 코드"
          placeholder="예: AB12CD"
          autoCapitalize="characters"
          autoComplete="off"
          className="h-12 w-full rounded-field bg-fill px-4 text-center text-body-lg tracking-widest outline-none placeholder:text-faint"
        />
        {error && <p className="m-0 text-caption text-alert">{error}</p>}
      </div>
    </Sheet>
  );
}
