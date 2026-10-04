"use client";

import { useState } from "react";
import { IconMailCheck, IconWifiOff } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { randomAvatarId } from "@/lib/avatars";
import { randomNickname } from "@/lib/nickname";
import { friendlyAuthError } from "@/lib/authErrorMessage";
import { isElectronApp } from "@/lib/networkUtils";
import { recheckConnectivity, useConnectivity } from "@/lib/v2/connectivity";
import BackpackLogo from "@/components/BackpackLogo";
import { Button, SegmentedControl, Sheet, cx } from "@/components/v2/ui";
import { BusyOverlay } from "@/components/v2/shell/BusyOverlay";
import { AUTH_FIELD, NICK_MAX, NicknameAvatarFields } from "./NicknameAvatarFields";

type Mode = "signin" | "signup";
const MODE_OPTIONS = [
  { value: "signin" as const, label: "로그인" },
  { value: "signup" as const, label: "가입하기" },
];

// 화면 틀: 가운데 한 열, 위 안전영역, 세로로 넘치면 스크롤
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="pib-v2 pt-safe pb-safe-8 flex min-h-0 w-full flex-1 flex-col overflow-y-auto bg-canvas">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-10">{children}</div>
    </div>
  );
}

function Brand({ sub }: { sub: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <BackpackLogo size={56} />
      <h1 className="m-0 text-heading font-bold text-ink">팩인백</h1>
      <p className="m-0 text-caption text-sub">{sub}</p>
    </div>
  );
}

// 리디자인 v2 로그인·가입 화면. 구 AuthScreen과 같은 AuthProvider 함수, 같은 흐름
// (이메일 인증 메일 · 인증 다시 받기 · 비밀번호 재설정 · Google/Apple · 게스트 · 폐쇄망이면 오프라인 시작)
export default function AuthScreenV2() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, signInAsGuest, startOfflineMode, resendVerificationByCredential, sendPasswordReset } =
    useAuth();
  const { show } = useToast();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState(randomNickname);
  const [avatarId, setAvatarId] = useState(randomAvatarId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [signupDone, setSignupDone] = useState<{ sent: boolean; email: string } | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);
  // 연결 상태는 앱 공통(lib/v2/connectivity). 확인 전(unknown)에는 로고만 보여서 폐쇄망에서 폼이 스치는 깜빡임을 없애고,
  // 끊김 ↔ 연결이 바뀌면 화면도 저절로 바뀐다(폐쇄망 복구도 주기 확인으로 알아챈다)
  const connectivity = useConnectivity();
  // 오프라인 화면에서 "온라인 계정으로 로그인"을 누르면 연결과 상관없이 폼을 보여 준다
  const [forceForm, setForceForm] = useState(false);
  const online = connectivity === "unknown" ? null : connectivity === "online" || forceForm;
  // 포터블은 팝업 로그인(Google·Apple)이 안 된다 → 이메일·게스트만
  const [socialLogin] = useState(() => !isElectronApp());
  const [checking, setChecking] = useState(false);


  const mismatch = mode === "signup" && passwordConfirm.length > 0 && password !== passwordConfirm;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setNeedsVerification(false);
  };

  const submit = async () => {
    setError("");
    setNeedsVerification(false);
    if (mode === "signup") {
      if (password !== passwordConfirm) return setError("비밀번호가 서로 달라요.");
      if (!nickname.trim()) return setError("닉네임을 입력해 주세요.");
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        setSigningUp(true);
        const sent = await signUpWithEmail(email, password, nickname.trim().slice(0, NICK_MAX), avatarId);
        setSignupDone({ sent, email });
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
        setError("이메일 인증이 아직 안 됐어요. 메일함을 확인해 주세요.");
      } else {
        setError(friendlyAuthError(message));
      }
    } finally {
      setSigningUp(false);
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!email || !password) return;
    setResending(true);
    try {
      await resendVerificationByCredential(email, password);
      show("인증 메일을 다시 보냈어요. 스팸함도 확인해 주세요");
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setResending(false);
    }
  };

  const sendReset = async () => {
    if (!resetEmail.trim()) return;
    setResetSending(true);
    try {
      await sendPasswordReset(resetEmail.trim());
      show("비밀번호 재설정 메일을 보냈어요. 스팸함도 확인해 주세요");
      setResetOpen(false);
    } catch (err) {
      show(friendlyAuthError(err instanceof Error ? err.message : "") || "메일을 보내지 못했어요");
    } finally {
      setResetSending(false);
    }
  };

  const recheck = async () => {
    setChecking(true);
    const ok = (await recheckConnectivity(1500)) === "online";
    setChecking(false);
    show(ok ? "인터넷에 연결됐어요" : "아직 인터넷에 연결되지 않았어요");
  };

  if (online === null) {
    return (
      <Frame>
        <Brand sub="연결을 확인하고 있어요" />
      </Frame>
    );
  }

  if (!online) {
    return (
      <Frame>
        <div className="flex flex-col items-center gap-3 text-center">
          <span aria-hidden="true" className="inline-flex size-14 items-center justify-center rounded-full bg-fill text-sub">
            <IconWifiOff size={26} stroke={1.75} />
          </span>
          <h1 className="m-0 text-heading font-bold text-ink">인터넷에 연결되지 않았어요</h1>
          <p className="m-0 text-caption text-sub">로그인 없이 이 기기에만 저장하는 오프라인 모드로 바로 시작할 수 있어요.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button block onClick={startOfflineMode}>
            오프라인 모드로 시작
          </Button>
          <Button variant="secondary" block disabled={checking} onClick={recheck}>
            {checking ? "확인하는 중" : "연결 다시 확인"}
          </Button>
          <Button variant="text" size="sm" className="self-center" onClick={() => setForceForm(true)}>
            온라인 계정으로 로그인
          </Button>
        </div>
      </Frame>
    );
  }

  return (
    <>
      <Frame>
        <Brand sub="같이 싸는 짐 체크리스트" />

        <div className="flex flex-col gap-4">
          <SegmentedControl label="로그인 또는 가입" options={MODE_OPTIONS} value={mode} onChange={switchMode} />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-2"
          >
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="이메일" placeholder="이메일" autoComplete="email" required className={AUTH_FIELD} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="비밀번호"
              placeholder="비밀번호 (6자 이상)"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              className={AUTH_FIELD}
            />
            {mode === "signup" && (
              <>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  aria-label="비밀번호 확인"
                  aria-invalid={mismatch}
                  placeholder="비밀번호 확인"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className={cx(AUTH_FIELD, mismatch && "border-alert focus:border-alert")}
                />
                {mismatch && <p className="m-0 text-caption text-alert">비밀번호가 서로 달라요</p>}
                <div className="pt-4">
                  <NicknameAvatarFields nickname={nickname} onNickname={setNickname} avatarId={avatarId} onAvatar={setAvatarId} />
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="m-0 pt-1 text-caption text-alert">
                {error}
              </p>
            )}
            {needsVerification && (
              <Button variant="text" size="sm" className="self-start px-0" disabled={resending} onClick={resend}>
                {resending ? "보내는 중" : "인증 메일 다시 받기"}
              </Button>
            )}

            <Button type="submit" block disabled={busy || mismatch} className="mt-2">
              {mode === "signin" ? "로그인" : "가입하기"}
            </Button>
            {mode === "signin" && (
              <Button
                variant="text"
                size="sm"
                className="self-center text-sub"
                onClick={() => {
                  setResetEmail(email);
                  setResetOpen(true);
                }}
              >
                비밀번호를 잊었어요
              </Button>
            )}
          </form>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 pb-2 text-caption text-faint">
            <span className="h-px flex-1 bg-line" />
            또는
            <span className="h-px flex-1 bg-line" />
          </div>
          {socialLogin && (
            <>
              <Button variant="secondary" block disabled={busy} onClick={() => run(signInWithGoogle)}>
                Google로 계속하기
              </Button>
              <Button variant="secondary" block disabled={busy} onClick={() => run(signInWithApple)}>
                Apple로 계속하기
              </Button>
            </>
          )}
          <Button variant="text" size="sm" className="self-center text-sub" disabled={busy} onClick={() => run(signInAsGuest)}>
            로그인 없이 둘러보기
          </Button>
        </div>
      </Frame>

      {/* 비밀번호 재설정 */}
      <Sheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="비밀번호 재설정"
        footer={
          <Button block disabled={resetSending || !resetEmail.trim()} onClick={sendReset}>
            {resetSending ? "보내는 중" : "재설정 메일 보내기"}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="m-0 text-caption text-sub">가입할 때 쓴 이메일로 재설정 링크를 보내 드려요.</p>
          <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} aria-label="이메일" placeholder="이메일" autoComplete="email" className={AUTH_FIELD} />
        </div>
      </Sheet>

      {/* 가입 결과 */}
      <Sheet
        open={!!signupDone}
        onClose={() => {
          setSignupDone(null);
          switchMode("signin");
          setPassword("");
          setPasswordConfirm("");
        }}
        title={signupDone?.sent === false ? "가입했어요" : "인증 메일을 보냈어요"}
        footer={
          <Button
            block
            onClick={() => {
              setSignupDone(null);
              switchMode("signin");
              setPassword("");
              setPasswordConfirm("");
            }}
          >
            로그인하러 가기
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span aria-hidden="true" className="inline-flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
            <IconMailCheck size={24} stroke={1.75} />
          </span>
          {signupDone?.sent === false ? (
            <p className="m-0 text-body text-ink">가입은 됐지만 인증 메일을 보내지 못했어요. 잠시 뒤 로그인 화면에서 다시 받아 주세요.</p>
          ) : (
            <>
              <p className="m-0 text-body text-ink">
                <strong className="font-semibold">{signupDone?.email}</strong>(으)로 인증 메일을 보냈어요.
              </p>
              <p className="m-0 text-caption text-sub">메일함(스팸함 포함)에서 인증을 마친 뒤 로그인해 주세요.</p>
            </>
          )}
        </div>
      </Sheet>

      <BusyOverlay visible={signingUp} message="가입하고 인증 메일을 보내고 있어요" />
    </>
  );
}
