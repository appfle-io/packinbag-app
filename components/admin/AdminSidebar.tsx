"use client";

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
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";

const MENU = [
  { href: "/admin", label: "대시보드", icon: IconLayoutDashboard },
  { href: "/admin/users", label: "유저 조회", icon: IconUserSearch },
  { href: "/admin/inquiries", label: "문의 관리", icon: IconMessageQuestion },
  { href: "/admin/unlock-codes", label: "이용권 코드 관리", icon: IconKey },
  { href: "/admin/announcements", label: "공지사항 관리", icon: IconSpeakerphone },
  { href: "/admin/audit-log", label: "활동 로그", icon: IconHistory },
];

export default function AdminSidebar({
  email,
  nickname,
}: {
  email: string | null;
  nickname: string | null;
}) {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <p className="text-[14px] font-semibold">팩인백 관리자</p>
        <p className="text-[11px] text-text-muted truncate mt-0.5">{nickname ?? email}</p>
      </div>

      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        {MENU.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px]"
              style={{
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#fff" : "var(--foreground)",
              }}
            >
              <Icon size={17} stroke={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-text-secondary"
        >
          <IconLogout size={17} stroke={1.75} />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
