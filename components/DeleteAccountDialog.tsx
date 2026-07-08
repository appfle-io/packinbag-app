"use client";

import Portal from "@/components/Portal";

import { useState } from "react";
import { IconX } from "@tabler/icons-react";

export default function DeleteAccountDialog({
  nickname,
  onCancel,
  onConfirm,
}: {
  nickname: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = input.trim().length > 0 && input === nickname;

  const handleConfirm = async () => {
    if (!matches || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "탈퇴 처리에 실패했어요");
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={loading ? undefined : onCancel}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[15px] font-medium"
              style={{ color: "var(--danger)" }}
            >
              회원 탈퇴
            </span>
            {!loading && (
              <button onClick={onCancel} aria-label="닫기">
                <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
              </button>
            )}
          </div>

          <p className="text-[12px] text-text-secondary leading-relaxed">
            탈퇴하면 계정 정보, 팩 라이브러리, 나만 있는 가방이 모두 영구적으로
            삭제돼요. 이 작업은 되돌릴 수 없어요. 다른 사람과 함께 쓰던 가방은
            나만 빠지고, 남은 멤버들은 계속 사용할 수 있어요.
          </p>

          <div>
            <p className="text-[12px] text-text-secondary mb-1.5">
              계속하려면 닉네임{" "}
              <span
                className="font-medium"
                style={{ color: "var(--foreground)" }}
              >
                {nickname}
              </span>
              을 그대로 입력해주세요
            </p>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder={nickname}
              autoComplete="off"
              autoCapitalize="off"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none disabled:opacity-60"
            />
          </div>

          {error && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={!matches || loading}
            className="rounded-lg py-2.5 text-[14px] font-medium"
            style={{
              background:
                matches && !loading ? "var(--danger)" : "var(--surface-2)",
              color: matches && !loading ? "#fff" : "var(--text-muted)",
            }}
          >
            {loading ? "삭제하는 중..." : "영구 삭제"}
          </button>
        </div>
      </div>
    </Portal>
  );
}
