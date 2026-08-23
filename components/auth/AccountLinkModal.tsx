"use client";

import { useState } from "react";
import { IconX, IconLoader2, IconMailCheck } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { friendlyAuthError } from "@/lib/authErrorMessage";
import Portal from "@/components/Portal";
import BackpackLogo from "@/components/BackpackLogo";

export default function AccountLinkModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { linkAccountWithGoogle, linkAccountWithApple, linkAccountWithEmail } = useAuth();
  const { show } = useToast();

  const [mode, setMode] = useState<"options" | "email">("options");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emailSentSuccess, setEmailSentSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setError("");
    setBusy(true);
    try {
      await linkAccountWithGoogle();
      show("Google 계정으로 연동되었어요");
      onClose();
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
      if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        setError("이미 가입된 계정이에요. 다른 계정을 선택하거나 로그인해주세요.");
      } else {
        setError(friendlyAuthError(err instanceof Error ? err.message : ""));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleApple = async () => {
    setError("");
    setBusy(true);
    try {
      await linkAccountWithApple();
      show("Apple 계정으로 연동되었어요");
      onClose();
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
      if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        setError("이미 가입된 계정이에요. 다른 계정을 선택하거나 로그인해주세요.");
      } else {
        setError(friendlyAuthError(err instanceof Error ? err.message : ""));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 해요.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 서로 달라요.");
      return;
    }

    setBusy(true);
    try {
      const sent = await linkAccountWithEmail(email.trim(), password);
      if (sent) {
        setEmailSentSuccess(email.trim());
      } else {
        show("이메일 계정으로 연동되었어요");
        onClose();
      }
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
      if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        setError("이미 가입된 이메일이에요. 다른 이메일을 사용해주세요.");
      } else {
        setError(friendlyAuthError(err instanceof Error ? err.message : ""));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) onClose();
        }}
      >
        <div
          className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface p-5 flex flex-col gap-4 shadow-xl border border-border"
          style={{ maxHeight: "90vh", overflowY: "auto" }}
        >
          {emailSentSuccess ? (
            <div className="flex flex-col items-center text-center gap-3.5 py-2">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center mb-0.5"
                style={{ background: "var(--surface-2)", color: "var(--accent)" }}
              >
                <IconMailCheck size={26} stroke={1.75} />
              </div>
              <div>
                <p className="text-[15px] font-semibold mb-1.5">인증 메일을 발송했어요</p>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">
                  <strong style={{ color: "var(--text-primary)" }}>{emailSentSuccess}</strong>(으)로 인증 메일을 보냈어요.<br />
                  메일함(스팸함 포함) 확인 후 인증을 완료해주세요.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-lg py-2.5 text-[13.5px] font-medium mt-2"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                확인
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BackpackLogo size={24} />
                  <p className="text-[15px] font-semibold">정식 계정으로 전환</p>
                </div>
                <button
                  onClick={onClose}
                  disabled={busy}
                  className="-m-1 p-1 text-text-muted hover:text-foreground"
                  aria-label="닫기"
                >
                  <IconX size={18} stroke={1.75} />
                </button>
              </div>

              <p className="text-[12.5px] text-text-secondary leading-relaxed">
                지금 작성한 가방과 팩 데이터를 그대로 유지하며 계정을 연결해요. 다른 기기에서도 로그인하여 안전하게 사용할 수 있어요.
              </p>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-[12px] text-red-500">
                  {error}
                </div>
              )}

              {mode === "options" ? (
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={handleGoogle}
                    disabled={busy}
                    className="w-full rounded-lg border border-border py-2.5 text-[13px] font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    Google로 계속하기
                  </button>
                  <button
                    onClick={handleApple}
                    disabled={busy}
                    className="w-full rounded-lg border border-border py-2.5 text-[13px] font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    Apple로 계속하기
                  </button>
                  <button
                    onClick={() => {
                      setError("");
                      setMode("email");
                    }}
                    disabled={busy}
                    className="w-full rounded-lg border border-border py-2.5 text-[13px] text-text-secondary disabled:opacity-50"
                  >
                    이메일로 가입/연동하기
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2.5 pt-1">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일 주소"
                    autoComplete="email"
                    required
                    className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 (6자 이상)"
                    autoComplete="new-password"
                    required
                    className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
                  />
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 확인"
                    autoComplete="new-password"
                    required
                    className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
                  />

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setMode("options");
                      }}
                      disabled={busy}
                      className="flex-1 rounded-lg border border-border py-2.5 text-[13px] disabled:opacity-50"
                    >
                      이전
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="flex-1 rounded-lg py-2.5 text-[13px] font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      {busy && <IconLoader2 size={16} className="animate-spin" />}
                      연동 완료
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}
