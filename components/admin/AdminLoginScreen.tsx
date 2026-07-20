"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { friendlyAuthError } from "@/lib/authErrorMessage";
import BackpackLogo from "@/components/BackpackLogo";

// 일반 회원가입 UI는 없는, 관리자 전용 로그인 화면. app/admin/*는 이 화면을 통과해야만
// 진입할 수 있고, 로그인 성공 후 마스터 이메일이 아니면 AdminGate가 다시 막는다.
export default function AdminLoginScreen() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-xs flex flex-col gap-4">
        <div className="text-center mb-2 flex flex-col items-center gap-2.5">
          <BackpackLogo size={48} />
          <p className="text-[15px] font-medium">팩인백 관리자</p>
          <p className="text-[12.5px] text-text-secondary">운영자 계정으로 로그인해주세요</p>
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
            placeholder="비밀번호"
            required
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
          />
          {error && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg py-2.5 text-[14px] font-medium disabled:opacity-50 mt-1"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {busy ? "확인 중..." : "로그인"}
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
      </div>
    </div>
  );
}
