"use client";

import { useState } from "react";
import { IconLoader2, IconMailCheck } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { friendlyAuthError } from "@/lib/authErrorMessage";
import { Button, Sheet } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";

const FIELD = "h-12 w-full rounded-field border border-line bg-card px-4 text-body outline-none placeholder:text-faint focus:border-ink";

function linkErrorMessage(err: unknown, emailFlow: boolean) {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
  if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
    return emailFlow ? "이미 가입된 이메일이에요. 다른 이메일을 써 주세요." : "이미 가입된 계정이에요. 다른 계정을 고르거나 로그인해 주세요.";
  }
  return friendlyAuthError(err instanceof Error ? err.message : "");
}

// 게스트 → 정식 계정 전환 시트. 구 AccountLinkModal 대체(같은 AuthProvider 함수).
// 단계: 방법 고르기(Google · Apple · 이메일) → 이메일 입력 → 인증 메일 보냄. 진행 중에는 닫기 막음
export function AccountLinkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { linkAccountWithGoogle, linkAccountWithApple, linkAccountWithEmail, logout } = useAuth();
  const { show } = useToast();
  const [step, setStep] = useState<"options" | "email" | "sent">("options");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep("options");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      setError("");
    }
  }

  const runSocial = async (fn: () => Promise<unknown>, done: string) => {
    setError("");
    setBusy(true);
    try {
      await fn();
      show(done);
      onClose();
    } catch (err) {
      setError(linkErrorMessage(err, false));
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = async () => {
    setError("");
    if (!email.trim() || !password) return setError("이메일과 비밀번호를 입력해 주세요.");
    if (password.length < 6) return setError("비밀번호는 6자 이상이어야 해요.");
    if (password !== passwordConfirm) return setError("비밀번호가 서로 달라요.");
    setBusy(true);
    try {
      const sent = await linkAccountWithEmail(email.trim(), password);
      if (sent) setStep("sent");
      else {
        show("이메일 계정으로 연결했어요");
        onClose();
      }
    } catch (err) {
      setError(linkErrorMessage(err, true));
    } finally {
      setBusy(false);
    }
  };

  const footer =
    step === "sent" ? (
      <Button block onClick={onClose}>
        확인
      </Button>
    ) : step === "email" ? (
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => {
            setError("");
            setStep("options");
          }}>
          이전
        </Button>
        <Button
          className="flex-1"
          disabled={busy}
          leading={busy ? <IconLoader2 size={18} stroke={2} className="animate-spin" /> : undefined}
          onClick={submitEmail}
        >
          연결하기
        </Button>
      </div>
    ) : undefined;

  return (
    <>
      <Sheet open={open} onClose={busy ? () => {} : onClose} title={step === "sent" ? "인증 메일을 보냈어요" : "정식 계정으로 전환"} showClose={!busy} footer={footer}>
        {step === "sent" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span aria-hidden="true" className="inline-flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
              <IconMailCheck size={24} stroke={1.75} />
            </span>
            <p className="m-0 text-body text-ink">
              <strong className="font-semibold">{email.trim()}</strong>(으)로 인증 메일을 보냈어요.
            </p>
            <p className="m-0 text-caption text-sub">메일함(스팸함 포함)에서 인증을 마쳐 주세요.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-caption text-sub">지금 만든 가방과 팩을 그대로 두고 계정을 연결해요. 다른 기기에서도 로그인해서 쓸 수 있어요.</p>
            {error && (
              <p role="alert" className="m-0 rounded-field bg-fill px-4 py-3 text-caption text-alert">
                {error}
              </p>
            )}
            {step === "options" ? (
              <div className="flex flex-col gap-2">
                <Button variant="secondary" block disabled={busy} onClick={() => runSocial(linkAccountWithGoogle, "Google 계정으로 연결했어요")}>
                  Google로 계속하기
                </Button>
                <Button variant="secondary" block disabled={busy} onClick={() => runSocial(linkAccountWithApple, "Apple 계정으로 연결했어요")}>
                  Apple로 계속하기
                </Button>
                <Button
                  variant="secondary"
                  block
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setStep("email");
                  }}
                >
                  이메일로 가입하기
                </Button>
                <Button variant="danger" size="sm" className="mt-4 self-center" disabled={busy} onClick={() => setConfirmLogout(true)}>
                  게스트 모드 끝내기
                </Button>
              </div>
            ) : (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitEmail();
                }}
              >
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="이메일" placeholder="이메일 주소" autoComplete="email" className={FIELD} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-label="비밀번호"
                  placeholder="비밀번호 (6자 이상)"
                  autoComplete="new-password"
                  className={FIELD}
                />
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  aria-label="비밀번호 확인"
                  placeholder="비밀번호 확인"
                  autoComplete="new-password"
                  enterKeyHint="done"
                  className={FIELD}
                />
                <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
              </form>
            )}
          </div>
        )}
      </Sheet>
      <ConfirmSheet
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="게스트 모드를 끝낼까요?"
        message="회원가입 없이 나가면 지금까지 만든 가방과 팩이 모두 지워질 수 있어요."
        confirmLabel="지우고 나가기"
        danger
        onConfirm={() => {
          onClose();
          logout();
        }}
      />
    </>
  );
}
