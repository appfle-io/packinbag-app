"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { friendlyAuthError } from "@/lib/authErrorMessage";
import BackpackLogo from "@/components/BackpackLogo";
import { Button } from "@/components/v2/ui";
import { ADMIN_FIELD } from "@/components/admin/AdminPage";

// 관리자 전용 로그인(가입 없음). 로그인 뒤 운영자가 아니면 AdminGate가 다시 막는다.
export default function AdminLoginScreen() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="pib-v2 pib-v2-legacy flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BackpackLogo size={48} />
          <h1 className="m-0 text-heading font-bold text-ink">팩인백 관리자</h1>
          <p className="m-0 text-caption text-sub">운영자 계정으로 로그인해 주세요</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => signInWithEmail(email, password));
          }}
          className="flex flex-col gap-2"
        >
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="이메일" placeholder="이메일" autoComplete="email" required className={ADMIN_FIELD} />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="비밀번호"
            placeholder="비밀번호"
            autoComplete="current-password"
            required
            className={ADMIN_FIELD}
          />
          {error && (
            <p role="alert" className="m-0 text-caption text-alert">
              {error}
            </p>
          )}
          <Button type="submit" block disabled={busy} className="mt-2">
            {busy ? "확인 중" : "로그인"}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-caption text-faint">
          <span className="h-px flex-1 bg-line" />
          또는
          <span className="h-px flex-1 bg-line" />
        </div>
        <Button variant="secondary" block disabled={busy} onClick={() => run(signInWithGoogle)}>
          Google로 계속하기
        </Button>
      </div>
    </div>
  );
}
