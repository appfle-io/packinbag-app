"use client";

import { useAuth } from "@/contexts/AuthProvider";
import { isMasterEmail } from "@/lib/masterEmails";
import AdminLoginScreen from "@/components/admin/AdminLoginScreen";
import AdminSidebar, { AdminMobileHeader } from "@/components/admin/AdminSidebar";

// app/admin/layout.tsx에서 감싸는 게이트. 세 가지 상태를 처리한다:
// 1) 로딩 중 - 아무것도 안 보여줌(깜빡임 방지)
// 2) 비로그인 - AdminLoginScreen
// 3) 로그인했지만 마스터 이메일이 아님 - 권한 없음 안내
// 4) 마스터 이메일 - 사이드바 + 실제 화면(children)
// 실제 데이터 접근 권한은 각 app/api/admin/* 라우트가 서버에서 다시 검증하므로,
// 여기서 막는 건 어디까지나 UX용(빈 화면/에러 대신 명확한 안내)이다.
//
// 데스크탑(md 이상)에서는 왼쪽 고정 사이드바(AdminSidebar)를 쓰고, 모바일(md 미만)에서는
// 사이드바를 숨긴 뒤 상단바 + 하단시트(AdminMobileHeader)로 같은 메뉴를 제공한다.
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, logout } = useAuth();

  if (loading) {
    return <div className="min-h-dvh" style={{ background: "var(--background)" }} />;
  }

  if (!user) {
    return <AdminLoginScreen />;
  }

  if (!isMasterEmail(user.email)) {
    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 text-center"
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

  // pb-24: 스크롤을 끝까지 내렸을 때 마지막 콘텐츠(카드/표 등)가 화면 하단에 딱 붙어서
  // 잘려 보이는 문제 방지. 모든 admin 화면(children)이 이 main을 공유하므로 여기 한 곳만
  // 고치면 대시보드/유저조회/활동로그/공지사항 관리 등에 전부 동일하게 적용된다.
  return (
    <div className="min-h-dvh flex" style={{ background: "var(--background)" }}>
      <AdminSidebar email={user.email} nickname={profile?.nickname ?? null} />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <AdminMobileHeader email={user.email} nickname={profile?.nickname ?? null} />
        <main className="flex-1 overflow-y-auto pb-24">{children}</main>
      </div>
    </div>
  );
}
