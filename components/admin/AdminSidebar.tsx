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
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
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
  { href: "/admin/unlock-codes", label: "이용권 코드", icon: IconKey },
  { href: "/admin/announcements", label: "공지사항", icon: IconSpeakerphone },
  { href: "/admin/audit-log", label: "활동 로그", icon: IconHistory },
];

const COLLAPSE_STORAGE_KEY = "admin-sidebar-collapsed";

type AdminIdentity = {
  email: string | null;
  nickname: string | null;
};

// 메뉴 한 줄. 지금 화면은 옅은 회색 바탕 + 굵은 글자(앱 v2와 같은 미니멀 규칙)
function MenuLink({
  href,
  label,
  Icon,
  active,
  collapsed,
  onClick,
}: {
  href: string;
  label: string;
  Icon: typeof IconKey;
  active: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex h-11 items-center gap-3 overflow-hidden whitespace-nowrap rounded-field px-3 text-body transition-colors ${
        collapsed ? "justify-center" : ""
      } ${active ? "bg-fill font-semibold text-ink" : "text-sub hover:bg-fill hover:text-ink"}`}
    >
      <Icon size={20} stroke={active ? 1.9 : 1.75} className="shrink-0" aria-hidden="true" />
      {!collapsed && label}
    </Link>
  );
}

function FooterActions({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { logout } = useAuth();
  const cls = `flex h-11 w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-field px-3 text-body text-sub transition-colors hover:bg-fill hover:text-ink ${
    collapsed ? "justify-center" : ""
  }`;
  return (
    <>
      <Link href="/" onClick={onNavigate} title={collapsed ? "앱으로 돌아가기" : undefined} className={cls}>
        <IconArrowBackUp size={20} stroke={1.75} className="shrink-0" aria-hidden="true" />
        {!collapsed && "앱으로 돌아가기"}
      </Link>
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          logout();
        }}
        title={collapsed ? "로그아웃" : undefined}
        className={`${cls} bg-transparent text-left`}
      >
        <IconLogout size={20} stroke={1.75} className="shrink-0" aria-hidden="true" />
        {!collapsed && "로그아웃"}
      </button>
    </>
  );
}

// 데스크탑 사이드바 - md 이상에서만 보인다. 모바일에서는 아래 AdminMobileHeader가 같은 메뉴를 시트로 연다.
export default function AdminSidebar({ email, nickname }: AdminIdentity) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // 새로고침해도 접힘 상태가 유지되도록 localStorage에서 복원.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장된 값 복원(첫 렌더 뒤 한 번)
    if (window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1") setCollapsed(true);
  }, []);

  const toggle = () =>
    setCollapsed((prev) => {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, prev ? "0" : "1");
      return !prev;
    });

  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-canvas transition-[width] duration-200 md:flex ${
        collapsed ? "w-18" : "w-60"
      }`}
    >
      <div className={`flex items-center gap-2 px-4 pt-6 pb-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div className="min-w-0">
            <p className="m-0 text-body-lg font-bold text-ink">팩인백 관리자</p>
            <p className="m-0 truncate text-caption text-sub">{nickname ?? email}</p>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-field bg-transparent text-sub hover:bg-fill hover:text-ink"
          title={collapsed ? "펼치기" : "접기"}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {collapsed ? <IconLayoutSidebarLeftExpand size={20} stroke={1.75} /> : <IconLayoutSidebarLeftCollapse size={20} stroke={1.75} />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {MENU.map((m) => (
          <MenuLink key={m.href} href={m.href} label={m.label} Icon={m.icon} active={pathname === m.href} collapsed={collapsed} />
        ))}
      </nav>

      <div className="pb-safe-4 flex flex-col gap-1 border-t border-line px-3 pt-3">
        <FooterActions collapsed={collapsed} />
      </div>
    </aside>
  );
}

// 모바일 상단바 - md 미만에서만 보인다. 햄버거 버튼으로 같은 메뉴를 아래에서 올라오는 시트로 연다.
export function AdminMobileHeader({ email, nickname }: AdminIdentity) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = MENU.find((item) => item.href === pathname);

  return (
    <>
      <div className="sticky top-0 z-[60] flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas px-2 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          className="inline-flex size-11 items-center justify-center rounded-field bg-transparent text-ink active:bg-fill"
        >
          <IconMenu2 size={22} stroke={1.75} />
        </button>
        <span className="truncate text-body-lg font-bold text-ink">{current?.label ?? "관리자"}</span>
      </div>

      {open && (
        <Portal>
          <div className="pib-v2 pib-v2-overlay fixed inset-0 z-[200] flex items-end">
            <button type="button" aria-label="닫기" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 bg-scrim" />
            <div className="relative flex max-h-dvh-88 w-full flex-col overflow-hidden rounded-t-card bg-canvas shadow-sheet">
              <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
                <div className="min-w-0">
                  <p className="m-0 text-body-lg font-bold text-ink">팩인백 관리자</p>
                  <p className="m-0 truncate text-caption text-sub">{nickname ?? email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="닫기"
                  className="inline-flex size-11 items-center justify-center rounded-field bg-transparent text-ink active:bg-fill"
                >
                  <IconX size={20} stroke={1.9} />
                </button>
              </div>
              <nav className="flex flex-col gap-1 overflow-y-auto px-3 py-2">
                {MENU.map((m) => (
                  <MenuLink key={m.href} href={m.href} label={m.label} Icon={m.icon} active={pathname === m.href} onClick={() => setOpen(false)} />
                ))}
              </nav>
              <div className="pb-safe-4 flex flex-col gap-1 border-t border-line px-3 pt-2">
                <FooterActions onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
