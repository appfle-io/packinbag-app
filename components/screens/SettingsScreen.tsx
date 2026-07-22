"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconMail,
  IconChevronRight,
  IconSpeakerphone,
  IconHelpCircle,
  IconSparkles,
  IconArrowLeft,
  IconExternalLink,
} from "@tabler/icons-react";
import { useTheme, ThemeMode } from "@/components/ThemeProvider";
import { useAuth } from "@/contexts/AuthProvider";
import { Announcement, Bag, Pack } from "@/lib/types";
import { isAnnouncementActive } from "@/lib/announcementsService";
import { isMasterEmail } from "@/lib/masterEmails";
import { APP_VERSION } from "@/lib/changelog";
import {
  AI_FREE_DAILY_LIMIT,
  currentAiUsageCount,
  isUnlimitedAiUser,
} from "@/lib/aiUsageService";
import Avatar from "@/components/Avatar";
import ProfileEditScreen from "@/components/screens/ProfileEditScreen";
import VersionInfoScreen from "@/components/screens/VersionInfoScreen";
import LicensesScreen from "@/components/screens/LicensesScreen";
import PackSettingsScreen from "@/components/screens/PackSettingsScreen";
import BagSettingsScreen from "@/components/screens/BagSettingsScreen";
import ColorSettingsScreen from "@/components/screens/ColorSettingsScreen";
import TrashScreen from "@/components/screens/TrashScreen";
import InquiryScreen from "@/components/screens/InquiryScreen";
import AnnouncementsModal from "@/components/AnnouncementsModal";
import FaqModal from "@/components/FaqModal";
import UnlockCodeDialog from "@/components/UnlockCodeDialog";
import NotificationBell from "@/components/NotificationBell";
import { useToast } from "@/components/Toast";
import SlideScreen from "@/components/SlideScreen";

const modes: { key: ThemeMode; label: string }[] = [
  { key: "system", label: "시스템" },
  { key: "light", label: "라이트" },
  { key: "dark", label: "다크" },
];

const startTabs: { key: "home" | "packs"; label: string }[] = [
  { key: "home", label: "가방보관함" },
  { key: "packs", label: "팩 보관함" },
];

type SettingsView =
  | "main"
  | "profile"
  | "version"
  | "licenses"
  | "packSettings"
  | "bagSettings"
  | "colorSettings"
  | "trash"
  | "inquiries";

// 설정은 더 이상 하단 탭이 아니라, 팩/가방 화면 헤더의 톱니바퀴 아이콘으로 열고
// 뒤로가기로 닫는 풀스크린 화면(BagEditorScreen/PackLibraryEditorScreen과 동일한 패턴)이다.
export default function SettingsScreen({
  uid,
  announcements,
  dismissedAnnouncementIds,
  onDismissAnnouncement,
  trashedBags,
  trashedPacks,
  onRestoreBag,
  onPermanentDeleteBag,
  onRestorePack,
  onPermanentDeletePack,
  onBack,
}: {
  uid: string;
  announcements: Announcement[];
  dismissedAnnouncementIds: string[];
  onDismissAnnouncement: (id: string) => void;
  onCreateAnnouncement: (data: Omit<Announcement, "id" | "createdAt">) => Promise<void>;
  onUpdateAnnouncement: (id: string, data: Partial<Announcement>) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  // 휴지통 화면용 - 내가 소유하고 휴지통으로 보낸 가방, 휴지통으로 보낸 팩 목록.
  trashedBags: Bag[];
  trashedPacks: Pack[];
  onRestoreBag: (bagId: string) => void;
  onPermanentDeleteBag: (bag: Bag) => void;
  onRestorePack: (packId: string) => void;
  onPermanentDeletePack: (packId: string) => void;
  onBack: () => void;
}) {
  const { mode, setMode } = useTheme();
  const { profile, updateDefaultTab } = useAuth();
  const { show } = useToast();
  const [view, setView] = useState<SettingsView>("main");
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [showUnlockCode, setShowUnlockCode] = useState(false);
  // v68부터 설정은 하단탭이라, 이 화면(main)에서 스와이프로 뒤로가는 것(설정->가방보관함)은
  // AppShell이 탭 전환 스와이프로 이미 처리한다. 여기서 또 useSwipeBack을 걸면 같은 제스처가
  // 두 군데서 겹쳐 처리돼서(설정->홈으로 바뀐 뒤, 그 홈 상태 기준으로 AppShell 스와이프가
  // 한 번 더 반응해 팩보관함까지 열려버리는 문제가 있었다) - 그래서 main엔 걸지 않는다.
  // 하위 화면(프로필 수정, 화면설정 등)은 진짜 스택 화면이라 각자 자기 onBack으로 따로 건다.

  const startTab = profile?.defaultTab ?? "home";
  const activeAnnouncements = announcements.filter((a) => isAnnouncementActive(a));
  const isMaster = isMasterEmail(profile?.email);
  const aiUnlimited = isUnlimitedAiUser(profile?.email, profile);
  const aiUsedCount = currentAiUsageCount(profile);
  const trashCount = trashedBags.length + trashedPacks.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="-m-2.5 p-2.5" aria-label="뒤로가기">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <h1 className="text-[18px] font-medium flex-1">설정</h1>
        <NotificationBell uid={uid} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
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
                  background: mode === key ? "var(--accent)" : "var(--surface-2)",
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
                onClick={() => updateDefaultTab(key).catch(() => show("변경사항을 저장하지 못했어요"))}
                className="flex-1 py-2 text-[13px]"
                style={{
                  background: startTab === key ? "var(--accent)" : "var(--surface-2)",
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

        <div className="mb-6">
          <p className="text-[12px] text-text-secondary mb-2">설정</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setView("colorSettings")}
              className="w-full flex items-center justify-between p-3 border-b border-border"
            >
              <span className="text-[13px]">화면설정</span>
              <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
            </button>
            <button
              onClick={() => setView("bagSettings")}
              className="w-full flex items-center justify-between p-3 border-b border-border"
            >
              <span className="text-[13px]">가방설정</span>
              <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
            </button>
            <button
              onClick={() => setView("packSettings")}
              className="w-full flex items-center justify-between p-3"
            >
              <span className="text-[13px]">팩 설정</span>
              <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
            </button>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[12px] text-text-secondary mb-2">AI 기능</p>
          <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <IconSparkles size={16} stroke={1.75} color="var(--accent)" />
              <span className="text-[13px]">
                {aiUnlimited
                  ? "무제한 이용 중"
                  : `오늘 ${aiUsedCount}/${AI_FREE_DAILY_LIMIT}회 사용`}
              </span>
            </div>
            {!aiUnlimited && (
              <button
                onClick={() => setShowUnlockCode(true)}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[12px]"
              >
                이용권 코드 입력
              </button>
            )}
          </div>
        </div>

        <div className="mb-6">
          <button
            onClick={() => setView("trash")}
            className="w-full rounded-lg border border-border flex items-center justify-between p-3"
          >
            <span className="text-[13px]">휴지통</span>
            <span className="flex items-center gap-1.5">
              {trashCount > 0 && (
                <span
                  className="text-[11px] font-medium rounded-full px-1.5 py-0.5"
                  style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                >
                  {trashCount}
                </span>
              )}
              <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
            </span>
          </button>
        </div>

        <div className="mb-6">
          <p className="text-[12px] text-text-secondary mb-2">고객지원</p>
          <div className="rounded-lg border border-border overflow-hidden">
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
              className="w-full flex items-center justify-between p-3 border-b border-border"
            >
              <span className="flex items-center gap-2 text-[13px]">
                <IconHelpCircle size={16} stroke={1.75} />
                자주 묻는 질문
              </span>
              <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
            </button>
            <button
              onClick={() => setView("inquiries")}
              className="w-full flex items-center justify-between p-3"
            >
              <span className="flex items-center gap-2 text-[13px]">
                <IconMail size={16} stroke={1.75} />
                문의하기
              </span>
              <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden mb-6">
          <button
            onClick={() => setView("version")}
            className="w-full flex items-center justify-between p-3 border-b border-border"
          >
            <span className="text-[13px]">버전 정보</span>
            <span className="flex items-center gap-1 text-[12px] text-text-muted">
              v{APP_VERSION}
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
            <Link
              href="/admin"
              className="w-full flex items-center justify-between p-3"
            >
              <span className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                <IconExternalLink size={16} stroke={1.75} />
                관리자 사이트로 이동
              </span>
              <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
            </Link>
          </div>
        )}
      </div>

      {showAnnouncements && (
        <AnnouncementsModal
          announcements={activeAnnouncements}
          dismissedIds={dismissedAnnouncementIds}
          onDismiss={onDismissAnnouncement}
          onClose={() => setShowAnnouncements(false)}
        />
      )}

      {showFaq && <FaqModal onClose={() => setShowFaq(false)} />}

      {showUnlockCode && (
        <UnlockCodeDialog
          onClose={() => setShowUnlockCode(false)}
          onSuccess={(expiresAt) => {
            setShowUnlockCode(false);
            if (!expiresAt) {
              show("이용권 코드가 적용됐어요! 이제 AI 기능을 무제한으로 쓸 수 있어요");
            } else {
              const dateLabel = new Date(expiresAt).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              });
              show(`이용권 코드가 적용됐어요! ${dateLabel}까지 AI 기능을 무제한으로 쓸 수 있어요`);
            }
          }}
        />
      )}

      <SlideScreen active={view === "profile"}>
        <ProfileEditScreen onBack={() => setView("main")} />
      </SlideScreen>
      <SlideScreen active={view === "version"}>
        <VersionInfoScreen onBack={() => setView("main")} />
      </SlideScreen>
      <SlideScreen active={view === "licenses"}>
        <LicensesScreen onBack={() => setView("main")} />
      </SlideScreen>
      <SlideScreen active={view === "packSettings"}>
        <PackSettingsScreen onBack={() => setView("main")} />
      </SlideScreen>
      <SlideScreen active={view === "bagSettings"}>
        <BagSettingsScreen onBack={() => setView("main")} />
      </SlideScreen>
      <SlideScreen active={view === "colorSettings"}>
        <ColorSettingsScreen onBack={() => setView("main")} />
      </SlideScreen>
      <SlideScreen active={view === "trash"}>
        <TrashScreen
          bags={trashedBags}
          packs={trashedPacks}
          onBack={() => setView("main")}
          onRestoreBag={onRestoreBag}
          onPermanentDeleteBag={onPermanentDeleteBag}
          onRestorePack={onRestorePack}
          onPermanentDeletePack={onPermanentDeletePack}
        />
      </SlideScreen>
      <SlideScreen active={view === "inquiries"}>
        <InquiryScreen
          uid={uid}
          nickname={profile?.nickname ?? ""}
          onBack={() => setView("main")}
        />
      </SlideScreen>
    </div>
  );
}
