"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StartPageSelectModal from "@/components/StartPageSelectModal";
import {
  IconChevronRight,
  IconArrowLeft,
  IconDownload,
  IconUpload,
} from "@tabler/icons-react";
import dynamic from "next/dynamic";
import { useTheme, ThemeMode } from "@/components/ThemeProvider";

const TemplateInspectLogsModal = dynamic(
  () => import("@/components/TemplateInspectLogsModal"),
  { ssr: false }
);
import { useAuth } from "@/contexts/AuthProvider";
import { Announcement, Bag, Pack } from "@/lib/types";
import { isAnnouncementActive } from "@/lib/announcementsService";
import { isPremiumUser } from "@/lib/premiumLimits";
import { APP_VERSION } from "@/lib/changelog";
import {
  AI_FREE_DAILY_LIMIT,
  currentAiUsageCount,
  isUnlimitedAiUser,
} from "@/lib/aiUsageService";
import { exportBackupData, parseBackupFile, restoreBackupData } from "@/lib/backupService";
import { getLocalBags, getLocalLibraryPacks, resetLocalAllData } from "@/lib/localBagsService";
import { deleteBagWithInviteCodeRemote, leaveBagRemote } from "@/lib/bagsService";
import { deleteLibraryPackRemote } from "@/lib/packsService";
import { deleteBagImage } from "@/lib/storageService";
import Avatar from "@/components/Avatar";
import ProfileEditScreen from "@/components/screens/ProfileEditScreen";
import VersionInfoScreen from "@/components/screens/VersionInfoScreen";
import LicensesScreen from "@/components/screens/LicensesScreen";
import PackSettingsScreen from "@/components/screens/PackSettingsScreen";
import BagSettingsScreen from "@/components/screens/BagSettingsScreen";
import ColorSettingsScreen from "@/components/screens/ColorSettingsScreen";
import TrashScreen from "@/components/screens/TrashScreen";
import InquiryScreen from "@/components/screens/InquiryScreen";
import GuideScreen from "@/components/screens/GuideScreen";
import InstallGuideScreen from "@/components/screens/InstallGuideScreen";
import AnnouncementsModal from "@/components/AnnouncementsModal";
import FaqModal from "@/components/FaqModal";
import UnlockCodeDialog from "@/components/UnlockCodeDialog";
import MyShortLinksModal from "@/components/MyShortLinksModal";
import NotificationBell from "@/components/NotificationBell";
import ToggleSwitch from "@/components/ToggleSwitch";
import { useToast } from "@/components/Toast";
import SlideScreen from "@/components/SlideScreen";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import AccountLinkModal from "@/components/auth/AccountLinkModal";
import ConfirmDialog from "@/components/ConfirmDialog";

const modes: { key: ThemeMode; label: string }[] = [
  { key: "system", label: "시스템" },
  { key: "light", label: "라이트" },
  { key: "dark", label: "다크" },
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
  | "inquiries"
  | "guide"
  | "installGuide";

// 데스크탑 모달 안에서는 하위화면이 SlideScreen(포털로 전체 화면을 덤는 오버레이)이 아니라
// 이 모달 박스 안에만 머무는 전환이어야 한다 - 그래서 포털을 쓰지 않고 가장 가까운
// 부모(SettingsScreen 자체의 relative 컴테이너)에 그대로 생기는 absolute 오버레이로 구현한다.
// SlideScreen과 동일한 진입/퇴장 애니메이션 로직을 그대로 따른다.
const CONTAINED_TRANSITION_MS = 260;

function ContainedSlide({
  active,
  onBackdropClick,
  children,
}: {
  active: boolean;
  // SlideScreen과 동일한 prop 이름으로 맞춰서, 데스크탑(ContainedSlide)/모바일(SlideScreen)
  // 어느 쪽이 쓰이든 호출부는 그대로 onBackdropClick 하나만 넘기면 된다. 여기서는 시각적
  // 백드롭이 없어서 클릭으로는 쓰이지 않지만, 데스크탑에서 Esc를 누르면 이 콜백으로 뒤로가기가 되게 한다.
  onBackdropClick?: () => void;
  children: React.ReactNode;
}) {
  const [shouldRender, setShouldRender] = useState(active);
  const [entered, setEntered] = useState(false);
  useEscapeToClose(onBackdropClick, active);

  useEffect(() => {
    if (active) {
      setShouldRender(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const t = window.setTimeout(() => setShouldRender(false), CONTAINED_TRANSITION_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!shouldRender) return null;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{
        background: "var(--background)",
        transform: entered ? "translateX(0%)" : "translateX(100%)",
        transition: `transform ${CONTAINED_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
    >
      {children}
    </div>
  );
}

// 설정은 더 이상 하단 탭이 아니라, 팩/가방 화면 헤더의 톱니바퀴 아이콘으로 열고
// 뒤로가기로 닫는 풀스크린 화면(BagEditorScreen/PackLibraryEditorScreen과 동일한 패턴)이다.
export default function SettingsScreen({
  uid,
  bags,
  libraryPacks,
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
  hideNotificationBell,
  embedded,
}: {
  uid: string;
  bags?: Bag[];
  libraryPacks?: Pack[];
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
  hideNotificationBell?: boolean;
  embedded?: boolean;
}) {
  const { mode, setMode } = useTheme();
  const {
    user,
    profile,
    isMaster,
    updateDefaultTab,
    updateStartPage,
    updateShortUrlEnabled,
    isGuest,
    logout,
    isOfflineMode,
    exitOfflineMode,
  } = useAuth();
  const { show } = useToast();
  const [view, setView] = useState<SettingsView>("main");
  const [showStartPageModal, setShowStartPageModal] = useState(false);
  const [showInspectLogsModal, setShowInspectLogsModal] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [showUnlockCode, setShowUnlockCode] = useState(false);
  const [showMyShortLinks, setShowMyShortLinks] = useState(false);
  const [showAccountLinkModal, setShowAccountLinkModal] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  // v68부터 설정은 하단탭이라, 이 화면(main)에서 스와이프로 뒤로가는 것(설정->가방보관함)은
  // AppShell이 탭 전환 스와이프로 이미 처리한다. 여기서 또 useSwipeBack을 걸면 같은 제스처가
  // 두 군데서 겹쳐 처리돼서(설정->홈으로 바뀐 뒤, 그 홈 상태 기준으로 AppShell 스와이프가
  // 한 번 더 반응해 팩보관함까지 열려버리는 문제가 있었다) - 그래서 main엔 걸지 않는다.
  // 하위 화면(프로필 수정, 화면설정 등)은 진짜 스택 화면이라 각자 자기 onBack으로 따로 건다.

  const handleExportBackup = () => {
    const currentBags = bags ?? (isOfflineMode ? getLocalBags() : []);
    const currentPacks = libraryPacks ?? (isOfflineMode ? getLocalLibraryPacks() : []);
    exportBackupData(currentBags, currentPacks);
    show("백업 파일을 다운로드했어요");
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseBackupFile(file);
      const result = await restoreBackupData(
        parsed,
        isOfflineMode ? "local" : "cloud",
        user,
        {
          nickname: profile?.nickname || user?.displayName || "사용자",
          avatarId: profile?.avatarId || "avatar-1",
        }
      );
      if (isOfflineMode && result.hasExcludedRemoteMedia) {
        show(
          `가방 ${result.restoredBagsCount}개, 팩 ${result.restoredPacksCount}개를 복원했어요 (오프라인 환경에서는 온라인 이미지/파일은 제외되었어요)`
        );
      } else {
        show(`가방 ${result.restoredBagsCount}개, 팩 ${result.restoredPacksCount}개를 복원했어요`);
      }
    } catch (err) {
      console.error("[팩인백] 백업 복원 실패:", err);
      show(err instanceof Error ? err.message : "백업 파일을 불러오지 못했어요");
    } finally {
      e.target.value = "";
    }
  };

  const [confirmReset, setConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetAllData = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      if (isOfflineMode) {
        resetLocalAllData();
        show("모든 데이터가 초기화되었어요");
      } else {
        if (trashedBags && onPermanentDeleteBag) {
          for (const bag of trashedBags) {
            await onPermanentDeleteBag(bag);
          }
        }
        if (trashedPacks && onPermanentDeletePack) {
          for (const pack of trashedPacks) {
            await onPermanentDeletePack(pack.id);
          }
        }
        if (libraryPacks && uid) {
          for (const p of libraryPacks) {
            await deleteLibraryPackRemote(uid, p.id);
          }
        }
        if (bags) {
          for (const bag of bags) {
            if (bag.memberIds.length <= 1) {
              await Promise.all((bag.images ?? []).map((url) => deleteBagImage(url)));
              await deleteBagWithInviteCodeRemote(bag);
            } else if (uid) {
              await leaveBagRemote(uid, bag.id);
            }
          }
        }
        show("모든 데이터가 초기화되었어요");
      }
    } catch (err) {
      console.error("[팩인백] 데이터 초기화 실패:", err);
      show("데이터 초기화에 실패했어요");
    } finally {
      setIsResetting(false);
      setConfirmReset(false);
    }
  };
  const startPageConfig = profile?.startPage;
  const startPageLabel = useMemo(() => {
    if (!startPageConfig || startPageConfig.type === "home") {
      return "가방 보관함 (기본)";
    }
    if (startPageConfig.type === "packs") return "팩 보관함";
    if (startPageConfig.type === "bag") {
      const bag = (bags || []).find((b) => b.id === startPageConfig.id);
      return bag ? `[가방] ${bag.name}` : "가방 보관함 (기본)";
    }
    if (startPageConfig.type === "pack") {
      const pack = (libraryPacks || []).find((p) => p.id === startPageConfig.id);
      return pack ? `${pack.kind === "editor" ? "[메모]" : "[팩]"} ${pack.name}` : "가방 보관함 (기본)";
    }
    return "가방 보관함 (기본)";
  }, [startPageConfig, bags, libraryPacks]);
  const activeAnnouncements = announcements.filter((a) => isAnnouncementActive(a));
  const aiUnlimited = isUnlimitedAiUser(profile?.email, profile);
  const premium = isPremiumUser(profile?.email, profile);
  const aiUsedCount = currentAiUsageCount(profile);
  const trashCount = trashedBags.length + trashedPacks.length;

  // 데스크탑 모달 안에서는 ContainedSlide(모달 박스 안에만 머무는 전환)를, 모바일에서는 기존처럼
  // SlideScreen(전체 화면 포털 오버레이)을 쓴다.
  const Slide = embedded ? ContainedSlide : SlideScreen;

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="-m-2.5 p-2.5" aria-label="뒤로가기">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <h1 className="text-[18px] font-medium flex-1">설정</h1>
        {!hideNotificationBell && !isOfflineMode && <NotificationBell uid={uid} />}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {profile && (
          <div className="mb-6 rounded-lg border border-border bg-surface p-3 flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <Avatar avatarId={profile.avatarId} size={40} />
              <button
                onClick={() => {
                  if (isGuest) {
                    setShowAccountLinkModal(true);
                  } else {
                    setView("profile");
                  }
                }}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-medium truncate">
                    {profile.nickname ?? (isOfflineMode ? "오프라인 사용자" : "닉네임 설정하기")}
                  </p>
                  {isOfflineMode && (
                    <span
                      className="shrink-0 text-[10px] font-medium rounded px-1.5 py-0.5"
                      style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                    >
                      오프라인 모드
                    </span>
                  )}
                  {!isOfflineMode && isGuest && (
                    <span
                      className="shrink-0 text-[10px] font-medium rounded px-1.5 py-0.5"
                      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                    >
                      게스트
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-text-secondary truncate mt-0.5">
                  {isOfflineMode
                    ? "데이터가 이 기기에만 안전하게 저장돼요"
                    : isGuest
                    ? "기기에만 저장됨 (계정 연동하기)"
                    : profile.email}
                </p>
              </button>
              <button
                onClick={() => setView("profile")}
                className="p-1.5 rounded-md hover:bg-surface-2 text-text-muted hover:text-foreground text-[12px] shrink-0"
                title="프로필 수정"
              >
                <IconChevronRight size={16} stroke={1.75} />
              </button>
            </div>

            {!isOfflineMode && isGuest && (
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAccountLinkModal(true)}
                  className="flex-1 py-1.5 px-2 rounded-md bg-accent-soft text-accent text-[12px] font-medium text-center hover:opacity-90 transition-opacity"
                >
                  계정 연동하기
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmLogout(true)}
                  className="py-1.5 px-2.5 rounded-md border border-border bg-surface-2 text-red-500 text-[12px] text-center hover:bg-red-500/10 transition-colors"
                >
                  게스트 종료
                </button>
              </div>
            )}
          </div>
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
          <div className="rounded-lg border border-border p-3 flex items-center justify-between bg-surface-2">
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-[13px] font-medium truncate">{startPageLabel}</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                앱을 열었을 때 처음 보여줄 화면이에요
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowStartPageModal(true)}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-surface border border-border hover:bg-surface-2 transition-colors shrink-0"
            >
              설정
            </button>
          </div>
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

        {!isOfflineMode && (
          <div className="mb-6">
            <p className="text-[12px] text-text-secondary mb-2">AI 기능</p>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="p-3 flex items-center justify-between gap-3 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px]">
                    {aiUnlimited
                      ? "무제한 이용 중"
                      : `오늘 ${aiUsedCount}/${AI_FREE_DAILY_LIMIT}회 사용`}
                  </span>
                </div>
                {!aiUnlimited && (
                  <button
                    onClick={() => {
                      if (isGuest) {
                        show("회원가입 후 이용권을 등록할 수 있어요");
                        setShowAccountLinkModal(true);
                        return;
                      }
                      setShowUnlockCode(true);
                    }}
                    className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[12px]"
                  >
                    이용권 코드 입력
                  </button>
                )}
              </div>

              <div className="p-3 flex items-center justify-between gap-3 border-b border-border">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium">짧은 URL 사용하기</span>
                    {!premium && (
                      <span
                        className="shrink-0 text-[10px] font-medium rounded px-1.5 py-0.5"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                      >
                        프리미엄
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">
                    짐이나 메모에 긴 링크를 붙여넣으면 자동으로 짧은 URL로 바꿔드려요.
                  </p>
                </div>
                <ToggleSwitch
                  checked={premium && !!profile?.shortUrlEnabled}
                  disabled={!premium}
                  onChange={(next) => updateShortUrlEnabled(next).catch(() => show("변경사항을 저장하지 못했어요"))}
                  ariaLabel="짧은 URL 사용하기"
                />
              </div>
              <button
                onClick={() => setShowMyShortLinks(true)}
                className="w-full flex items-center justify-between p-3"
              >
                <span className="text-[13px]">내가 만든 URL 관리</span>
                <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
              </button>
            </div>
          </div>
        )}

        <div className="mb-6">
          <button
            onClick={() => setView("trash")}
            className="w-full rounded-lg border border-border flex items-center justify-between p-3"
          >
            <span className="text-[13px]">휴지통</span>
            <span className="flex items-center gap-1.5">
              {trashCount > 0 && (
                <span
                  className="text-[11px] font-medium rounded px-1.5 py-0.5"
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
          <p className="text-[12px] text-text-secondary mb-2">데이터 백업 및 복원</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <button
              onClick={handleExportBackup}
              className="w-full flex items-center justify-between p-3 border-b border-border hover:bg-surface-2 transition-colors text-left"
            >
              <div>
                <span className="text-[13px] font-medium">백업 파일 내보내기 (.json)</span>
                <p className="text-[11px] text-text-muted mt-0.5">
                  현재 가방과 팩 데이터를 백업 파일로 저장해요
                </p>
              </div>
              <IconDownload size={18} stroke={1.75} color="var(--text-muted)" />
            </button>
            <label className="w-full flex items-center justify-between p-3 hover:bg-surface-2 transition-colors cursor-pointer text-left">
              <div>
                <span className="text-[13px] font-medium">백업 파일 불러오기</span>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {isOfflineMode
                    ? "백업 파일(.json)에서 복원해요 (온라인 이미지/파일 제외)"
                    : "백업 파일(.json)에서 가방과 팩을 복원해요"}
                </p>
              </div>
              <IconUpload size={18} stroke={1.75} color="var(--text-muted)" />
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportBackup}
              />
            </label>
          </div>
        </div>

        {!isOfflineMode && (
          <div className="mb-6">
            <p className="text-[12px] text-text-secondary mb-2">가이드 & 고객지원</p>
            <div className="rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setView("guide")}
                className="w-full flex items-center justify-between p-3 border-b border-border bg-accent-soft/10 text-left hover:bg-accent-soft/20 transition-colors"
              >
                <span className="text-[13px] font-medium text-foreground">팩인백 사용 가이드</span>
                <IconChevronRight size={16} stroke={1.75} color="var(--accent)" />
              </button>
              <button
                onClick={() => setView("installGuide")}
                className="w-full flex items-center justify-between p-3 border-b border-border text-left hover:bg-surface-2 transition-colors"
              >
                <span className="text-[13px]">앱 설치 방법 (크롬 / 사파리)</span>
                <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
              </button>
              <button
                onClick={() => setShowAnnouncements(true)}
                className="w-full flex items-center justify-between p-3 border-b border-border"
              >
                <span className="text-[13px]">공지사항</span>
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
                <span className="text-[13px]">자주 묻는 질문</span>
                <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
              </button>
              <button
                onClick={() => setView("inquiries")}
                className="w-full flex items-center justify-between p-3"
              >
                <span className="text-[13px]">문의하기</span>
                <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" />
              </button>
            </div>
          </div>
        )}

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

        {!isOfflineMode && isMaster && (
          <div className="mb-2">
            <p className="text-[12px] font-semibold text-accent mb-2">관리자 전용 메뉴</p>
            <div className="rounded-lg border border-accent/40 bg-accent/5 overflow-hidden">
              <button
                onClick={() => setShowInspectLogsModal(true)}
                className="w-full flex items-center justify-between p-3 border-b border-accent/20"
              >
                <span className="text-[13px] font-medium text-text-primary">
                  템플릿 공유 등록 모니터링
                </span>
                <IconChevronRight size={16} stroke={1.75} color="var(--accent)" />
              </button>
              <Link
                href="/admin"
                className="w-full flex items-center justify-between p-3"
              >
                <span className="text-[13px] font-medium text-text-primary">
                  관리자 사이트로 이동
                </span>
                <IconChevronRight size={16} stroke={1.75} color="var(--accent)" />
              </Link>
            </div>
          </div>
        )}

        <div className="pt-2 pb-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-[12px] text-danger/80 hover:text-danger underline decoration-dotted transition-colors"
          >
            데이터 초기화
          </button>

          {isOfflineMode ? (
            <button
              type="button"
              onClick={exitOfflineMode}
              className="rounded-md border border-border px-4 py-2 text-[12px] text-text-muted hover:text-foreground transition-colors"
            >
              오프라인 모드 종료
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="rounded-md border border-border px-4 py-2 text-[12px] text-text-muted hover:text-red-500 transition-colors"
            >
              {isGuest ? "게스트 모드 종료 (로그아웃)" : "로그아웃"}
            </button>
          )}
        </div>
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

      {showMyShortLinks && user && (
        <MyShortLinksModal user={user} onClose={() => setShowMyShortLinks(false)} />
      )}

      <Slide active={view === "profile"} onBackdropClick={() => setView("main")}>
        <ProfileEditScreen onBack={() => setView("main")} />
      </Slide>
      <Slide active={view === "version"} onBackdropClick={() => setView("main")}>
        <VersionInfoScreen onBack={() => setView("main")} />
      </Slide>
      <Slide active={view === "licenses"} onBackdropClick={() => setView("main")}>
        <LicensesScreen onBack={() => setView("main")} />
      </Slide>
      <Slide active={view === "packSettings"} onBackdropClick={() => setView("main")}>
        <PackSettingsScreen onBack={() => setView("main")} />
      </Slide>
      <Slide active={view === "bagSettings"} onBackdropClick={() => setView("main")}>
        <BagSettingsScreen onBack={() => setView("main")} />
      </Slide>
      <Slide active={view === "colorSettings"} onBackdropClick={() => setView("main")}>
        <ColorSettingsScreen onBack={() => setView("main")} />
      </Slide>
      <Slide active={view === "trash"} onBackdropClick={() => setView("main")}>
        <TrashScreen
          bags={trashedBags}
          packs={trashedPacks}
          onBack={() => setView("main")}
          onRestoreBag={onRestoreBag}
          onPermanentDeleteBag={onPermanentDeleteBag}
          onRestorePack={onRestorePack}
          onPermanentDeletePack={onPermanentDeletePack}
        />
      </Slide>
      <Slide active={view === "inquiries"} onBackdropClick={() => setView("main")}>
        <InquiryScreen
          uid={uid}
          nickname={profile?.nickname ?? ""}
          onBack={() => setView("main")}
        />
      </Slide>
      <Slide active={view === "guide"} onBackdropClick={() => setView("main")}>
        <GuideScreen onBack={() => setView("main")} />
      </Slide>
      <Slide active={view === "installGuide"} onBackdropClick={() => setView("main")}>
        <InstallGuideScreen onBack={() => setView("main")} />
      </Slide>

      {showInspectLogsModal && (
        <TemplateInspectLogsModal onClose={() => setShowInspectLogsModal(false)} />
      )}

      {showStartPageModal && (
        <StartPageSelectModal
          currentConfig={profile?.startPage}
          bags={bags || []}
          libraryPacks={libraryPacks || []}
          onClose={() => setShowStartPageModal(false)}
          onSelect={async (config) => {
            try {
              await updateStartPage(config);
              show("시작페이지 설정을 저장했어요");
            } catch {
              show("시작페이지 설정을 저장하지 못했어요");
            }
          }}
        />
      )}

      {showAccountLinkModal && (
        <AccountLinkModal
          isOpen={showAccountLinkModal}
          onClose={() => setShowAccountLinkModal(false)}
        />
      )}

      {confirmLogout && (
        <ConfirmDialog
          title={isGuest ? "게스트 모드를 종료하시겠어요?" : "로그아웃 하시겠어요?"}
          message={
            isGuest
              ? "회원가입 없이 나가면 지금까지 작성한 가방과 팩이 모두 삭제될 수 있어요."
              : undefined
          }
          confirmLabel={isGuest ? "데이터 삭제하고 나가기" : "로그아웃"}
          tone="danger"
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => {
            setConfirmLogout(false);
            logout();
          }}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="모든 데이터를 초기화하시겠어요?"
          message="가방 보관함, 팩 보관함, 휴지통의 모든 데이터가 영구히 삭제되며 복구할 수 없습니다."
          confirmLabel={isResetting ? "초기화 중..." : "모든 데이터 영구 삭제"}
          tone="danger"
          onCancel={() => {
            if (!isResetting) setConfirmReset(false);
          }}
          onConfirm={handleResetAllData}
        />
      )}
    </div>
  );
}
