"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";

export default function EmailVerifyBanner() {
  const { user, resendVerificationEmail } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const { show } = useToast();

  // 구글로 가입한 사람은 이미 검증된 이메일이라 배너가 필요 없음
  if (!user || user.emailVerified || dismissed) return null;
  const isPasswordAccount = user.providerData.some(
    (p) => p.providerId === "password"
  );
  if (!isPasswordAccount) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await resendVerificationEmail();
      show("인증 메일을 다시 보냈어요");
    } catch {
      show("잠시 후 다시 시도해주세요");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-2 px-4 py-2 text-[12px] shrink-0"
      style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
    >
      <span>이메일 인증이 아직 안됐어요</span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={handleResend}
          disabled={sending}
          className="font-medium"
          style={{ color: "var(--accent)" }}
        >
          인증 메일 다시 받기
        </button>
        <button onClick={() => setDismissed(true)} className="text-text-muted">
          닫기
        </button>
      </div>
    </div>
  );
}
