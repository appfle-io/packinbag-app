"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { IconMail, IconX } from "@tabler/icons-react";

export default function EmailVerifyBanner() {
  const { user, isOfflineMode, resendVerificationEmail } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const { show } = useToast();

  // 오프라인 모드, 구글 가입자, 게스트는 배너가 필요 없음
  if (isOfflineMode || !user || user.isAnonymous || user.emailVerified || dismissed) return null;
  const isPasswordAccount = user.providerData?.some(
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

  // 연결 상태 줄(ConnectionBar)과 같은 모양
  return (
    <div role="status" className="flex min-h-11 w-full shrink-0 items-center gap-2 border-b border-line bg-fill pl-4 font-ui text-caption text-ink">
      <IconMail size={16} stroke={1.9} className="shrink-0 text-sub" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">이메일 인증이 아직 안 됐어요</span>
      <button type="button" onClick={handleResend} disabled={sending} className="h-11 shrink-0 bg-transparent px-2 font-semibold text-brand active:opacity-60 disabled:opacity-40">
        {sending ? "보내는 중" : "다시 받기"}
      </button>
      <button type="button" onClick={() => setDismissed(true)} aria-label="닫기" className="inline-flex size-11 shrink-0 items-center justify-center bg-transparent text-sub active:opacity-60">
        <IconX size={18} stroke={1.9} />
      </button>
    </div>
  );
}
