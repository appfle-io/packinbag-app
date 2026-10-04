"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconChevronRight, IconCloudUpload, IconDownload, IconUpload } from "@tabler/icons-react";
import { useTheme, type FontScale, type ThemeMode } from "@/components/ThemeProvider";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import type { Announcement, Bag, Pack } from "@/lib/types";
import { isAnnouncementActive } from "@/lib/announcementsService";
import { isPremiumUser } from "@/lib/premiumLimits";
import { APP_VERSION } from "@/lib/changelog";
import { AI_FREE_DAILY_LIMIT, currentAiUsageCount, isUnlimitedAiUser } from "@/lib/aiUsageService";
import { exportBackupData, parseBackupFile, restoreBackupData } from "@/lib/backupService";
import { getLocalBags, getLocalLibraryPacks, resetLocalAllData } from "@/lib/localBagsService";
import { deleteBagWithInviteCodeRemote, leaveBagRemote } from "@/lib/bagsService";
import { deleteLibraryPackRemote } from "@/lib/packsService";
import { deleteBagImage } from "@/lib/storageService";
import { getOfflineDataSummary } from "@/lib/offlineImportService";
import LegacyAvatar from "@/components/Avatar";
import NotificationBell from "@/components/NotificationBell";
import SlideScreen from "@/components/SlideScreen";
import { PremiumSheet } from "@/components/v2/sheets/PremiumSheet";
import { AccountLinkSheet } from "@/components/v2/sheets/AccountLinkSheet";
import { ProfileScreenV2 } from "./ProfileScreenV2";
import { LicensesScreenV2, VersionScreenV2 } from "./InfoScreens";
import { TrashScreenV2 } from "./TrashScreenV2";
import { InquiryScreenV2 } from "./InquiryScreenV2";
import { AnnouncementsListSheet, FaqSheet } from "./HelpSheets";
import { MyLinksSheet } from "./MyLinksSheet";
import { OfflineImportSheet } from "./OfflineImportSheet";
import { FontSheet } from "./FontSheet";
import { APP_FONTS } from "@/lib/v2/appFonts";
import { Badge, Button, ListRow, ScreenBody, ScreenHeader, SectionHeader, SegmentedControl, Toggle, cx } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { resetBagGuide } from "@/lib/v2/guide";
import { useOnlineGuard } from "@/components/v2/shell/useOnlineGuard";

// 구 SettingsScreen과 같은 props. AppShell(모바일)에서 UI_V2 플래그로 바꿔 끼운다.
// (onBack은 v2에서 쓰지 않는다: 탭 화면이라 뒤로가기 없음. embedded는 데스크톱 모달용이라 무시)
export interface SettingsScreenProps {
  uid: string;
  bags?: Bag[];
  libraryPacks?: Pack[];
  announcements: Announcement[];
  dismissedAnnouncementIds: string[];
  onDismissAnnouncement: (id: string) => void;
  onCreateAnnouncement: (data: Omit<Announcement, "id" | "createdAt">) => Promise<void>;
  onUpdateAnnouncement: (id: string, data: Partial<Announcement>) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  trashedBags: Bag[];
  trashedPacks: Pack[];
  onRestoreBag: (bagId: string) => void;
  onPermanentDeleteBag: (bag: Bag) => void;
  onRestorePack: (packId: string) => void;
  onPermanentDeletePack: (packId: string) => void;
  onBack: () => void;
  hideNotificationBell?: boolean;
  embedded?: boolean;
}

type SubView = "profile" | "version" | "licenses" | "trash" | "inquiries";

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "시스템" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
];

const FONT_OPTIONS: { value: FontScale; label: string }[] = [
  { value: "sm", label: "작게" },
  { value: "md", label: "보통" },
  { value: "lg", label: "크게" },
];

const PREMIUM_MESSAGE =
  "가족 모두와 무제한으로. 내가 만든 가방·참여 가방·팩 보관함 개수 제한이 없어지고, 가방 사진 5장, 메모팩 PDF·파일 첨부, 짧은 URL·커스텀 URL을 쓸 수 있어요.";

// 누를 수 없는 정보 줄(ListRow와 같은 높이·구분선)
function InfoRow({ title, trailing, divider = true }: { title: React.ReactNode; trailing?: React.ReactNode; divider?: boolean }) {
  return (
    <div className={cx("flex min-h-13 w-full items-center gap-3 py-2", divider && "border-b border-line")}>
      <span className="min-w-0 flex-1 truncate text-body text-ink">{title}</span>
      {trailing && <span className="flex shrink-0 items-center gap-2 text-caption text-sub">{trailing}</span>}
    </div>
  );
}

// 리디자인 v2 설정 탭. 화면 꾸밈 옵션은 화면 모드·글자 크기만 남기고 하위 설정 화면(화면설정/가방설정/팩설정)은 없앴다.
// 뺀 옵션의 프로필 필드는 그대로 둔다(구 UI로 돌아가면 원래 값이 살아난다).
export default function SettingsScreenV2(props: SettingsScreenProps) {
  const {
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
    hideNotificationBell,
  } = props;
  const { mode, setMode, fontScale, setFontScale, fontFamily, setFontFamily } = useTheme();
  const { user, profile, isMaster, isGuest, logout, isOfflineMode, exitOfflineMode, switchToOfflineMode, switchToOnlineMode, updatePackSettings } =
    useAuth();
  const { show } = useToast();
  // 계정 연동·이용권·내 URL·공지·문의는 인터넷이 필요하다(끊겨 있으면 열기 전에 알린다)
  const { guard } = useOnlineGuard();

  const [view, setView] = useState<SubView | null>(null);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showMyShortLinks, setShowMyShortLinks] = useState(false);
  const [showAccountLink, setShowAccountLink] = useState(false);
  const [showOfflineImport, setShowOfflineImport] = useState(false);
  const [showFont, setShowFont] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const offlineSummary = useMemo(
    () => getOfflineDataSummary(),
    // 가져오기 창을 닫거나 모드가 바뀌면 다시 센다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showOfflineImport, isOfflineMode],
  );

  const premium = isPremiumUser(profile?.email, profile);
  const aiUnlimited = isUnlimitedAiUser(profile?.email, profile);
  const aiUsedCount = currentAiUsageCount(profile);
  const trashCount = trashedBags.length + trashedPacks.length;
  const activeAnnouncements = announcements.filter((a) => isAnnouncementActive(a));
  const hasUnreadAnnouncement = activeAnnouncements.some((a) => !dismissedAnnouncementIds.includes(a.id));
  const hasOfflineData = !isOfflineMode && (offlineSummary.bags.length > 0 || offlineSummary.packs.length > 0);

  const close = () => setView(null);

  const openPremium = () => {
    if (isGuest) {
      show("회원가입 후 프리미엄을 이용할 수 있어요");
      setShowAccountLink(true);
      return;
    }
    setShowPremium(true);
  };

  // --- 백업 · 초기화 (구 설정 화면과 같은 로직) ---------------------------------------------
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
      const result = await restoreBackupData(parsed, isOfflineMode ? "local" : "cloud", user, {
        nickname: profile?.nickname || user?.displayName || "사용자",
        avatarId: profile?.avatarId || "avatar-1",
      });
      show(
        isOfflineMode && result.hasExcludedRemoteMedia
          ? `가방 ${result.restoredBagsCount}개, 팩 ${result.restoredPacksCount}개를 복원했어요 (온라인 이미지·파일은 제외)`
          : `가방 ${result.restoredBagsCount}개, 팩 ${result.restoredPacksCount}개를 복원했어요`,
      );
    } catch (err) {
      console.error("[팩인백] 백업 복원 실패:", err);
      show(err instanceof Error ? err.message : "백업 파일을 불러오지 못했어요");
    } finally {
      e.target.value = "";
    }
  };

  const handleResetAllData = async () => {
    if (resetting) return;
    setResetting(true);
    show("데이터를 지우고 있어요");
    try {
      if (isOfflineMode) {
        resetLocalAllData();
      } else {
        for (const bag of trashedBags) await onPermanentDeleteBag(bag);
        for (const pack of trashedPacks) await onPermanentDeletePack(pack.id);
        for (const p of libraryPacks ?? []) await deleteLibraryPackRemote(uid, p.id);
        for (const bag of bags ?? []) {
          if (bag.memberIds.length <= 1) {
            await Promise.all((bag.images ?? []).map((url) => deleteBagImage(url)));
            await deleteBagWithInviteCodeRemote(bag);
          } else {
            await leaveBagRemote(uid, bag.id);
          }
        }
      }
      show("모든 데이터가 초기화되었어요");
    } catch (err) {
      console.error("[팩인백] 데이터 초기화 실패:", err);
      show("데이터 초기화에 실패했어요");
    } finally {
      setResetting(false);
    }
  };

  const nickname = profile?.nickname ?? (isOfflineMode ? "오프라인 사용자" : "닉네임 설정하기");
  const profileSubtitle = isOfflineMode
    ? "데이터가 이 기기에만 저장돼요"
    : isGuest
      ? "기기에만 저장됨 · 계정 연동하기"
      : profile?.email;

  return (
    <div className="pib-v2 relative flex h-full min-h-0 w-full flex-1 flex-col bg-canvas">
      <ScreenHeader
        title="설정"
        actions={!hideNotificationBell && !isOfflineMode ? <NotificationBell uid={uid} v2 /> : undefined}
      />

      <ScreenBody className="gap-8">
        {/* 프로필 */}
        {profile && (
          <section className="flex flex-col">
            <ListRow
              divider={isGuest && !isOfflineMode}
              onClick={() => (isGuest && !isOfflineMode ? guard(() => setShowAccountLink(true)) : setView("profile"))}
              leading={<LegacyAvatar avatarId={profile.avatarId} size={40} />}
              title={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold">{nickname}</span>
                  {isOfflineMode && <Badge>오프라인</Badge>}
                  {!isOfflineMode && isGuest && <Badge tone="brand">게스트</Badge>}
                </span>
              }
              subtitle={profileSubtitle}
              chevron
            />
            {!isOfflineMode && isGuest && (
              <ListRow divider={false} title={<span className="font-semibold text-brand">계정 연동하기</span>} onClick={() => guard(() => setShowAccountLink(true))} chevron />
            )}
          </section>
        )}

        {/* 화면 */}
        <section className="flex flex-col gap-3">
          <SectionHeader>화면</SectionHeader>
          <div className="flex flex-col gap-2">
            <span className="text-caption text-sub">화면 모드</span>
            <SegmentedControl label="화면 모드" options={MODE_OPTIONS} value={mode} onChange={setMode} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-caption text-sub">글자 크기</span>
            <SegmentedControl label="글자 크기" options={FONT_OPTIONS} value={fontScale} onChange={setFontScale} />
          </div>
          <ListRow
            divider={false}
            title="글꼴"
            trailing={APP_FONTS.find((f) => f.id === fontFamily)?.label}
            onClick={() => setShowFont(true)}
            chevron
          />
        </section>

        {/* 가방: 구 UI 팩 설정의 "완료된 항목 맨 아래로"(같은 필드, 없으면 켜짐). 계정에 저장돼 기기 간 동일.
            오프라인 모드는 이 기기(로컬 프로필)에 저장된다(AuthProvider.writeUser) */}
        <section className="flex flex-col">
          <SectionHeader>가방</SectionHeader>
          <Toggle
            checked={profile?.packSettings?.moveCompletedToBottom ?? true}
            onChange={(on) => updatePackSettings({ moveCompletedToBottom: on }).catch(() => show("설정을 저장하지 못했어요"))}
            label="다 챙긴 아이템은 아래로"
            description="체크하면 그 팩의 맨 뒤로 내려가요"
          />
        </section>

        {/* 이용권 */}
        {!isOfflineMode && (
          <section className="flex flex-col">
            <SectionHeader>이용권</SectionHeader>
            {premium ? (
              <InfoRow title="프리미엄" trailing={<Badge tone="brand">이용 중</Badge>} />
            ) : (
              <ListRow
                title={<span className="font-semibold">프리미엄</span>}
                subtitle="가족 모두와 무제한으로 · 이용권 코드 입력"
                onClick={() => guard(openPremium)}
                chevron
              />
            )}
            <InfoRow title="AI 기능" trailing={aiUnlimited ? "무제한" : `오늘 ${aiUsedCount}/${AI_FREE_DAILY_LIMIT}회`} />
            <ListRow divider={false} title="내가 만든 URL" onClick={() => guard(() => setShowMyShortLinks(true))} chevron />
          </section>
        )}

        {/* 데이터 */}
        <section className="flex flex-col">
          <SectionHeader>데이터</SectionHeader>
          <ListRow
            title="휴지통"
            trailing={trashCount > 0 ? <Badge>{trashCount}</Badge> : undefined}
            onClick={() => setView("trash")}
            chevron
          />
          {isOfflineMode ? (
            <ListRow title={<span className="font-semibold text-brand">온라인 계정으로 전환</span>} subtitle="클라우드 계정으로 로그인해요" onClick={switchToOnlineMode} chevron />
          ) : (
            <ListRow title="오프라인 보관함 보기" subtitle="이 기기에만 저장된 가방과 팩을 봐요" onClick={switchToOfflineMode} chevron />
          )}
          {hasOfflineData && (
            <ListRow
              title="오프라인 데이터 가져오기"
              subtitle="오프라인에서 만든 가방과 팩을 내 계정으로 복사해요"
              trailing={
                <>
                  {offlineSummary.totalUnimportedCount > 0 && <Badge tone="solid">{offlineSummary.totalUnimportedCount}</Badge>}
                  <IconCloudUpload size={18} stroke={1.75} className="text-faint" aria-hidden="true" />
                </>
              }
              onClick={() => setShowOfflineImport(true)}
            />
          )}
          <ListRow
            title="백업 파일 내보내기"
            subtitle="가방과 팩을 .json 파일로 저장해요"
            trailing={<IconDownload size={18} stroke={1.75} className="text-faint" aria-hidden="true" />}
            onClick={handleExportBackup}
          />
          {/* 파일 선택은 label + 숨긴 input (ListRow와 같은 모양) */}
          <label className="flex min-h-13 w-full cursor-pointer items-center gap-3 py-2 transition-colors duration-160 ease-snappy active:bg-fill">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body text-ink">백업 파일 불러오기</span>
              <span className="truncate text-caption text-sub">
                {isOfflineMode ? ".json 파일에서 복원해요 (온라인 이미지·파일 제외)" : ".json 파일에서 가방과 팩을 복원해요"}
              </span>
            </span>
            <IconUpload size={18} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />
            <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportBackup} />
          </label>
        </section>

        {/* 지원 */}
        {!isOfflineMode && (
          <section className="flex flex-col">
            <SectionHeader>지원</SectionHeader>
            <ListRow
              title="공지사항"
              trailing={hasUnreadAnnouncement ? <span aria-label="새 공지" className="size-2 rounded-full bg-alert" /> : undefined}
              onClick={() => guard(() => setShowAnnouncements(true))}
              chevron
            />
            <ListRow title="자주 묻는 질문" onClick={() => setShowFaq(true)} chevron />
            <ListRow divider={false} title="문의하기" onClick={() => guard(() => setView("inquiries"))} chevron />
          </section>
        )}

        {/* 정보 */}
        <section className="flex flex-col">
          <SectionHeader>정보</SectionHeader>
          <ListRow
            title="사용 가이드 다시 보기"
            subtitle="가방을 열면 화면 위에서 다시 안내해요"
            onClick={() => {
              resetBagGuide();
              show("가방을 열면 사용 가이드가 나와요");
            }}
          />
          <ListRow title="버전 정보" trailing={`v${APP_VERSION}`} onClick={() => setView("version")} chevron />
          <ListRow divider={false} title="오픈소스 라이선스" onClick={() => setView("licenses")} chevron />
        </section>

        {/* 관리자 */}
        {!isOfflineMode && isMaster && (
          <section className="flex flex-col">
            <SectionHeader>관리자</SectionHeader>
            <Link href="/admin" className="flex min-h-13 w-full items-center gap-3 py-2 text-body text-ink active:bg-fill">
              <span className="min-w-0 flex-1 truncate">관리자 사이트로 이동</span>
              <IconChevronRight size={16} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />
            </Link>
          </section>
        )}

        {/* 계정 */}
        <section className="flex flex-col items-center gap-3 pt-2">
          {isOfflineMode ? (
            <Button variant="secondary" block onClick={exitOfflineMode}>
              오프라인 모드 종료
            </Button>
          ) : (
            <Button variant="secondary" block onClick={() => setConfirmLogout(true)}>
              {isGuest ? "게스트 모드 종료" : "로그아웃"}
            </Button>
          )}
          <Button variant="danger" size="sm" disabled={resetting} onClick={() => setConfirmReset(true)}>
            {resetting ? "초기화 중" : "데이터 초기화"}
          </Button>
        </section>
      </ScreenBody>

      {/* 하위 화면(v2, SubScreen 틀). 오른쪽으로 밀면 손가락을 따라 설정으로 돌아온다(SlideScreen swipeBack) */}
      <SlideScreen active={view === "profile"} onBackdropClick={close} swipeBack>
        <ProfileScreenV2 onBack={close} />
      </SlideScreen>
      <SlideScreen active={view === "version"} onBackdropClick={close} swipeBack>
        <VersionScreenV2 onBack={close} />
      </SlideScreen>
      <SlideScreen active={view === "licenses"} onBackdropClick={close} swipeBack>
        <LicensesScreenV2 onBack={close} />
      </SlideScreen>
      <SlideScreen active={view === "trash"} onBackdropClick={close} swipeBack>
        <TrashScreenV2
          bags={trashedBags}
          packs={trashedPacks}
          onBack={close}
          onRestoreBag={onRestoreBag}
          onPermanentDeleteBag={onPermanentDeleteBag}
          onRestorePack={onRestorePack}
          onPermanentDeletePack={onPermanentDeletePack}
        />
      </SlideScreen>
      <SlideScreen active={view === "inquiries"} onBackdropClick={close} swipeBack>
        <InquiryScreenV2 uid={uid} nickname={profile?.nickname ?? ""} onBack={close} />
      </SlideScreen>

      {/* 시트 */}
      <AnnouncementsListSheet
        open={showAnnouncements}
        announcements={activeAnnouncements}
        dismissedIds={dismissedAnnouncementIds}
        onDismiss={onDismissAnnouncement}
        onClose={() => setShowAnnouncements(false)}
      />
      <FaqSheet open={showFaq} onClose={() => setShowFaq(false)} />
      <PremiumSheet
        open={showPremium}
        message={PREMIUM_MESSAGE}
        onClose={() => setShowPremium(false)}
        onUnlocked={(expiresAt) => {
          setShowPremium(false);
          if (!expiresAt) {
            show("프리미엄이 적용됐어요");
          } else {
            const dateLabel = new Date(expiresAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
            show(`프리미엄이 적용됐어요 (${dateLabel}까지)`);
          }
        }}
      />
      <MyLinksSheet open={showMyShortLinks && !!user} user={user ?? null} onClose={() => setShowMyShortLinks(false)} />
      <OfflineImportSheet open={showOfflineImport} onClose={() => setShowOfflineImport(false)} />
      <FontSheet open={showFont} onClose={() => setShowFont(false)} value={fontFamily} onChange={setFontFamily} />
      <AccountLinkSheet open={showAccountLink} onClose={() => setShowAccountLink(false)} />

      <ConfirmSheet
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title={isGuest ? "게스트 모드를 끝낼까요?" : "로그아웃할까요?"}
        message={isGuest ? "회원가입 없이 나가면 지금까지 만든 가방과 팩이 모두 지워질 수 있어요." : undefined}
        confirmLabel={isGuest ? "지우고 나가기" : "로그아웃"}
        danger
        onConfirm={() => logout()}
      />
      <ConfirmSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="모든 데이터를 지울까요?"
        message="가방, 팩 보관함, 휴지통의 모든 데이터가 영구히 지워지고 되돌릴 수 없어요. 함께 쓰는 가방에서는 나가기만 해요."
        confirmLabel="모두 지우기"
        danger
        onConfirm={handleResetAllData}
      />
    </div>
  );
}
