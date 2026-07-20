"use client";

import { useAuth } from "@/contexts/AuthProvider";
import { isMasterEmail } from "@/lib/masterEmails";
import AdminLoginScreen from "@/components/admin/AdminLoginScreen";
import AdminSidebar from "@/components/admin/AdminSidebar";

// app/admin/layout.tsx에서 감싸는 게이트. 세 가지 상태를 처리한다:
// 1) 로딩 중 - 아무것도 안 보여줌(깜빡임 방지)
// 2) 비로그인 - AdminLoginScreen
// 3) 로그인했지만 마스터 이메일이 아님 - 권한 없음 안내
// 4) 마스터 이메일 - 사이드바 + 실제 화면(children)
// 실제 데이터 접근 권한은 각 app/api/admin/* 라우트가 서버에서 다시 검증하므로,
// 여기서 막는 건 어디까지나 UX용(빈 화면/에러 대신 명확한 안내)이다.
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, logout } = useAuth();

  if (loading) {
    return <div className="min-h-screen" style={{ background: "var(--background)" }} />;
  }

  if (!user) {
    return <AdminLoginScreen />;
  }

  if (!isMasterEmail(user.email)) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center"
        style={{ background: "var(--background)" }}
      >
        <p className="text-[15px] font-medium">관리자 권한이 없어요</p>
        <p className="text-[13px] text-text-secondary">
          {user.email}로 로그인되어 있어요. 운영자 계정으로 다시 로그인해주세요.
        </p>
        <button
          onClick={() => logout()}
          className="rounded-lg border border-border px-4 py-2 text-[13px] mt-2"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>
      <AdminSidebar email={user.email} nickname={profile?.nickname ?? null} />
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  );
}
