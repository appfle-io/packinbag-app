"use client";

import { useState } from "react";
import { IconMail, IconChevronRight, IconSpeakerphone, IconHelpCircle } from "@tabler/icons-react";
import { useTheme, ThemeMode } from "@/components/ThemeProvider";
import { useAuth } from "@/contexts/AuthProvider";
import { Announcement } from "@/lib/types";
import { isAnnouncementActive } from "@/lib/announcementsService";
import { isMasterEmail } from "@/lib/masterEmails";
import Avatar from "@/components/Avatar";
import ProfileEditScreen from "@/components/screens/ProfileEditScreen";
import VersionInfoScreen from "@/components/screens/VersionInfoScreen";
import LicensesScreen from "@/components/screens/LicensesScreen";
import AnnouncementAdminScreen from "@/components/screens/AnnouncementAdminScreen";
import PackSettingsScreen from "@/components/screens/PackSettingsScreen";
import ColorSettingsScreen from "@/components/screens/ColorSettingsScreen";
import AnnouncementsModal from "@/components/AnnouncementsModal";
import FaqModal from "@/components/FaqModal";

const modes: { key: ThemeMode; label: string }[] = [
  { key: "system", label: "시스템" },
  { key: "light", label: "라이트" },
  { key: "dark", label: "다크" },
];

const startTabs: { key: "home" | "packs"; label: string }[] = [
  { key: "home", label: "가방 목록" },
  { key: "packs", label: "팩 라이브러리" },
];

type SettingsView = "main" | "profile" | "version" | "licenses" | "announcementAdmin" | "packSettings" | "colorSettings";

export default function SettingsScreen({
  uid,
  announcements,
  dismissedAnnouncementIds,
  onDismissAnnouncement,
  onCreateAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
}: {
  uid: string;
  announcements: Announcement[];
  dismissedAnnouncementIds: string[];
  onDismissAnnouncement: (id: string) => void;
  onCreateAnnouncement: (data: Omit<Announcement, "id" | "createdAt">) => Promise<void>;
  onUpdateAnnouncement: (id: string, data: Partial<Announcement>) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
}) {
  const { mode, setMode } = useTheme();
  const { profile, updateDefaultTab } = useAuth();
  const [view, setView] = useState<SettingsView>("main");
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showFaq, setShowFaq] = useState(false);

  if (view === "profile") {
    return <ProfileEditScreen onBack={() => setView("main")} />;
  }
  if (view === "version") {
    return <VersionInfoScreen onBack={() => setView("main")} />;
  }
  if (view === "licenses") {
    return <LicensesScreen onBack={() => setView("main")} />;
  }
  if (view === "packSettings") {
    return <PackSettingsScreen onBack={() => setView("main")} />;
  }
  if (view === "colorSettings") {
    return <ColorSettingsScreen onBack={() => setView("main")} />;
  }
  if (view === "announcementAdmin") {
    return (
      <AnnouncementAdminScreen
        announcements={announcements}
        uid={uid}
        onBack={() => setView("main")}
        onCreate={onCreateAnnouncement}
        onUpdate={onUpdateAnnouncement}
        onDelete={onDeleteAnnouncement}
      />
    );
  }

  const startTab = profile?.defaultTab ?? "home";
  const activeAnnouncements = announcements.filter((a) => isAnnouncementActive(a));
  const isMaster = isMasterEmail(profile?.email);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h1 className="text-[18px] font-medium mb-4">설정</h1>

      {profile && (
        <button
          onClick={() => setView("profile")}
          className="w-full mb-6 rounded-lg border border-border bg-surface p-3 flex items-center gap-3"
        >
          <Avatar avatarId={profile.avatarId} size={40} />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[14px] font-medium truncate">
              {profile.nickname ?? "닉네임 설정하기"}
            </p>
            <p className="text-[12px] text-text-secondary truncate">
              {profile.email}
            </p>
          </div>
          <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
        </button>
      )}

      <div className="mb-6">
        <p className="text-[12px] text-text-secondary mb-2">화면 모드</p>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {modes.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className="flex-1 py-2 text-[13px]"
              style={{
                background: mode === key ? "var(--accent)" : "var(--surface)",
                color: mode === key ? "#fff" : "var(--foreground)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <p className="text-[12px] text-text-secondary mb-2">시작 화면</p>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {startTabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => updateDefaultTab(key).catch(() => {})}
              className="flex-1 py-2 text-[13px]"
              style={{
                background: startTab === key ? "var(--accent)" : "var(--surface)",
                color: startTab === key ? "#fff" : "var(--foreground)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-text-muted mt-2">
          앱을 열었을 때 처음 보여줄 화면이에요
        </p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden mb-6">
        <button
          onClick={() => setView("colorSettings")}
          className="w-full flex items-center justify-between p-3"
        >
          <span className="text-[13px]">화면설정</span>
          <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden mb-6">
        <button
          onClick={() => setView("packSettings")}
          className="w-full flex items-center justify-between p-3"
        >
          <span className="text-[13px]">팩 설정</span>
          <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden mb-6">
        <button
          onClick={() => setShowAnnouncements(true)}
          className="w-full flex items-center justify-between p-3 border-b border-border"
        >
          <span className="flex items-center gap-2 text-[13px]">
            <IconSpeakerphone size={16} stroke={1.75} />
            공지사항
          </span>
          <span className="flex items-center gap-1">
            {activeAnnouncements.some((a) => !dismissedAnnouncementIds.includes(a.id)) && (
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--danger)" }} />
            )}
            <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
          </span>
        </button>
        <button
          onClick={() => setShowFaq(true)}
          className="w-full flex items-center justify-between p-3"
        >
          <span className="flex items-center gap-2 text-[13px]">
            <IconHelpCircle size={16} stroke={1.75} />
            자주 묻는 질문
          </span>
          <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden mb-6">
        <a
          href="mailto:appfle.dev@gmail.com?subject=팩인백 문의"
          className="flex items-center justify-between p-3 border-b border-border"
        >
          <span className="flex items-center gap-2 text-[13px]">
            <IconMail size={16} stroke={1.75} />
            문의하기
          </span>
          <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
        </a>
      </div>

      <div className="rounded-lg border border-border overflow-hidden mb-6">
        <button
          onClick={() => setView("version")}
          className="w-full flex items-center justify-between p-3 border-b border-border"
        >
          <span className="text-[13px]">버전 정보</span>
          <span className="flex items-center gap-1 text-[12px] text-text-muted">
            v1.0.0
            <IconChevronRight size={16} stroke={1.75} />
          </span>
        </button>
        <button
          onClick={() => setView("licenses")}
          className="w-full flex items-center justify-between p-3"
        >
          <span className="text-[13px]">오픈소스 라이선스</span>
          <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
        </button>
      </div>

      {isMaster && (
        <div className="rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView("announcementAdmin")}
            className="w-full flex items-center justify-between p-3"
          >
            <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              공지사항 관리 (운영자)
            </span>
            <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
          </button>
        </div>
      )}

      {showAnnouncements && (
        <AnnouncementsModal
          announcements={activeAnnouncements}
          dismissedIds={dismissedAnnouncementIds}
          onDismiss={onDismissAnnouncement}
          onClose={() => setShowAnnouncements(false)}
        />
      )}

      {showFaq && <FaqModal onClose={() => setShowFaq(false)} />}
    </div>
  );
}
