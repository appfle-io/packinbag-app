"use client";

import Portal from "@/components/Portal";

import { useState } from "react";
import { IconX } from "@tabler/icons-react";

export default function JoinBagDialog({
  initialCode = "",
  onCancel,
  onConfirm,
}: {
  initialCode?: string;
  onCancel: () => void;
  onConfirm: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setError("");
    setBusy(true);
    try {
      await onConfirm(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "참여하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
        <div className="w-full max-w-xs rounded-xl bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium">코드로 가방 참여하기</p>
            <button onClick={onCancel} aria-label="닫기">
              <IconX size={18} stroke={1.75} />
            </button>
          </div>
          <p className="text-[12px] text-text-secondary">
            함께 쓸 사람이 공유해준 6자리 코드를 입력해주세요
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="예: AB12CD"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none tracking-widest text-center"
            maxLength={8}
            autoFocus
          />
          {error && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <button
            onClick={handleConfirm}
            disabled={busy || !code.trim()}
            className="rounded-lg py-2.5 text-[14px] font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            참여하기
          </button>
        </div>
      </div>
    </Portal>
  );
}
