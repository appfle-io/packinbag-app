"use client";

import Portal from "@/components/Portal";

import { useState } from "react";
import { IconX } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { UNLOCK_CODE_LENGTH } from "@/lib/aiUsageService";

export default function UnlockCodeDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (expiresAt: string | null) => void;
}) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!code.trim() || loading || !user) return;
    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/redeem-unlock-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "코드 확인에 실패했어요. 잠시 후 다시 시도해주세요");
        return;
      }
      onSuccess((data?.expiresAt as string | null) ?? null);
    } catch {
      setError("코드 확인에 실패했어요. 잠시 후 다시 시도해주세요");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium">이용권 코드 입력</span>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <p className="text-[12px] text-text-secondary">
            {UNLOCK_CODE_LENGTH}자리 이용권 코드를 입력하면 AI 기능을 무제한으로 쓸 수 있어요.
          </p>

          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={UNLOCK_CODE_LENGTH}
            placeholder="코드 입력"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] tracking-widest outline-none"
          />

          {error && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!code.trim() || loading}
            className="rounded-lg py-2.5 text-[14px] font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {loading ? "확인 중..." : "적용하기"}
          </button>
        </div>
      </div>
    </Portal>
  );
}
