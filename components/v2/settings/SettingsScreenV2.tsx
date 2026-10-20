"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconChevronRight, IconCloudUpload, IconDownload, IconUpload } from "@tabler/icons-react";
import { useTheme, type FontScale, type ThemeMode } from "@/components/ThemeProvider";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import type { Announcement, Bag, Pack } from "@/lib/types";
import { isAnnouncementActive } from "@/lib/announcementsService";
import { isPremiumUser } from "@/lib/premiumLimits";
import { isDemoMode, openRealApp } from "@/lib/demoMode";
import { APP_VERSION } from "@/lib/changelog";
import { AI_FREE_DAILY_LIMIT, currentAiUsageCount, isUnlimitedAiUser } from "@/lib/aiUsageService";
import { RestorePartialError, exportBackupData, isPortableApp, parseBackupFile, restoreBackupData, withBagNoteBodies } from "@/lib/backupService";
import { getLocalBags, getLocalLibraryPacks, resetLocalAllData } from "@/lib/localBagsService";
import { deleteBagWithInviteCodeRemote, leaveBagRemote } from "@/lib/bagsService";
import { deleteLibraryPackRemote } from "@/lib/packsService";
import { bagFileUrls, deleteUnusedFiles, packFileUrls, urlsInUse } from "@/lib/storageCleanup";
import { getPendingBags, getPendingPacks, removePendingBag, removePendingPack } from "@/lib/v2/pendingCreates";
import { blockedBagLabel, planDataReset, type ResetPlan } from "@/lib/v2/resetPlan";
import { getOfflineDataSummary } from "@/lib/offlineImportService";
import Portal from "@/components/Portal";
import { BusyOverlay } from "@/components/v2/shell/BusyOverlay";
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
import { Badge, Button, ListRow, ScreenBody, ScreenHeader, SectionHeader, SegmentedControl, Sheet, Toggle, cx } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { resetBagGuide } from "@/lib/v2/guide";
import { useOnlineGuard } from "@/components/v2/shell/useOnlineGuard";
import { isNativePlatform } from "@/lib/purchaseService";
import { askNotificationPermission, getNotificationPermission, isServerPushAvailable, sendTestPush, type PushKind } from "@/lib/v2/serverPush";
import { PushSettingsScreen, pushKindsSummary } from "./PushSettingsScreen";
import { EventsScreen } from "@/components/v2/events/EventScreens";
import { useEvents } from "@/lib/eventsService";
import { hasUnseenEvent, readSeenEventIds, splitEvents } from "@/lib/events";
import { FREE_LAUNCH } from "@/lib/freeLaunch";
import { LockSettingsScreen } from "./LockSettingsScreen";
import { usePrivateLock } from "@/components/v2/lock/usePrivateLock";
import { lockedCount } from "@/lib/v2/privateLock";
import { supportsBookmarkWidget } from "@/lib/v2/nativeBridge";
import { WidgetStylesScreen } from "./WidgetStylesScreen";

// AppShell이 넘기는 props.
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

type SubView = "profile" | "version" | "licenses" | "trash" | "inquiries" | "lock" | "widgets" | "push" | "events";

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
  const { user, profile, isMaster, isGuest, logout, isOfflineMode, exitOfflineMode, switchToOnlineMode, updatePackSettings, updatePushPref } =
    useAuth();
  const { show } = useToast();
  // 계정 연동·이용권·내 URL·공지·문의는 인터넷이 필요하다(끊겨 있으면 열기 전에 알린다)
  const { guard } = useOnlineGuard();
  // 개인 잠금(2026-10-12). 오프라인 모드 · 게스트는 본인 확인을 할 수 없어 숨긴다
  const privacy = usePrivateLock();
  // 북마크 위젯 꾸미기(1.7 iOS 앱부터, 2026-10-18). 계정 모드에서만
  const [widgetAvailable, setWidgetAvailable] = useState(false);
  useEffect(() => {
    if (isOfflineMode) return;
    let alive = true;
    void supportsBookmarkWidget().then((ok) => alive && setWidgetAvailable(ok));
    return () => {
      alive = false;
    };
  }, [isOfflineMode]);
  const showWidgetRow = widgetAvailable && !isOfflineMode;

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
  // 내가 그룹장인 함께 쓰는 가방이 있어 초기화를 막을 때(SET-ACC-05)
  const [resetBlocked, setResetBlocked] = useState<ResetPlan["blocked"] | null>(null);
  const [resetting, setResetting] = useState(false);
  // 백업 만들기 · 복원 · 초기화 중 화면(여러 개면 진행 막대)
  const [busy, setBusy] = useState<{ message: string; progress?: { total: number; completed: number } } | null>(null);
  const [pushTesting, setPushTesting] = useState(false);
  // 서버 푸시(iOS 1.5 앱만). 알림 권한은 앱으로 돌아올 때마다 다시 본다(아이폰 설정에서 바꿀 수 있어서)
  const pushAvailable = useMemo(() => !isOfflineMode && !isGuest && isServerPushAvailable(), [isOfflineMode, isGuest]);
  const [pushPermission, setPushPermission] = useState<string | null>(null);
  useEffect(() => {
    if (!pushAvailable) return;
    const load = () => void getNotificationPermission().then(setPushPermission);
    load();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pushAvailable]);
  const allowPush = async () => {
    const ok = await askNotificationPermission();
    setPushPermission(await getNotificationPermission());
    show(ok ? "알림을 받을 수 있어요" : "아이폰 설정 > 팩인백 > 알림에서 허용해 주세요");
  };
  const togglePush = (kind: PushKind, label: string, on: boolean) => {
    updatePushPref(kind, on)
      .then(() => show(on ? `${label} 알림을 켰어요` : `${label} 알림을 껐어요. 여기서 언제든 다시 켜실 수 있어요`))
      .catch(() => show("설정을 저장하지 못했어요"));
  };
  const runPushTest = async () => {
    if (pushTesting) return;
    setPushTesting(true);
    // 서버는 5초 뒤 보내고 그다음에 응답한다. 안내는 누르는 즉시(2026-10-17).
    // 10/15에 결과 토스트 하나로 합쳤더니 "홈으로 나가세요"가 알림이 이미 온 뒤에 떠서, 앱 안에서 배너 없이 사라졌다.
    // 권한을 아직 안 물었으면 허용 창이 먼저 뜨므로 안내는 권한이 있을 때만
    if (pushPermission === "granted") show("5초 뒤에 알림이 와요 · 지금 홈 화면으로 나가 주세요");
    // 한 번이라도 앱을 떠났는지(응답은 돌아온 뒤에 받을 수 있어 지금 상태로는 모른다)
    let leftApp = document.visibilityState === "hidden";
    const onVisibility = () => {
      if (document.visibilityState === "hidden") leftApp = true;
    };
    document.addEventListener("visibilitychange", onVisibility);
    try {
      const result = await sendTestPush();
      // 앱을 보는 동안 도착하면 iOS가 배너를 띄우지 않는다(presentationOptions: []). 떠났다 왔으면 이미 봤을 테니 따로 알리지 않는다
      if (!result.sent) show(result.message);
      else if (!leftApp) show("앱을 보고 있어서 배너가 뜨지 않았어요. 누른 뒤 바로 홈 화면으로 나가 주세요");
    } catch (err) {
      console.error("[팩인백] 테스트 알림 실패:", err);
      show("테스트 알림을 보내지 못했어요");
    } finally {
      document.removeEventListener("visibilitychange", onVisibility);
      setPushTesting(false);
    }
  };

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
  // 백업(2026-10-20, SET-DATA-04 · 05): 내보내기는 포터블 · 오프라인 모드에서만. 웹 · iOS 계정 모드는 데이터가 이미 계정에 있어 불러오기만
  // (포터블 · 오프라인에서 만든 백업을 계정으로 가져오는 길). 두 화면 모두 사진 · 파일은 담지 않는다
  const [portable] = useState(isPortableApp);
  const canExportBackup = portable || isOfflineMode;
  // 이벤트(EVT-LIST): 진행 중인데 이 기기에서 안 본 것이 있으면 빨간 점. 본 기록은 화면이 바뀔 때마다 다시 읽는다(가벼움)
  const activeEvents = splitEvents(useEvents(!isOfflineMode)).active;
  const hasNewEvent = view !== "events" && hasUnseenEvent(activeEvents, readSeenEventIds());

  const close = () => setView(null);

  const openPremium = () => {
    if (isGuest) {
      show("회원가입 후 프리미엄을 이용할 수 있어요");
      setShowAccountLink(true);
      return;
    }
    setShowPremium(true);
  };

  // --- 백업 · 초기화 (docs/spec/settings.md SET-BAK · SET-ACC) ---------------------------------
  // 계정 모드는 목록 가방에 메모 본문이 없어서(notes에 따로) 내보내기 전에 읽어 채운다. 못 읽으면 파일을 만들지 않는다
  const handleExportBackup = async () => {
    if (busy) return;
    const currentBags = bags ?? (isOfflineMode ? getLocalBags() : []);
    const currentPacks = libraryPacks ?? (isOfflineMode ? getLocalLibraryPacks() : []);
    let full = currentBags;
    if (!isOfflineMode) {
      setBusy({ message: "백업 파일을 만들고 있어요" });
      try {
        full = await withBagNoteBodies(currentBags);
      } catch (err) {
        console.error("[팩인백] 백업 메모 본문 읽기 실패:", err);
        show("가방 메모를 불러오지 못해 백업을 만들지 못했어요. 인터넷 연결을 확인해 주세요");
        return;
      } finally {
        setBusy(null);
      }
    }
    const { removedMedia } = exportBackupData(full, currentPacks);
    show(removedMedia > 0 ? `백업 파일을 다운로드했어요 (사진 · 파일 ${removedMedia}개는 빼고)` : "백업 파일을 다운로드했어요");
  };

  // 덮어쓰지 않고 새로 만든다. 하나씩 만들며 진행 막대, 중간에 멈추면 같은 파일을 다시 고를 때 이어서(lib/backupPlan)
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    const message = "백업을 복원하고 있어요";
    try {
      const parsed = await parseBackupFile(file);
      setBusy({ message, progress: { total: 0, completed: 0 } });
      const result = await restoreBackupData(
        parsed,
        isOfflineMode ? "local" : "cloud",
        user,
        {
          nickname: profile?.nickname || user?.displayName || "사용자",
          avatarId: profile?.avatarId || "avatar-1",
        },
        (completed, total) => setBusy({ message, progress: { total, completed } }),
      );
      const counts = `가방 ${result.restoredBagsCount}개, 팩 ${result.restoredPacksCount}개를 ${result.resumed ? "이어서 " : ""}복원했어요`;
      show(result.removedMedia > 0 ? `${counts} (사진 · 파일 ${result.removedMedia}개는 가져오지 않았어요)` : counts);
    } catch (err) {
      console.error("[팩인백] 백업 복원 실패:", err);
      if (err instanceof RestorePartialError) {
        show(
          err.done > 0
            ? `${err.total}개 중 ${err.done}개를 복원하고 멈췄어요. 같은 파일을 다시 불러오면 이어서 해요 (${err.message})`
            : err.message,
        );
      } else {
        show(err instanceof Error ? err.message : "백업 파일을 불러오지 못했어요");
      }
    } finally {
      setBusy(null);
    }
  };

  // 초기화 버튼: 내가 그룹장인 함께 쓰는 가방이 있으면 먼저 안내하고 멈춘다(lib/v2/resetPlan)
  const resetPlan = (): ResetPlan =>
    planDataReset(uid, [...(bags ?? []), ...trashedBags], [...(libraryPacks ?? []), ...trashedPacks], {
      bagIds: new Set(getPendingBags(uid).map((b) => b.id)),
      packIds: new Set(getPendingPacks(uid).map((p) => p.id)),
    });
  const askReset = () => {
    if (!isOfflineMode) {
      const plan = resetPlan();
      if (plan.blocked.length > 0) {
        setResetBlocked(plan.blocked);
        return;
      }
    }
    setConfirmReset(true);
  };

  const handleResetAllData = async () => {
    if (resetting) return;
    if (isOfflineMode) {
      resetLocalAllData();
      show("모든 데이터가 초기화되었어요");
      return;
    }
    const plan = resetPlan();
    if (plan.blocked.length > 0) {
      setResetBlocked(plan.blocked);
      return;
    }
    setResetting(true);
    const message = "데이터를 지우고 있어요";
    const total = plan.deleteBags.length + plan.leaveBags.length + plan.deletePacks.length;
    let completed = 0;
    const step = () => setBusy({ message, progress: { total, completed: ++completed } });
    setBusy({ message, progress: { total, completed: 0 } });
    try {
      // 만들기 대기(아직 서버에 없음)는 이 기기에서만
      plan.pendingBagIds.forEach((id) => removePendingBag(uid, id));
      plan.pendingPackIds.forEach((id) => removePendingPack(uid, id));
      // 첨부: 지우는 것들을 뺀 나머지(나가기만 하는 함께 쓰는 가방)가 쓰지 않는 것만(휴지통 완전삭제와 같은 기준)
      const allBags = [...(bags ?? []), ...trashedBags];
      const allPacks = [...(libraryPacks ?? []), ...trashedPacks];
      const inUse = urlsInUse(allBags, allPacks, {
        bagIds: plan.deleteBags.map((b) => b.id),
        packIds: plan.deletePacks.map((p) => p.id),
      });
      await deleteUnusedFiles([...plan.deleteBags.flatMap(bagFileUrls), ...plan.deletePacks.flatMap(packFileUrls)], inUse).catch((err) =>
        console.error("[팩인백] 초기화 첨부 정리 실패:", err),
      );
      for (const bag of plan.deleteBags) {
        await deleteBagWithInviteCodeRemote(bag);
        step();
      }
      for (const bag of plan.leaveBags) {
        await leaveBagRemote(uid, bag.id);
        step();
      }
      for (const p of plan.deletePacks) {
        await deleteLibraryPackRemote(uid, p.id);
        step();
      }
      show("모든 데이터가 초기화되었어요");
    } catch (err) {
      console.error("[팩인백] 데이터 초기화 실패:", err);
      show("데이터 초기화에 실패했어요. 다시 하면 남은 것만 지워요");
    } finally {
      setResetting(false);
      setBusy(null);
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
                  {isOfflineMode && <Badge>{isDemoMode() ? "체험" : "오프라인"}</Badge>}
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
            divider={showWidgetRow}
            title="글꼴"
            trailing={APP_FONTS.find((f) => f.id === fontFamily)?.label}
            onClick={() => setShowFont(true)}
            chevron
          />
          {showWidgetRow && (
            <ListRow
              divider={false}
              title="위젯 꾸미기"
              subtitle="홈 화면 ‘가방 바로가기’ 위젯"
              trailing={(profile?.widgetStyles?.length ?? 0) > 0 ? `${profile?.widgetStyles?.length}개` : undefined}
              onClick={() => setView("widgets")}
              chevron
            />
          )}
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
          {privacy.available && (
            <ListRow
              divider={false}
              title="잠금"
              subtitle="가방 · 팩을 나만 PIN으로 잠가요"
              trailing={privacy.hasPin ? `켜짐 · ${lockedCount(privacy.lock)}개` : "꺼짐"}
              onClick={() => setView("lock")}
              chevron
            />
          )}
        </section>

        {/* 알림(서버 푸시, iOS 1.5 앱만). 서비스 알림이라 기본 켜짐 - iOS 허용 창이 옵트인. 광고성 알림은 보내지 않는다 */}
        {pushAvailable && (
          <section className="flex flex-col">
            <SectionHeader>알림</SectionHeader>
            {pushPermission === "denied" && (
              <p className="m-0 mb-2 rounded-card bg-fill px-4 py-3 text-caption text-sub">
                알림이 꺼져 있어요. 아이폰 설정 &gt; 팩인백 &gt; 알림에서 허용해 주세요.
              </p>
            )}
            {(pushPermission === "prompt" || pushPermission === "prompt-with-rationale") && (
              <ListRow title={<span className="font-semibold text-brand">알림 허용하기</span>} subtitle="함께 쓰는 가방 소식을 받아요" onClick={allowPush} chevron />
            )}
            {/* 종류별 3개(가방 소식 · 맡긴 아이템 · 새 멤버)는 하위 화면 하나로(2026-10-19, SET-PUSH-08) */}
            <ListRow
              title="함께 쓰는 가방 알림"
              subtitle="가방 소식 · 나에게 맡긴 아이템 · 새 멤버"
              trailing={pushKindsSummary(profile?.pushPrefs)}
              onClick={() => setView("push")}
              chevron
            />
            <ListRow
              divider={false}
              title="테스트 알림 보내기"
              subtitle={pushTesting ? "5초 안에 홈 화면으로 나가 주세요" : "누른 뒤 홈 화면으로 나가면 알림이 와요"}
              onClick={() => guard(runPushTest)}
            />
            <p className="m-0 pt-2 text-micro text-faint">가방마다 끄려면 가방 더보기 &gt; 알림에서 바꿔요. 광고·이벤트 알림은 보내지 않아요.</p>
          </section>
        )}

        {/* 이용권 */}
        {!isOfflineMode && (
          <section className="flex flex-col">
            <SectionHeader>프리미엄</SectionHeader>
            {FREE_LAUNCH ? (
              <InfoRow title="모든 기능 무료" trailing={<Badge tone="brand">출시 기념</Badge>} />
            ) : premium ? (
              <InfoRow title="프리미엄" trailing={<Badge tone="brand">이용 중</Badge>} />
            ) : (
              <ListRow
                title={<span className="font-semibold">프리미엄</span>}
                subtitle={isNativePlatform() ? "가족 모두와 무제한으로 · 한 번 결제" : "가족 모두와 무제한으로 · 이용권 코드 입력"}
                onClick={() => guard(openPremium)}
                chevron
              />
            )}
            {/* 프리미엄도 하루 50회 상한이 있다(lib/aiQuotaServer.ts AI_PREMIUM_DAILY_CAP, 2026-10-09) */}
            <InfoRow title="AI 기능" trailing={aiUnlimited ? "하루 50회" : `오늘 ${aiUsedCount}/${AI_FREE_DAILY_LIMIT}회`} />
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
          {/* 계정 모드는 끊겨도 그대로 이어지므로 "오프라인 보관함 보기"(계정 → 오프라인 모드 전환)는 없앴다(연결 흐름 E).
              오프라인 모드에서 만든 데이터는 로그인할 때 합치기 시트로, 또는 아래 "오프라인 데이터 가져오기"로 옮긴다 */}
          {isOfflineMode && !isDemoMode() && (
            <ListRow title={<span className="font-semibold text-brand">온라인 계정으로 전환</span>} subtitle="로그인하면 이 기기 가방을 계정에 합쳐요" onClick={switchToOnlineMode} chevron />
          )}
          {hasOfflineData && !isDemoMode() && (
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
          {/* 체험 모드는 백업 내보내기 · 불러오기를 숨긴다(OFF-DEMO-07) */}
          {!isDemoMode() && (
          <>
          {canExportBackup && (
            <ListRow
              title="백업 파일 내보내기"
              subtitle="가방과 팩을 .json 파일로 저장해요"
              trailing={<IconDownload size={18} stroke={1.75} className="text-faint" aria-hidden="true" />}
              onClick={() => void handleExportBackup()}
            />
          )}
          {/* 파일 선택은 label + 숨긴 input (ListRow와 같은 모양). 계정 모드는 서버에 만들어서 끊겨 있으면 고르기 전에 알린다 */}
          <label
            className="flex min-h-13 w-full cursor-pointer items-center gap-3 py-2 transition-colors duration-160 ease-snappy active:bg-fill"
            onClick={(e) => {
              if (isOfflineMode) return;
              let blocked = true;
              guard(() => {
                blocked = false;
              });
              if (blocked) e.preventDefault();
            }}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body text-ink">백업 파일 불러오기</span>
              <span className="truncate text-caption text-sub">
                {isOfflineMode ? ".json 파일에서 이 기기로 복원해요" : "포터블 · 오프라인에서 만든 .json을 내 계정으로 가져와요"}
              </span>
            </span>
            <IconUpload size={18} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />
            <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportBackup} />
          </label>
          <p className="m-0 pt-2 text-micro text-faint">백업 파일에는 사진 · 파일이 들어가지 않아요. 가방 · 팩 · 아이템과 메모 글만 담겨요.</p>
          </>
          )}
        </section>

        {/* 지원 */}
        {!isOfflineMode && (
          <section className="flex flex-col">
            <SectionHeader>지원</SectionHeader>
            <ListRow
              title="이벤트"
              trailing={
                hasNewEvent ? (
                  <span aria-label="새 이벤트" className="size-2 rounded-full bg-alert" />
                ) : activeEvents.length > 0 ? (
                  `진행 중 ${activeEvents.length}`
                ) : undefined
              }
              onClick={() => guard(() => setView("events"))}
              chevron
            />
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
          {isDemoMode() ? (
            // 체험 모드: 종료 · 초기화 대신 진짜 팩인백 시작하기(새 탭, OFF-DEMO-07)
            <Button block onClick={openRealApp}>
              팩인백 시작하기
            </Button>
          ) : (
          <>
          {isOfflineMode ? (
            <Button variant="secondary" block onClick={exitOfflineMode}>
              오프라인 모드 종료
            </Button>
          ) : (
            <Button variant="secondary" block onClick={() => setConfirmLogout(true)}>
              {isGuest ? "게스트 모드 종료" : "로그아웃"}
            </Button>
          )}
          <Button variant="danger" size="sm" disabled={resetting} onClick={askReset}>
            {resetting ? "초기화 중" : "데이터 초기화"}
          </Button>
          </>
          )}
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
      {privacy.available && (
        <SlideScreen active={view === "lock"} onBackdropClick={close} swipeBack>
          <LockSettingsScreen onBack={close} />
        </SlideScreen>
      )}
      {!isOfflineMode && (
        <SlideScreen active={view === "events"} onBackdropClick={close} swipeBack>
          <EventsScreen active={view === "events"} onBack={close} />
        </SlideScreen>
      )}
      {pushAvailable && (
        <SlideScreen active={view === "push"} onBackdropClick={close} swipeBack>
          <PushSettingsScreen prefs={profile?.pushPrefs} onToggle={togglePush} onBack={close} />
        </SlideScreen>
      )}
      {showWidgetRow && (
        <SlideScreen active={view === "widgets"} onBackdropClick={close} swipeBack>
          <WidgetStylesScreen onBack={close} bags={bags ?? []} />
        </SlideScreen>
      )}

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
      <Sheet
        open={!!resetBlocked}
        onClose={() => setResetBlocked(null)}
        title="먼저 그룹장을 넘겨 주세요"
        footer={
          <Button block onClick={() => setResetBlocked(null)}>
            확인
          </Button>
        }
      >
        <p className="m-0 text-body text-sub">
          {`내가 그룹장인 함께 쓰는 가방 ${resetBlocked?.length ?? 0}개(${blockedBagLabel(resetBlocked ?? [])})가 있어요. 초기화하면 다른 멤버가 쓰는 가방도 사라지거나 그룹장이 없어져요. 가방의 멤버 화면에서 다른 멤버에게 그룹장을 넘기거나 멤버를 내보낸 뒤 다시 해 주세요.`}
        </p>
        {resetBlocked?.some((b) => !!b.trashedByOwnerAt) && (
          <p className="m-0 pt-2 text-caption text-faint">휴지통에 있는 가방은 되살린 뒤 넘겨 주세요.</p>
        )}
      </Sheet>
      {busy && (
        <Portal>
          <BusyOverlay visible message={busy.message} progress={busy.progress} />
        </Portal>
      )}
      <ConfirmSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="모든 데이터를 지울까요?"
        message="가방, 팩 보관함, 휴지통의 모든 데이터가 영구히 지워지고 되돌릴 수 없어요. 함께 쓰는 가방 중 다른 사람이 그룹장인 가방에서는 나가기만 해요."
        confirmLabel="모두 지우기"
        danger
        onConfirm={handleResetAllData}
      />
    </div>
  );
}
