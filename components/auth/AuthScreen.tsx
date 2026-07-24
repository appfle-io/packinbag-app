"use client";

import { useState } from "react";
import { IconRefresh, IconLoader2, IconMailCheck } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { AVATAR_OPTIONS, randomAvatarId } from "@/lib/avatars";
import { randomNickname } from "@/lib/nickname";
import { friendlyAuthError } from "@/lib/authErrorMessage";
import Avatar from "@/components/Avatar";
import BackpackLogo from "@/components/BackpackLogo";
import Portal from "@/components/Portal";

// 가방 생성/이용권 동기화 등 앱 내 기존 오버레이(CreatingBagOverlay 등)와 동일한 로딩 화면
function AuthLoadingOverlay({ visible, message }: { visible: boolean; message: string }) {
  return (
    <div
      className="fixed inset-0 z-[210] flex flex-col items-center justify-center gap-3"
      style={{
        background: "var(--background)",
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <IconLoader2 size={28} stroke={1.75} color="var(--text-muted)" className="animate-spin" />
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {message}
      </span>
    </div>
  );
}

export default function AuthScreen() {
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    resendVerificationByCredential,
    sendPasswordReset,
  } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState(randomNickname);
  const [avatarId, setAvatarId] = useState(randomAvatarId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signUpModalInfo, setSignUpModalInfo] = useState<{
    sent: boolean;
    email: string;
  } | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const { show } = useToast();

  const passwordMismatch =
    mode === "signup" && passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);

    if (mode === "signup") {
      if (password !== passwordConfirm) {
        setError("비밀번호가 서로 달라요. 다시 확인해주세요.");
        return;
      }
      if (!nickname.trim()) {
        setError("닉네임을 입력해주세요.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        setSignupLoading(true);
        const sent = await signUpWithEmail(
          email,
          password,
          nickname.trim().slice(0, 12),
          avatarId
        );
        // 가입 및 발송 완료 시 바로 로그인 탭으로 훽 넘가지 않고, 모달로 결과를 알림
        setSignUpModalInfo({ sent, email });
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
        setError("이메일 인증이 아직 완료되지 않았어요. 메일함을 확인해주세요.");
      } else {
        setError(friendlyAuthError(message));
      }
    } finally {
      setSignupLoading(false);
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email || !password) return;
    setResendingVerification(true);
    try {
      await resendVerificationByCredential(email, password);
      show("인증 메일을 다시 보냈어요. 메일함(스팸함도) 확인해주세요");
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setResendingVerification(false);
    }
  };

  const handleSendReset = async () => {
    if (!resetEmail.trim()) return;
    setResetSending(true);
    try {
      await sendPasswordReset(resetEmail.trim());
      show("비밀번호 재설정 메일을 보냈어요. 메일함(스팸함도) 확인해주세요");
      setShowForgotPassword(false);
    } catch (err) {
      show(friendlyAuthError(err instanceof Error ? err.message : "") || "메일 발송에 실패했어요.");
    } finally {
      setResetSending(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const handleApple = async () => {
    setError("");
    setBusy(true);
    try {
      await signInWithApple();
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-xs flex flex-col gap-4 py-6">
          <div className="text-center mb-2 flex flex-col items-center gap-2.5">
            <BackpackLogo size={56} />
            <p className="text-[15px] font-medium">비밀번호 재설정</p>
            <p className="text-[12.5px] text-text-secondary">
              가입할 때 쓴 이메일로 재설정 링크를 보내드려요
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="이메일"
              required
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
            />
            <button
              type="button"
              onClick={handleSendReset}
              disabled={resetSending || !resetEmail.trim()}
              className="rounded-lg py-2.5 text-[14px] font-medium disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {resetSending ? "보내는 중..." : "재설정 메일 보내기"}
            </button>
            <button
              type="button"
              onClick={() => setShowForgotPassword(false)}
              className="text-[12px] text-text-secondary mt-1"
            >
              로그인 화면으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-xs flex flex-col gap-4 py-6">
          <div className="text-center mb-2 flex flex-col items-center gap-2.5">
            <BackpackLogo size={56} />
            <p className="text-[13px] text-text-secondary">
              {mode === "signin" ? "로그인하고 계속하기" : "새 계정 만들기"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              required
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 (6자 이상)"
              required
              minLength={6}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
            />

            {mode === "signin" && (
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setShowForgotPassword(true);
                }}
                className="self-end text-[11.5px] -mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                비밀번호를 잊으셨나요?
              </button>
            )}

            {mode === "signup" && (
              <>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호 확인"
                  required
                  minLength={6}
                  className="rounded-lg border px-3 py-2 text-[13px] outline-none bg-surface-2"
                  style={{
                    borderColor: passwordMismatch ? "var(--danger)" : "var(--border)",
                  }}
                />
                {passwordMismatch && (
                  <p className="text-[11px] -mt-1" style={{ color: "var(--danger)" }}>
                    비밀번호가 서로 달라요.
                  </p>
                )}

                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value.slice(0, 12))}
                    placeholder="닉네임 (12자 이내)"
                    maxLength={12}
                    className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNickname(randomNickname())}
                    aria-label="닉네임 새로 추천받기"
                    className="rounded-lg border border-border p-2 shrink-0"
                  >
                    <IconRefresh size={15} stroke={1.75} />
                  </button>
                </div>

                <div>
                  <p className="text-[11px] text-text-muted mb-1.5">
                    캐릭터를 하나 골라주세요
                  </p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {AVATAR_OPTIONS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAvatarId(a.id)}
                        className="rounded-full p-0.5"
                        style={{
                          boxShadow:
                            avatarId === a.id ? "0 0 0 2px var(--accent)" : "none",
                        }}
                      >
                        <Avatar avatarId={a.id} size={30} />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {error && (
              <p className="text-[12px]" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}

            {needsVerification && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendingVerification}
                className="self-start text-[12px] font-medium disabled:opacity-50 -mt-1"
                style={{ color: "var(--accent)" }}
              >
                {resendingVerification ? "보내는 중..." : "인증 메일 다시 받기"}
              </button>
            )}

            <button
              type="submit"
              disabled={busy || passwordMismatch}
              className="rounded-lg py-2.5 text-[14px] font-medium disabled:opacity-50 mt-1"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {mode === "signin" ? "로그인" : "가입하기"}
            </button>
          </form>

          <div className="flex items-center gap-2 text-[12px] text-text-muted">
            <div className="flex-1 h-px bg-border" />
            또는
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="rounded-lg border border-border py-2.5 text-[13px] disabled:opacity-50"
          >
            Google로 계속하기
          </button>

          <button
            onClick={handleApple}
            disabled={busy}
            className="rounded-lg border border-border py-2.5 text-[13px] disabled:opacity-50"
          >
            Apple로 계속하기
          </button>

          <button
            onClick={() => {
              setError("");
              setNeedsVerification(false);
              setMode(mode === "signin" ? "signup" : "signin");
            }}
            className="text-[12px] text-text-secondary mt-1"
          >
            {mode === "signin"
              ? "계정이 없으신가요? 가입하기"
              : "이미 계정이 있으신가요? 로그인"}
          </button>
        </div>
      </div>

      <AuthLoadingOverlay
        visible={signupLoading}
        message="가입을 진행하고 인증 메일을 보냈어요..."
      />

      {signUpModalInfo && (
        <Portal>
          <div
            className="fixed inset-0 z-[215] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.45)" }}
          >
            <div className="w-full max-w-xs rounded-2xl bg-surface p-5 flex flex-col items-center text-center gap-3.5 shadow-xl">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center mb-0.5"
                style={{ background: "var(--surface-2)", color: "var(--accent)" }}
              >
                <IconMailCheck size={26} stroke={1.75} />
              </div>
              <div>
                <p className="text-[15px] font-semibold mb-1.5">
                  {signUpModalInfo.sent ? "인증 메일을 발송했어요" : "가입 완료"}
                </p>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">
                  {signUpModalInfo.sent ? (
                    <>
                      <strong style={{ color: "var(--text-primary)" }}>{signUpModalInfo.email}</strong>(으)로 인증 메일을 보냈어요.<br />
                      메일함(스팸함 포함) 확인 후 인증을 완료하고 로그인해주세요.
                    </>
                  ) : (
                    "가입은 완료됐지만 인증 메일 발송에 실패했어요. 잠시 후 로그인 화면에서 재발송해주세요."
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  setSignUpModalInfo(null);
                  setMode("signin");
                  setPassword("");
                  setPasswordConfirm("");
                }}
                className="w-full rounded-lg py-2.5 text-[13.5px] font-medium mt-1"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                로그인 화면으로 이동
              </button>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

