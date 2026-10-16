"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { IconMail, IconX } from "@tabler/icons-react";

// ✕로 닫으면 하루 동안 숨긴다(계정마다, 이 기기). 예전에는 이번 실행에서만 숨겨 새로고침하면 다시 떴다(2026-10-16, shell.md 확인 필요 4).
// 인증은 계정 찾기 · 비밀번호 재설정에 필요해서 영구로 끄지는 않는다
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const snoozeKey = (uid: string) => `pib_email_verify_snooze:${uid}`;

function isSnoozed(uid: string): boolean {
  try {
    return Number(window.localStorage.getItem(snoozeKey(uid)) || 0) > Date.now();
  } catch {
    return false;
  }
}

export default function EmailVerifyBanner() {
  const { user, isOfflineMode, resendVerificationEmail } = useAuth();
  // 숨긴 직후 다시 그리기용(값은 localStorage가 기준)
  const [dismissedUid, setDismissedUid] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const { show } = useToast();

  // 오프라인 모드, 구글 가입자, 게스트는 배너가 필요 없음
  if (isOfflineMode || !user || user.isAnonymous || user.emailVerified) return null;
  if (dismissedUid === user.uid || isSnoozed(user.uid)) return null;
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

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(snoozeKey(user.uid), String(Date.now() + SNOOZE_MS));
    } catch {
      // 저장을 못 하면 이번 실행에서만 숨긴다
    }
    setDismissedUid(user.uid);
  };

  // 연결 상태 줄(ConnectionBar)과 같은 모양
  return (
    <div role="status" className="flex min-h-11 w-full shrink-0 items-center gap-2 border-b border-line bg-fill pl-4 font-ui text-caption text-ink">
      <IconMail size={16} stroke={1.9} className="shrink-0 text-sub" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">이메일 인증이 아직 안 됐어요</span>
      <button type="button" onClick={handleResend} disabled={sending} className="h-11 shrink-0 bg-transparent px-2 font-semibold text-brand active:opacity-60 disabled:opacity-40">
        {sending ? "보내는 중" : "다시 받기"}
      </button>
      <button type="button" onClick={handleDismiss} aria-label="하루 동안 숨기기" title="하루 동안 숨기기" className="inline-flex size-11 shrink-0 items-center justify-center bg-transparent text-sub active:opacity-60">
        <IconX size={18} stroke={1.9} />
      </button>
    </div>
  );
}
