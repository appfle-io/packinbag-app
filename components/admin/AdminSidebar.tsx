"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconUserSearch,
  IconMessageQuestion,
  IconKey,
  IconSpeakerphone,
  IconHistory,
  IconLogout,
  IconChevronLeft,
  IconChevronRight,
  IconArrowBackUp,
  IconMenu2,
  IconX,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import Portal from "@/components/Portal";

const MENU = [
  { href: "/admin", label: "대시보드", icon: IconLayoutDashboard },
  { href: "/admin/users", label: "유저 조회", icon: IconUserSearch },
  { href: "/admin/inquiries", label: "문의 관리", icon: IconMessageQuestion },
  { href: "/admin/unlock-codes", label: "이용권 코드 관리", icon: IconKey },
  { href: "/admin/announcements", label: "공지사항 관리", icon: IconSpeakerphone },
  { href: "/admin/audit-log", label: "활동 로그", icon: IconHistory },
];

const COLLAPSE_STORAGE_KEY = "admin-sidebar-collapsed";

type AdminIdentity = {
  email: string | null;
  nickname: string | null;
};

// ------------------------------------------------------------------------
// 데스크탑 사이드바 - md 이상에서만 보인다(모바일에서는 아예 렌더링되지 않음,
// display:none이라 폭 계산에도 영향을 주지 않는다). 모바일에서는 아래
// AdminMobileHeader가 대신 같은 메뉴/하단 액션을 제공한다.
// ------------------------------------------------------------------------
export default function AdminSidebar({ email, nickname }: AdminIdentity) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // 새로고침해도 접힘 상태가 유지되도록 localStorage에서 복원.
  useEffect(() => {
    const saved = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (saved === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <aside
      className="hidden md:flex sticky top-0 h-dvh shrink-0 flex-col border-r transition-[width] duration-150"
      style={{ borderColor: "var(--border)", background: "var(--surface)", width: collapsed ? 64 : 224 }}
    >
      <div
        className="px-4 py-4 border-b flex items-center justify-between gap-2"
        style={{ borderColor: "var(--border)" }}
      >
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[14px] font-semibold whitespace-nowrap">팩인백 관리자</p>
            <p className="text-[11px] text-text-muted truncate mt-0.5">{nickname ?? email}</p>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          className="shrink-0 rounded-lg p-1.5 text-text-secondary hover:bg-surface-2"
          title={collapsed ? "펼치기" : "접기"}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {collapsed ? <IconChevronRight size={16} stroke={1.75} /> : <IconChevronLeft size={16} stroke={1.75} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
        {MENU.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] whitespace-nowrap overflow-hidden"
              style={{
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#fff" : "var(--foreground)",
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <Icon size={17} stroke={1.75} className="shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div
        className="px-2 py-3 border-t flex flex-col gap-0.5"
        style={{ borderColor: "var(--border)", paddingBottom: "max(12px, calc(env(safe-area-inset-bottom) + 8px))" }}
      >
        <Link
          href="/"
          title={collapsed ? "앱으로 돌아가기" : undefined}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-text-secondary whitespace-nowrap overflow-hidden"
          style={{ justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <IconArrowBackUp size={17} stroke={1.75} className="shrink-0" />
          {!collapsed && "앱으로 돌아가기"}
        </Link>
        <button
          onClick={() => logout()}
          title={collapsed ? "로그아웃" : undefined}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-text-secondary whitespace-nowrap overflow-hidden"
          style={{ justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <IconLogout size={17} stroke={1.75} className="shrink-0" />
          {!collapsed && "로그아웃"}
        </button>
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------------
// 모바일 상단바 - md 미만에서만 보인다. 데스크탑 사이드바와 같은 메뉴/하단
// 액션을 햄버거 버튼으로 열리는 하단 시트(다른 화면들의 시트류와 동일한
// 패턴)에 담아서 제공한다. 상단바 자체는 main 위에 sticky로 붙어서 스크롤
// 중에도 계속 보인다.
// ------------------------------------------------------------------------
export function AdminMobileHeader({ email, nickname }: AdminIdentity) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const current = MENU.find((item) => item.href === pathname);

  return (
    <>
      <div
        className="md:hidden sticky top-0 z-[60] shrink-0 flex items-center gap-3 px-4 border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface)", height: 52 }}
      >
        <button onClick={() => setOpen(true)} aria-label="메뉴 열기" className="-m-2 p-2">
          <IconMenu2 size={20} stroke={1.75} />
        </button>
        <span className="text-[15px] font-medium truncate">{current?.label ?? "관리자"}</span>
      </div>

      {open && (
        <Portal>
          <div
            className="fixed inset-0 z-[200] flex items-end"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-2xl flex flex-col overflow-hidden"
              style={{ background: "var(--surface)", maxHeight: "80vh" }}
            >
              <div
                className="px-4 py-3 border-b flex items-center justify-between gap-2 shrink-0"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold whitespace-nowrap">팩인백 관리자</p>
                  <p className="text-[11px] text-text-muted truncate mt-0.5">{nickname ?? email}</p>
                </div>
                <button onClick={() => setOpen(false)} aria-label="닫기" className="-m-2 p-2 shrink-0">
                  <IconX size={18} stroke={1.75} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
                {MENU.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px]"
                      style={{
                        background: active ? "var(--accent)" : "transparent",
                        color: active ? "#fff" : "var(--foreground)",
                      }}
                    >
                      <Icon size={18} stroke={1.75} className="shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div
                className="px-2 py-2 border-t flex flex-col gap-0.5 shrink-0"
                style={{
                  borderColor: "var(--border)",
                  paddingBottom: "max(12px, calc(env(safe-area-inset-bottom) + 8px))",
                }}
              >
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] text-text-secondary"
                >
                  <IconArrowBackUp size={18} stroke={1.75} className="shrink-0" />
                  앱으로 돌아가기
                </Link>
                <button
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] text-text-secondary text-left"
                >
                  <IconLogout size={18} stroke={1.75} className="shrink-0" />
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
