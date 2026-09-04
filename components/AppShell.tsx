"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { IconLoader2 } from "@tabler/icons-react";
import { Bag, Item, Pack, Announcement, SharedPackSnapshot } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import {
  subscribeToUserBags,
  createBagRemote,
  saveBagRemote,
  deleteBagWithInviteCodeRemote,
  trashBagRemote,
  restoreBagRemote,
  joinBagByCode,
  fetchBagRemote,
  leaveBagRemote,
  removeMemberRemote,
  regenerateInviteCodeRemote,
  transferBagOwnershipRemote,
  updateMemberProfileSnapshot,
} from "@/lib/bagsService";
import {
  subscribeToLibraryPacks,
  saveLibraryPackRemote,
  deleteLibraryPackRemote,
  trashLibraryEntryRecursive,
  restoreLibraryEntryRecursive,
  deleteLibraryEntryRecursive,
  trashBagPackRemote,
  moveLibraryEntriesRemote,
} from "@/lib/packsService";
import {
  getAnnouncementsOnce,
  createAnnouncementRemote,
  updateAnnouncementRemote,
  deleteAnnouncementRemote,
  dismissAnnouncementRemote,
  isAnnouncementActive,
} from "@/lib/announcementsService";
import { deleteBagImage } from "@/lib/storageService";
import { deserializePack } from "@/lib/editorDocSerialize";
import {
  getLocalBags,
  saveLocalBag,
  createLocalBag,
  deleteLocalBag,
  restoreLocalBag,
  permanentDeleteLocalBag,
  getLocalLibraryPacks,
  saveLocalLibraryPack,
  deleteLocalLibraryPack,
  restoreLocalLibraryPack,
  permanentDeleteLocalLibraryPack,
  getLocalTrashedItems,
  subscribeLocalData,
} from "@/lib/localBagsService";
import AuthScreen from "@/components/auth/AuthScreen";
import GoogleProfileSetup from "@/components/auth/GoogleProfileSetup";
import EmailVerifyBanner from "@/components/EmailVerifyBanner";
import InstallPrompt from "@/components/InstallPrompt";
import BottomTabBar, { TabKey } from "@/components/BottomTabBar";
import { NoteImportResult } from "@/components/NoteImportModal";
import SplashScreen from "@/components/SplashScreen";
import AnnouncementPopupStack from "@/components/AnnouncementPopupStack";
import GuideModal from "@/components/guide/GuideModal";
import InstallGuideModal from "@/components/guide/InstallGuideModal";
import InitialGuideCarouselModal, {
  IntroSlideItem,
} from "@/components/guide/InitialGuideCarouselModal";
import { canShowInstallGuideModal } from "@/lib/installPromptUtils";
import HomeScreen from "@/components/screens/HomeScreen";
import PacksScreen from "@/components/screens/PacksScreen";
import SettingsScreen from "@/components/screens/SettingsScreen";
import BagEditorScreen from "@/components/screens/BagEditorScreen";
import PackLibraryEditorScreen from "@/components/screens/PackLibraryEditorScreen";
import PackNoteEditorScreen from "@/components/screens/PackNoteEditorScreen";
import QuickAddModal from "@/components/QuickAddModal";
import SlideScreen from "@/components/SlideScreen";
import SlideUpSheet from "@/components/SlideUpSheet";
import { useToast } from "@/components/Toast";
import { firebaseErrorCode } from "@/lib/errorMessage";
import {
  isPremiumUser,
  FREE_MAX_ACTIVE_BAGS,
  FREE_MAX_LIBRARY_PACKS,
  QUICK_PACK_ID,
  PremiumLimitError,
  computeLockedBagIds,
  computeLockedPackIds,
  isTrashExpired,
} from "@/lib/premiumLimits";
import PremiumLimitModal from "@/components/PremiumLimitModal";
import { useIsDesktop } from "@/lib/useIsDesktop";
import DesktopShell from "@/components/DesktopShell";
import type { DesktopSelection } from "@/components/DesktopSidebar";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function inviteCodeFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("invite")?.toUpperCase() ?? "";
}

// 이용권 상태가 막 바뀐 순간(무효화/만료 감지, 또는 재등록) 짧게 보여주는 전체화면
// 로딩 오버레이. 화면이 갑자기 잠기거나 풀리는 게 아니라 "지금 뭔가 바뀌고 있다"는
// 걸 직관적으로 느끼게 하기 위한 것 - 실제 로딩할 데이터는 없고 순수 타이밍용이다.
function PremiumSyncOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center"
      style={{
        background: "var(--background)",
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <IconLoader2 size={28} stroke={1.75} color="var(--text-muted)" className="animate-spin" />
    </div>
  );
}

// 새 가방을 만들기 위해 Firestore에 쓰는 동안(빈 가방/AI 메모 가져오기/샘플 템플릿/해시태그
// AI 생성 모두 같은 경로) 보여주는 전체화면 오버레이. 이 구간은 모달이 이미 닫히고 아직
// 새 가방 화면으로 전환되기 전이라 아무 반응이 없으면 멈춘 것처럼 보이는데, 이 오버레이로
// "지금 만들고 있다"는 걸 바로 알 수 있게 한다.
function CreatingBagOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className="fixed inset-0 z-[210] flex flex-col items-center justify-center gap-3"
      style={{
        background: "var(--background)",
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <IconLoader2 size={28} stroke={1.75} color="var(--text-muted)" className="animate-spin" />
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        가방을 만들고 있어요
      </span>
    </div>
  );
}

function CreatingPackOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className="fixed inset-0 z-[210] flex flex-col items-center justify-center gap-3"
      style={{
        background: "var(--background)",
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <IconLoader2 size={28} stroke={1.75} color="var(--text-muted)" className="animate-spin" />
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        팩을 만들고 있어요
      </span>
    </div>
  );
}

// 가방 다중 삭제(또는 나가기) 중 진행률을 보여주는 오버레이
function DeletingBagsOverlay({
  visible,
  total,
  completed,
}: {
  visible: boolean;
  total: number;
  completed: number;
}) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div
      className="fixed inset-0 z-[215] flex flex-col items-center justify-center gap-3 px-6"
      style={{
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(4px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col items-center gap-3.5 shadow-2xl max-w-[280px] w-full animate-in zoom-in-95 duration-150">
        <IconLoader2 size={32} stroke={2} color="var(--accent)" className="animate-spin" />
        <div className="text-center w-full">
          <p className="text-[14px] font-semibold text-foreground">
            가방을 정리하고 있어요
          </p>
          <p className="text-[12px] text-text-muted mt-1 tabular-nums">
            {completed} / {total}개 완료 ({percent}%)
          </p>
        </div>
        <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden border border-border/60">
          <div
            className="h-full transition-all duration-200"
            style={{ width: `${percent}%`, background: "var(--accent)" }}
          />
        </div>
      </div>
    </div>
  );
}

export default function AppShell() {
  const { user, profile, loading, authBusy, isMaster, isOfflineMode } = useAuth();
  const { show } = useToast();
  const isDesktop = useIsDesktop();

  const [bags, setBags] = useState<Bag[]>([]);
  const [libraryPacks, setLibraryPacks] = useState<Pack[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [tab, setTab] = useState<TabKey>("home");
  const appliedDefaultTabRef = useRef(false);
  const [editingBag, setEditingBag] = useState<Bag | null>(null);
  const [isNewBag, setIsNewBag] = useState(false);
  const [editingPack, setEditingPack] = useState<Pack | null>(null);
  const [creatingPack, setCreatingPack] = useState(false);
  // editingBag/editingPack(에디터형)은 뒤로가기 시 즉시 null이 되는데, SlideScreen이 슬라이드
  // 아웃 애니메이션을 재생하는 동안에도 내용이 유지되도록 "마지막으로 열려있던 값"을 따로
  // 캐싱해둔다 (null이 되는 순간 화면 내용까지 같이 사라지면 슬라이드 아웃이 빈 화면으로 보임).
  const [displayedBag, setDisplayedBag] = useState<Bag | null>(null);
  useEffect(() => {
    if (!editingBag) return;
    // editingBag은 onBack에서 바로 null이 되는 외부 상태라, 닫힘 애니메이션 동안 화면
    // 내용이 유지되도록 마지막 값을 그대로 미러링해두는 의도된 동기화다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayedBag(editingBag);
  }, [editingBag]);
  const [displayedEditorPack, setDisplayedEditorPack] = useState<Pack | null>(null);
  useEffect(() => {
    if (!editingPack || editingPack.kind !== "editor") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayedEditorPack(editingPack);
  }, [editingPack]);
  const [displayedSheetPack, setDisplayedSheetPack] = useState<Pack | null>(null);
  useEffect(() => {
    if (!editingPack || editingPack.kind === "editor") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayedSheetPack(editingPack);
  }, [editingPack]);
  // 가방 보관함/팩 보관함 상단 검색 결과를 눌러서 들어왔을 때만 채워진다. 각각
  // BagEditorScreen(focusTarget)/PackLibraryEditorScreen(focusItemId)/PackNoteEditorScreen(initialSearchQuery)에 그대로 넘겨서 해당
  // 팩(+짐/메모 텍스트)까지 자동 스크롤 + 하이라이트하게 한다. 한 번 쓰고 나면(onFocusHandled) 다시 null로 비운다.
  const [bagFocus, setBagFocus] = useState<{ packId?: string; itemId?: string; searchQuery?: string } | null>(null);
  const [packFocusItemId, setPackFocusItemId] = useState<string | null>(null);
  const [packFocusSearchQuery, setPackFocusSearchQuery] = useState<string | null>(null);
  const [packsSelectMode, setPacksSelectMode] = useState(false);
  // 하단 중앙 "+" 버튼(빠른입력) 모달 표시 여부.
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [splashMinTimeDone, setSplashMinTimeDone] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [introSlides, setIntroSlides] = useState<IntroSlideItem[]>([]);
  const introCheckedRef = useRef(false);
  const swipeStartRef = useRef<{ x: number; y: number; ignore: boolean } | null>(null);
  const [premiumLimitMessage, setPremiumLimitMessage] = useState<string | null>(null);
  const [showPremiumSyncOverlay, setShowPremiumSyncOverlay] = useState(false);
  // 새 가방을 Firestore에 쓰는 동안(openNewBag/openNewBagFromNote) true. CreatingBagOverlay를
  // 띄우는 용도로만 쓰이고, 실제 가방 생성 로직에는 영향을 주지 않는다.
  const [creatingBag, setCreatingBag] = useState(false);
  // 가방보관함 화면(HomeScreen)에서 다중 선택 모드(롱프레스) 중일 때 true.
  // 이 동안에는 하단 탭바와 팩트리 힌트 플로팅 버튼을 숨겨 가방 정리에만 집중시킨다.
  const [homeSelectMode, setHomeSelectMode] = useState(false);
  // 가방 다중 삭제/나가기 처리 중 진행률 ({ total, completed })
  const [bulkDeleting, setBulkDeleting] = useState<{ total: number; completed: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSplashMinTimeDone(true), 900);
    return () => clearTimeout(t);
  }, []);


  // 계정에 저장된 "시작 화면" 설정이 있으면 최초 1회만 반영한다 (이후엔 사용자가 직접 탭 전환).
  useEffect(() => {
    if (!profile || appliedDefaultTabRef.current) return;
    if (!profile.defaultTab) return;
    appliedDefaultTabRef.current = true;
    if (profile.defaultTab === "home" || profile.defaultTab === "packs" || profile.defaultTab === "settings") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab(profile.defaultTab);
    }
  }, [profile]);

  const showSplash = loading || !splashMinTimeDone;

  useEffect(() => {
    if (!user) return;
    if (isOfflineMode) {
      setBags(getLocalBags());
      return subscribeLocalData(() => {
        setBags(getLocalBags());
      });
    }
    return subscribeToUserBags(user.uid, setBags);
  }, [user, isOfflineMode]);

  const lastSyncedProfileRef = useRef<string | null>(null);

  // 내 닉네임/아바타를 바꾼 뒤(혹은 최초 로드 시) 각 공유 가방에 찍힌 memberProfiles 스냅샷이
  // 최신 프로필과 다르면 그 가방만 가볍게 고쳐쓴다. 프로필(닉네임/아바타)이 실제로 변경된 순간에만
  // 실행되고, 휴지통으로 들어간 가방은 제외하여 불필요한 연속 쓰기를 방지한다.
  useEffect(() => {
    if (!user || isOfflineMode || !profile?.nickname || !profile.avatarId) return;
    const profileKey = `${profile.nickname}:${profile.avatarId}`;
    if (lastSyncedProfileRef.current === profileKey) return;
    lastSyncedProfileRef.current = profileKey;

    bags.forEach((bag) => {
      if (bag.trashedByOwnerAt) return;
      const snap = bag.memberProfiles?.[user.uid];
      if (!snap) return;
      if (snap.nickname === profile.nickname && snap.avatarId === profile.avatarId) return;
      updateMemberProfileSnapshot(bag.id, user.uid, {
        nickname: profile.nickname!,
        avatarId: profile.avatarId!,
      }).catch(() => {});
    });
  }, [bags, user, isOfflineMode, profile?.nickname, profile?.avatarId]);

  useEffect(() => {
    if (!user) return;
    if (isOfflineMode) {
      setLibraryPacks(getLocalLibraryPacks());
      return subscribeLocalData(() => {
        setLibraryPacks(getLocalLibraryPacks());
      });
    }
    return subscribeToLibraryPacks(user.uid, setLibraryPacks);
  }, [user, isOfflineMode]);

  useEffect(() => {
    if (!user || isOfflineMode) {
      setAnnouncements([]);
      return;
    }
    getAnnouncementsOnce().then(setAnnouncements);
  }, [user, isOfflineMode]);

  // 설정 > 휴지통 보관기간(TRASH_RETENTION_DAYS, 30일)이 지난 가방/팩을 조용히 정리한다.
  // 별도 서버 배치/크론 없이, 그 항목의 삭제 권한을 가진 계정(가방은 소유자, 팩은 본인)의
  // 클라이언트가 다음에 로그인해서 열릴 때 한 번 검사해서 지운다 - 그래서 30일이 지난
  // 정확한 그 순간이 아니라 "그 이후 다음 접속 시점"에 지워진다(대부분의 개인용 앱에서는
  // 이 정도 지연이 실사용에 문제되지 않는다).
  useEffect(() => {
    if (!user || isOfflineMode) return;
    const expiredBags = bags.filter(
      (b) => b.ownerId === user.uid && isTrashExpired(b.trashedByOwnerAt)
    );
    const expiredPacks = libraryPacks.filter((p) => isTrashExpired(p.trashedAt));
    if (expiredBags.length === 0 && expiredPacks.length === 0) return;
    expiredBags.forEach((bag) => {
      Promise.all(bag.images.map((url) => deleteBagImage(url)))
        .then(() => deleteBagWithInviteCodeRemote(bag))
        .catch((err) => {
          console.error("[팩인백] 휴지통 자동 영구삭제(가방) 실패:", err);
        });
    });
    expiredPacks.forEach((pack) => {
      deleteLibraryPackRemote(user.uid, pack.id).catch((err) => {
        console.error("[팩인백] 휴지통 자동 영구삭제(팩) 실패:", err);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bags, libraryPacks, user, isOfflineMode]);

  // 지금 이 사용자가 프리미엄인지 - AuthProvider가 unlockCodes/{code} 문서까지 실시간
  // 구독해서 profile에 얹어주므로(unlockCodeLiveStatus), 관리자가 무효화하는 순간
  // 이 값도 바로 바뀐다. 마스터 계정은 언제나 무조건 프리미엄이다.
  // 오프라인 모드에서는 모든 로컬 기능이 무제한으로 지원된다.
  const premium =
    isOfflineMode ||
    isMaster ||
    profile?.role === "master" ||
    (user && profile ? isPremiumUser(user.email, profile) : false);

  // 이용권 상태(premium)가 true<->false로 바뀌는 순간을 감지한다.
  // - 첫 렌더에서는 기준값만 저장하고 아무 동작도 하지 않는다(로그인 직후 로딩 중 잠깐
  //   false로 보이다가 true로 바뀌는 정상적인 초기 로딩까지 "다운그레이드"로 오인하면 안 됨).
  // - 그 이후로 값이 실제로 바뀌면: (1) 서버에 잠금 상태 재계산을 요청하고
  //   (app/api/sync-lock-status - 무료<->프리미엄 양방향 모두), (2) 무료로 떨어진 경우에만
  //   짧은 오버레이 + 안내 토스트로 "뭔가 바뀌었다"는 걸 직관적으로 알린다.
  const premiumRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!user || isOfflineMode) {
      premiumRef.current = null;
      return;
    }
    if (premiumRef.current === null) {
      premiumRef.current = premium;
      return;
    }
    if (premiumRef.current === premium) return;
    const wasPremium = premiumRef.current;
    premiumRef.current = premium;

    user
      .getIdToken()
      .then((idToken: string) =>
        fetch("/api/sync-lock-status", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        })
      )
      .catch((err) => {
        console.error("[팩인백] 잠금 상태 동기화 요청 실패:", err);
      });

    if (wasPremium && !premium) {
      setShowPremiumSyncOverlay(true);
      const t = setTimeout(() => {
        setShowPremiumSyncOverlay(false);
        show("무료 회원으로 전환되어 일부 기능이 제한돼요");
      }, 700);
      return () => clearTimeout(t);
    }
  }, [premium, user, show]);

  // 무료 전환으로 잠긴(내가 소유한/보관한) 가방/팩 id 집합. 프리미엄/마스터이면 항상 빈 집합.
  // (computeLockedBagIds/computeLockedPackIds 내부에서 휴지통으로 보낸 항목은 이미 제외된다.)
  const lockedBagIds = user && !premium ? computeLockedBagIds(bags, user.uid) : new Set<string>();
  const lockedPackIds = user && !premium ? computeLockedPackIds(libraryPacks) : new Set<string>();
  // 하단 "+"(빠른입력) 버튼으로 만들어지는 시스템 팩. 사용자당 최대 1개, 고정 id.
  const quickPack = libraryPacks.find((p) => p.id === QUICK_PACK_ID);

  const requestUnlockForBag = () =>
    setPremiumLimitMessage(
      "이 가방은 읽기 전용이에요. 이용권 코드를 등록하면 다시 수정할 수 있어요."
    );
  const requestUnlockForPack = () =>
    setPremiumLimitMessage(
      "이 팩은 읽기 전용이에요. 이용권 코드를 등록하면 다시 수정할 수 있어요."
    );
  const handleDismissAnnouncement = useCallback(
    (id: string) => {
      if (!user) return;
      dismissAnnouncementRemote(user.uid, id).catch((err) => {
        console.error("[팩인백] 공지사항 다시 보지 않기 실패:", err);
      });
    },
    [user]
  );

  const dismissedIds = profile?.dismissedAnnouncementIds ?? [];
  const activeUndismissed = announcements
    .filter((a) => isAnnouncementActive(a))
    .filter((a) => !dismissedIds.includes(a.id));

  // 앱 진입 시(로그인 이후, 게스트 포함): 가이드 -> 앱 설치 안내 -> 공지사항을 하나의 슬라이더 모달로 조립하여 띄운다.
  useEffect(() => {
    if (introCheckedRef.current || isOfflineMode) return;
    if (!profile) return;
    introCheckedRef.current = true;

    const isGuideDismissed =
      typeof window !== "undefined" &&
      localStorage.getItem("pib_guide_dismissed") === "true";

    const isInstallGuideDismissed =
      typeof window !== "undefined" &&
      localStorage.getItem("pib_install_guide_dismissed") === "true";

    const slides: IntroSlideItem[] = [];

    // 1순위: 가이드 (미확인 시)
    if (!isGuideDismissed) {
      slides.push({
        id: "guide",
        type: "guide",
        title: "팩인백 사용 가이드",
        onDismiss: () => {
          if (typeof window !== "undefined") {
            localStorage.setItem("pib_guide_dismissed", "true");
          }
        },
      });
    }

    // 2순위: 앱 설치 방법 (미확인 + 조건 충족 시)
    if (canShowInstallGuideModal() && !isInstallGuideDismissed) {
      slides.push({
        id: "install",
        type: "install",
        title: "앱 설치 방법",
        onDismiss: () => {
          if (typeof window !== "undefined") {
            localStorage.setItem("pib_install_guide_dismissed", "true");
          }
        },
      });
    }

    // 3순위: 미확인 공지사항 목록
    activeUndismissed.forEach((a) => {
      slides.push({
        id: `announcement-${a.id}`,
        type: "announcement",
        title: a.title,
        announcement: a,
        onDismiss: () => {
          handleDismissAnnouncement(a.id);
        },
      });
    });

    if (slides.length > 0) {
      setIntroSlides(slides);
      setShowIntroModal(true);
    }
  }, [profile, activeUndismissed, handleDismissAnnouncement]);

  // 1. URL 쿼리 파라미터(?invite=, ?join=, ?openBag=, ?importPack=)를 접속 즉시 sessionStorage에 보존하여 로그인/회원가입 후 유실 방지
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const inviteCode = urlParams.get("invite") || urlParams.get("join");
      const openBagId = urlParams.get("openBag");
      const importPackToken = urlParams.get("importPack");

      if (inviteCode && inviteCode.trim()) {
        sessionStorage.setItem("pib_pending_invite", inviteCode.trim().toUpperCase());
      }
      if (openBagId && openBagId.trim()) {
        sessionStorage.setItem("pib_pending_open_bag", openBagId.trim());
      }
      if (importPackToken && importPackToken.trim()) {
        sessionStorage.setItem("pib_pending_import_pack", importPackToken.trim());
      }
      if (inviteCode || openBagId || importPackToken) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {
      // ignore
    }
  }, []);

  // 2. 로그인 완료 및 프로필이 준비되었을 때 보류된 초대/가방 열기/팩 가져오기 작업 자동 실행
  const pendingActionProcessedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !user || !profile?.nickname || pendingActionProcessedRef.current) return;

    const pendingInvite = sessionStorage.getItem("pib_pending_invite");
    const pendingOpenBag = sessionStorage.getItem("pib_pending_open_bag");
    const pendingImportPack = sessionStorage.getItem("pib_pending_import_pack");

    if (!pendingInvite && !pendingOpenBag && !pendingImportPack) return;
    pendingActionProcessedRef.current = true;

    if (pendingImportPack) {
      sessionStorage.removeItem("pib_pending_import_pack");
      (async () => {
        try {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/import-shared-pack", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ token: pendingImportPack }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (data?.code === "PACK_LIMIT_REACHED") {
              setPremiumLimitMessage(data.error);
              return;
            }
            show(data?.error || "팩을 가져오지 못했어요.");
            return;
          }
          setTab("packs");
          show(data?.message || "팩을 보관함으로 가져왔어요!");
        } catch (err) {
          console.error("[팩인백] 팩 가져오기 실패:", err);
          show("팩을 가져오지 못했어요.");
        }
      })();
      return;
    }

    if (pendingInvite) {
      sessionStorage.removeItem("pib_pending_invite");
      joinBagByCode(user, pendingInvite, {
        nickname: profile.nickname,
        avatarId: profile.avatarId || "avatar_1",
      })
        .then(async (bagId) => {
          show("초대 링크로 가방에 참여했어요!");
          const joined = await fetchBagRemote(bagId);
          if (joined) {
            setEditingBag(joined);
          }
        })
        .catch((err) => {
          console.error("[팩인백] 초대 가방 자동 참여 실패:", err);
          if (err instanceof PremiumLimitError) {
            setPremiumLimitMessage(err.message);
          } else {
            show(err instanceof Error ? err.message : "유효하지 않거나 만료된 초대 링크예요.");
          }
        });
      return;
    }

    if (pendingOpenBag) {
      sessionStorage.removeItem("pib_pending_open_bag");
      fetchBagRemote(pendingOpenBag).then((targetBag) => {
        if (targetBag && targetBag.memberIds.includes(user.uid)) {
          setEditingBag(targetBag);
        } else {
          show("가방에 접근할 권한이 없어요.");
        }
      });
    }
  }, [user, profile?.nickname, profile?.avatarId, show]);

  // authBusy(회원가입/로그인-미인증체크/이메일재발송처럼 잠깐 로그인했다가 눈 깜짝할
  // 사이 signOut하는 흐름) 체크를 loading보다 먼저 한다 - 원래는 loading을 먼저 체크했는데,
  // 그 흐름 중 Firebase가 잠깐 로그인 상태로 만드는 순간 loading이 다시 true로 바뀌면서
  // (아래 useEffect의 onAuthStateChanged 참고) 이 자리가 <AuthScreen/> 대신 <SplashScreen/>을
  // 렌더링해버려 AuthScreen이 통째로 마운트 해제됐다가 새로 마운트되는 문제가 있었다.
  // 그러면 AuthScreen 내부의 로컬 state(회원가입 완료 모달, "이메일 인증 안 됨" 에러 메시지
  // 등)에 나중에 setState하는 게 이미 사라진(unmount된) 인스턴스에 하는 셈이 되어 화면에
  // 아무것도 안 뜨고 사라지는 것처럼 보였다. authBusy를 먼저 체크해서 이 흐름 동안은
  // loading 값과 무관하게 항상 같은 <AuthScreen/> 인스턴스를 유지시킨다.
  if (authBusy)
    return (
      <>
        <AuthScreen />
        <InstallPrompt />
        <SplashScreen visible={showSplash} />
      </>
    );

  if (loading) {
    return <SplashScreen visible={showSplash} />;
  }

  // 회원가입/이메일재발송처럼 잠깐 로그인했다가 눈 깜짝할 사이 signOut하는 흐름 동안은,
  // user가 잠시 생기더라도 홈 화면으로 넘어가면 안 된다(넘어갔다가 곧바로 되돌아오는
  // 부자연스러운 깜빡임이 생기기 때문). 계속 로그인 화면을 보여준다.
  if (!user)
    return (
      <>
        <AuthScreen />
        <InstallPrompt />
        <SplashScreen visible={showSplash} />
      </>
    );
  if (!profile?.nickname || !profile?.avatarId)
    return (
      <>
        <GoogleProfileSetup />
        <SplashScreen visible={showSplash} />
      </>
    );

  // 휴지통으로 보낸 항목은 정상 목록(홈/팩 보관함)에서는 숨기고 설정 > 휴지통에서만 보여준다.
  // 가방은 "내가 소유한 것 중 내가 휴지통으로 보낸 것"만 숨겨진다 - 다른 그룹원의 화면에는
  // 영향이 없다(그들에게는 이 필드 자체를 신경쓰지 않고 그대로 보여준다).
  const activeBags = bags.filter((b) => !(b.ownerId === user.uid && b.trashedByOwnerAt));
  const trashedBags = bags.filter((b) => b.ownerId === user.uid && b.trashedByOwnerAt);
  const activePacks = libraryPacks.filter((p) => !p.trashedAt);
  const trashedPacks = libraryPacks.filter((p) => p.trashedAt);
  // v68: activePacks에는 폴더(type: "folder")가 섞여 있을 수 있다. 폴더는 트리 화면(PacksScreen)에서는
  // 보여야 하지만, "팩을 선택/불러오는" 목록(가방에 팩 불러오기, 불러온 팩에 함께 담기)에는
  // 폴더가 가짜 팩으로 보이면 안 되니 여기서 걸러낸다.
  const realPacksOnly = activePacks.filter((p) => p.type !== "folder");

  // 무료 개수 제한은 "내가 소유한, 휴지통에 없는 가방"만 센다 - app/api/create-bag의 서버
  // 카운트/lib/premiumLimits.ts의 computeLockedBagIds와 동일한 기준. 여기서는 무료일 때
  // 버튼을 눌렀을 때 서버 응답을 기다리지 않고 바로 안내 모달을 띄우기 위해 클라이언트에서도
  // 거의 동일한 검사를 미리 한 번 해본다(실제 강제는 서버 쪽에서 한다).
  const ownedBagCount = activeBags.filter((b) => b.ownerId === user.uid).length;

  const openNewBag = async () => {
    if (isOfflineMode) {
      const created = createLocalBag("새 가방");
      setEditingBag(created);
      setIsNewBag(false);
      return created;
    }
    if (ownedBagCount >= FREE_MAX_ACTIVE_BAGS && !premium) {
      setPremiumLimitMessage(
        `무료로는 가방을 동시에 ${FREE_MAX_ACTIVE_BAGS}개까지만 진행할 수 있어요. 더 만들려면 이용권 코드를 등록해주세요.`
      );
      return;
    }
    const now = new Date().toISOString();
    const draft: Bag = {
      id: uid(),
      name: "새 가방",
      images: [],
      packs: [
        {
          id: uid(),
          name: "새 팩",
          items: [],
        },
      ],
      memberIds: [user.uid],
      ownerId: user.uid,
      inviteCode: "",
      createdAt: now,
      updatedAt: now,
    };
    setIsNewBag(true);
    setCreatingBag(true);
    try {
      const created = await createBagRemote(user, draft, {
        nickname: profile.nickname!,
        avatarId: profile.avatarId!,
      });
      setEditingBag(created);
      // 데스크탑 레이아웃(DesktopShell)이 방금 만든 가방을 바로 선택해서 열 수 있도록
      // 반환한다. 모바일 쪽 호출부(HomeScreen onNewBag: () => void)는 반환값을 그냥
      // 무시하므로 기존 흐름에는 영향이 없다.
      return created;
    } catch (err) {
      setIsNewBag(false);
      if (err instanceof PremiumLimitError) {
        setPremiumLimitMessage(err.message);
        return;
      }
      console.error("[팩인백] 가방 생성 실패:", err);
      show(`가방 생성에 실패했어요 (${firebaseErrorCode(err)})`);
    } finally {
      setCreatingBag(false);
    }
  };

  // 메모 AI 가져오기뿐 아니라 샘플 템플릿 선택, 해시태그 AI 생성 결과도 모두
  // 동일한 형태(ImportedBagResult)라서 이 함수를 함께 쓴다.
  const openNewBagFromNote = async (result: NoteImportResult) => {
    if (ownedBagCount >= FREE_MAX_ACTIVE_BAGS && !premium) {
      setPremiumLimitMessage(
        `무료로는 가방을 동시에 ${FREE_MAX_ACTIVE_BAGS}개까지만 진행할 수 있어요. 더 만들려면 이용권 코드를 등록해주세요.`
      );
      return;
    }
    const now = new Date().toISOString();
    const draft: Bag = {
      id: uid(),
      name: result.bagName || "새 가방",
      travelDate: result.travelDate,
      notice: result.notice,
      images: [],
      packs:
        result.packs.length > 0
          ? result.packs.map((p) => ({
              id: uid(),
              name: p.name,
              kind: p.kind === "editor" ? ("editor" as const) : ("checklist" as const),
              editorDoc: p.editorDoc,
              editorPreviewText: p.editorPreviewText,
              items: Array.isArray(p.items)
                ? p.items.map((raw) => {
                    const text = typeof raw === "string" ? raw : raw.text;
                    const type = typeof raw === "string" ? "check" : raw.type ?? "check";
                    // AI(import-note/clipboard-organize)가 원본에서 이미 체크된 것으로 인식한
                    // 항목이면 checked를 그대로 살려서 만든다(단순 문자열이면 구버전 응답이라 false).
                    const checked = typeof raw === "string" ? false : !!raw.checked;
                    return {
                      id: uid(),
                      type,
                      text,
                      checked,
                    };
                  })
                : [],
            }))
          : [
              {
                id: uid(),
                name: "새 팩",
                items: [],
              },
            ],
      memberIds: [user.uid],
      ownerId: user.uid,
      inviteCode: "",
      createdAt: now,
      updatedAt: now,
    };
    if (isOfflineMode) {
      saveLocalBag(draft);
      setEditingBag(draft);
      setIsNewBag(false);
      show("가방을 만들었어요");
      return draft;
    }
    setIsNewBag(true);
    setCreatingBag(true);
    try {
      const created = await createBagRemote(user, draft, {
        nickname: profile.nickname!,
        avatarId: profile.avatarId!,
      });
      setEditingBag(created);
      show("가방을 채웠어요. 자동으로 저장되니 확인만 해주세요");
      return created;
    } catch (err) {
      setIsNewBag(false);
      if (err instanceof PremiumLimitError) {
        setPremiumLimitMessage(err.message);
        return;
      }
      console.error("[팩인백] 가방 생성 실패:", err);
      show(`가방 생성에 실패했어요 (${firebaseErrorCode(err)})`);
    } finally {
      setCreatingBag(false);
    }
  };

  // 가방은 openNewBag(Note) 단계에서 이미 Firestore에 만들어져 있으므로,
  // 저장 시에는 항상 덮어쓰기만 하면 된다 (다시 createBagRemote를 부르면 초대코드가 중복 생성됨).
  const handleSaveBag = async (bag: Bag) => {
    if (isOfflineMode) {
      saveLocalBag(bag);
      setIsNewBag(false);
      show("가방을 저장했어요");
      return;
    }
    const wasNew = isNewBag;
    try {
      await saveBagRemote(bag);
      setIsNewBag(false);
      show(wasNew ? "가방을 만들었어요" : "가방을 저장했어요");
    } catch (err) {
      console.error("[팩인백] 가방 저장 실패:", err);
      show(`가방 저장에 실패했어요 (${firebaseErrorCode(err)})`);
    }
  };

  // 휴지통으로 보내기(휴지통 버튼): 완전삭제가 아니라 trashedByOwnerAt만 채운다.
  // 이미지/문서는 그대로 두고, 30일 뒤 자동 영구삭제되거나 그 전에 설정 > 휴지통에서
  // 복구/영구삭제할 수 있다. BagEditorScreen에서 isOwner일 때만 이 함수가 호출된다
  // (소유자가 아니면 같은 버튼이 나가기(handleLeaveBag)로 동작한다).
  const handleDeleteBag = (bag: Bag) => {
    setEditingBag(null);
    setIsNewBag(false);
    if (isOfflineMode) {
      deleteLocalBag(bag.id);
      show("가방을 휴지통으로 보냈어요", {
        actionLabel: "실행취소",
        onAction: () => handleRestoreBag(bag.id),
      });
      return;
    }
    trashBagRemote(bag.id)
      .then(() =>
        show("가방을 휴지통으로 보냈어요", {
          actionLabel: "실행취소",
          onAction: () => handleRestoreBag(bag.id),
        })
      )
      .catch((err) => {
        console.error("[팩인백] 가방 휴지통 이동 실패:", err);
        show(`가방을 휴지통으로 보내지 못했어요 (${firebaseErrorCode(err)})`);
      });
  };

  // 홈 화면(가방 보관함)에서 길게 눌러 다중선택한 가방들을 한꺼번에 처리한다.
  // 내가 소유한 가방은 개별 삭제(handleDeleteBag)와 동일하게 휴지통으로 보내고,
  // 내가 소유하지 않은(그룹원으로 참여한) 공유 가방은 통째로 지우면(=휴지통 처리해도
  // 소유자만의 것이라 의미가 다름) 그룹에서 나가는 게 맞으므로 "나가기"로 처리한다
  // (BagEditorScreen의 개별 삭제 버튼과 동일한 규칙 - isOwner 여부에 따라 갈린다).
  const handleBulkDeleteBags = async (bagIds: string[]) => {
    if (isOfflineMode) {
      bagIds.forEach((id) => deleteLocalBag(id));
      show(`${bagIds.length}개를 휴지통으로 보냈어요`);
      return;
    }
    const targets = bags.filter((b) => bagIds.includes(b.id));
    const owned = targets.filter((b) => b.ownerId === user.uid);
    const shared = targets.filter((b) => b.ownerId !== user.uid);
    if (targets.length === 0) return;
    setBulkDeleting({ total: targets.length, completed: 0 });
    let completedCount = 0;
    try {
      const promises = [
        ...owned.map(async (bag) => {
          await trashBagRemote(bag.id);
          completedCount++;
          setBulkDeleting({ total: targets.length, completed: completedCount });
        }),
        ...shared.map(async (bag) => {
          await leaveBagRemote(user.uid, bag.id);
          completedCount++;
          setBulkDeleting({ total: targets.length, completed: completedCount });
        }),
      ];
      await Promise.all(promises);
      const parts: string[] = [];
      if (owned.length > 0) parts.push(`${owned.length}개 휴지통 이동`);
      if (shared.length > 0) parts.push(`${shared.length}개 나가기`);
      show(`${parts.join(" · ")}했어요`);
    } catch (err) {
      console.error("[팩인백] 가방 일괄 처리 실패:", err);
      show(`처리 중 일부가 실패했어요 (${firebaseErrorCode(err)})`);
    } finally {
      setTimeout(() => {
        setBulkDeleting(null);
      }, 150);
    }
  };

  // 설정 > 휴지통에서 가방 복구. 무료 동시 진행 개수 제한을 서버가 다시 검증하므로
  // (app/api/restore-bag) 한도에 걸리면 PremiumLimitError로 던져지고, 그 경우 일반 실패
  // 토스트 대신 이용권 등록을 유도하는 PremiumLimitModal을 띄운다.
  const handleRestoreBag = async (bagId: string) => {
    if (isOfflineMode) {
      restoreLocalBag(bagId);
      show("가방을 복구했어요");
      return;
    }
    try {
      await restoreBagRemote(user, bagId);
      show("가방을 복구했어요");
    } catch (err) {
      if (err instanceof PremiumLimitError) {
        setPremiumLimitMessage(err.message);
        return;
      }
      console.error("[팩인백] 가방 복구 실패:", err);
      show(`가방 복구에 실패했어요 (${firebaseErrorCode(err)})`);
    }
  };

  // 설정 > 휴지통에서 "완전삭제" - 여기서부터는 되돌릴 수 없다. 이미지까지 함께 정리하고
  // 초대코드 매핑도 지운다(예전 handleDeleteBag과 동일한 정리 작업).
  const handlePermanentDeleteBag = async (bag: Bag) => {
    if (isOfflineMode) {
      permanentDeleteLocalBag(bag.id);
      show("가방을 완전히 삭제했어요");
      return;
    }
    try {
      await Promise.all(bag.images.map((url) => deleteBagImage(url)));
      await deleteBagWithInviteCodeRemote(bag);
      show("가방을 완전히 삭제했어요");
    } catch (err) {
      console.error("[팩인백] 가방 완전삭제 실패:", err);
      show(`가방 삭제에 실패했어요 (${firebaseErrorCode(err)})`);
    }
  };

  // 새로 만들다가(아직 한 번도 저장 안 하고) 뒤로가기 하면, 미리 만들어둔 임시 가방을 조용히
  // 정리한다. 이건 "삭제"가 아니라 사용자 입장에서 한 번도 존재한 적 없는 임시 데이터를
  // 치우는 것이므로 휴지통을 거치지 않고 곧바로 완전삭제한다.
  const handleBackFromEditor = (currentBag: Bag) => {
    const wasNew = isNewBag;
    setEditingBag(null);
    setIsNewBag(false);
    setBagFocus(null);
    if (isOfflineMode) {
      if (wasNew) {
        permanentDeleteLocalBag(currentBag.id);
      }
      return;
    }
    if (wasNew) {
      Promise.all(currentBag.images.map((url) => deleteBagImage(url)))
        .then(() => deleteBagWithInviteCodeRemote(currentBag))
        .catch((err) => {
          console.error("[팩인백] 임시 가방 정리 실패:", err);
        });
    }
  };

  const handleLeaveBag = async (bagId: string) => {
    try {
      await leaveBagRemote(user.uid, bagId);
    } catch (err) {
      console.error("[팩인백] 가방 나가기 실패:", err);
      show(`가방 나가기에 실패했어요 (${firebaseErrorCode(err)})`);
      throw err;
    }
  };

  const handleRemoveMember = async (bagId: string, memberUid: string) => {
    try {
      await removeMemberRemote(bagId, memberUid);
    } catch (err) {
      console.error("[팩인백] 멤버 내보내기 실패:", err);
      show(`멤버를 내보내지 못했어요 (${firebaseErrorCode(err)})`);
      throw err;
    }
  };

  const handleRegenerateInviteCode = async (bag: Bag) => {
    try {
      return await regenerateInviteCodeRemote(user, bag);
    } catch (err) {
      console.error("[팩인백] 초대 코드 재발급 실패:", err);
      show(`초대 코드 재발급에 실패했어요 (${firebaseErrorCode(err)})`);
      throw err;
    }
  };

  const handleTransferOwnership = async (bagId: string, targetUid: string) => {
    try {
      await transferBagOwnershipRemote(user, bagId, targetUid);
    } catch (err) {
      console.error("[팩인백] 그룹장 위임 실패:", err);
      show(`그룹장 위임에 실패했어요 (${firebaseErrorCode(err)})`);
      throw err;
    }
  };

  const handleJoinBag = async (code: string) => {
    try {
      await joinBagByCode(user, code, {
        nickname: profile.nickname!,
        avatarId: profile.avatarId!,
      });
      show("가방에 참여했어요");
    } catch (err) {
      if (err instanceof PremiumLimitError) {
        setPremiumLimitMessage(err.message);
        return;
      }
      console.error("[팩인백] 가방 참여 실패:", err);
      throw err;
    }
  };

  // 데스크톱 사이드바 가방 "..." 메뉴에서 바로 이름 바꾸기 - 편집화면을 열지 않고도 가능하게.
  const handleRenameBag = (bag: Bag, name: string) => {
    if (isOfflineMode) {
      saveLocalBag({ ...bag, name });
      return;
    }
    saveBagRemote({ ...bag, name }).catch((err) => {
      console.error("[팩인백] 가방 이름 변경 실패:", err);
      show(`이름 변경에 실패했어요 (${firebaseErrorCode(err)})`);
    });
  };

  const handleSaveAsLibraryPack = (pack: Pack) => {
    if (isOfflineMode) {
      saveLocalLibraryPack(pack);
      show("팩 보관함에 저장했어요");
      return;
    }
    saveLibraryPackRemote(user, pack).catch((err) => {
      if (err instanceof PremiumLimitError) {
        setPremiumLimitMessage(err.message);
        return;
      }
      console.error("[팩인백] 팩 저장 실패:", err);
      show(`팩 저장에 실패했어요 (${firebaseErrorCode(err)})`);
    });
  };

  // 가방 안에서 팩을 삭제하면(BagEditorScreen의 handleDeletePack) 완전히 사라지는 대신
  // 팩 보관함의 휴지통으로 사본을 하나 남겨서 설정 > 휴지통에서 복구할 수 있게 한다.
  // 실패해도 가방 쪽 삭제 자체는 이미 끝난 상태라 토스트로만 안내한다.
  const handleTrashPackFromBag = (pack: Pack, sourceBagId: string, sourceBagName: string) => {
    if (isOfflineMode) {
      saveLocalLibraryPack({
        ...pack,
        id: uid(),
        name: `${sourceBagName} - ${pack.name}`,
        trashedAt: new Date().toISOString(),
      });
      return;
    }
    trashBagPackRemote(user, pack, sourceBagId, sourceBagName).catch((err) => {
      console.error("[팩인백] 가방 팩 휴지통 이동 실패:", err);
      show(`휴지통으로 옮기지 못했어요 (${firebaseErrorCode(err)})`);
    });
  };

  const handleCreateAnnouncement = async (
    data: Omit<Announcement, "id" | "createdAt">
  ) => {
    try {
      await createAnnouncementRemote(data);
    } catch (err) {
      console.error("[팩인백] 공지사항 등록 실패:", err);
      show(`공지사항 등록에 실패했어요 (${firebaseErrorCode(err)})`);
      throw err;
    }
  };

  const handleUpdateAnnouncement = async (id: string, data: Partial<Announcement>) => {
    try {
      await updateAnnouncementRemote(id, data);
    } catch (err) {
      console.error("[팩인백] 공지사항 수정 실패:", err);
      show(`공지사항 수정에 실패했어요 (${firebaseErrorCode(err)})`);
      throw err;
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteAnnouncementRemote(id);
    } catch (err) {
      console.error("[팩인백] 공지사항 삭제 실패:", err);
      show(`공지사항 삭제에 실패했어요 (${firebaseErrorCode(err)})`);
      throw err;
    }
  };

  const openNewPack = async (parentId?: string, kind?: "checklist" | "editor") => {
    const draft: Pack = {
      id: uid(),
      name: kind === "editor" ? "새 메모" : "새 팩",
      items: [],
      parentId,
      ...(kind ? { kind } : {}),
    };
    if (isOfflineMode) {
      setEditingPack(draft);
      saveLocalLibraryPack(draft);
      return draft;
    }
    setEditingPack(draft);
    setCreatingPack(true);
    try {
      await saveLibraryPackRemote(user, draft);
      return draft;
    } catch (err) {
      setEditingPack(null);
      if (err instanceof PremiumLimitError) {
        setPremiumLimitMessage(err.message);
        return;
      }
      console.error("[팩인백] 팩 생성 실패:", err);
      show(`팩 생성에 실패했어요 (${firebaseErrorCode(err)})`);
    } finally {
      setCreatingPack(false);
    }
  };

  // v68: 폴더는 팩 편집 화면(items가 없음)을 열 필요 없이 바로 생성된다. 생성 직후에는
  // 팩 트리 화면에서 이름을 편집 상태로 보여줘서 곧바로 이름을 바꿀(EditableText) 수 있게 해준다.
  const handleCreateFolder = async (parentId?: string) => {
    const draft: Pack = {
      id: uid(),
      name: "새 폴더",
      items: [],
      type: "folder",
      parentId,
    };
    if (isOfflineMode) {
      saveLocalLibraryPack(draft);
      return;
    }
    setCreatingPack(true);
    try {
      await saveLibraryPackRemote(user, draft);
    } catch (err) {
      if (err instanceof PremiumLimitError) {
        setPremiumLimitMessage(err.message);
        return;
      }
      console.error("[팩인백] 폴더 생성 실패:", err);
      show(`폴더 생성에 실패했어요 (${firebaseErrorCode(err)})`);
    } finally {
      setCreatingPack(false);
    }
  };

  // 폴더/팩 이름 바꾸기(트리 행의 이름 탭 편집). 폴더는 편집 화면이 없어서
  // 이 경로로만 이름을 바꿀 수 있다(팩은 편집 화면 안 EditableText로도 바꿀 수 있지만
  // 트리에서 직접 바꿀 때는 이 경로를 쓴다).
  const handleRenameLibraryEntry = (pack: Pack, name: string) => {
    if (isOfflineMode) {
      saveLocalLibraryPack({ ...pack, name });
      return;
    }
    saveLibraryPackRemote(user, { ...pack, name }).catch((err) => {
      console.error("[팩인백] 이름 바꾸기 실패:", err);
      show(`이름 바꾸기에 실패했어요 (${firebaseErrorCode(err)})`);
    });
  };

  // 팩/폴더를 다른 폴더로(또는 최상위로) 이동한다. 트리 및 다중선택에서 "이동" 액션으로 호출된다.
  // 2026-07-30: 전체 문서를 setDoc으로 덮어쓰는 대신 parentId 필드만 바꾸는 안전한
  // moveLibraryEntriesRemote를 쓴다(이동 순간 다른 순량에서 저장된 변경을 덮어쓰는 사고 방지).
  const handleMoveLibraryEntries = (packIds: string[], parentId: string | undefined) => {
    if (isOfflineMode) {
      const allPacks = getLocalLibraryPacks();
      packIds.forEach((id) => {
        const p = allPacks.find((item) => item.id === id);
        if (p) {
          saveLocalLibraryPack({ ...p, parentId });
        }
      });
      return;
    }
    moveLibraryEntriesRemote(user.uid, packIds, parentId).catch((err) => {
      console.error("[팩인백] 폴더 이동 실패:", err);
      show(`이동에 실패했어요 (${firebaseErrorCode(err)})`);
    });
  };

  const handleSavePack = (pack: Pack) => {
    if (isOfflineMode) {
      saveLocalLibraryPack(pack);
      return;
    }
    saveLibraryPackRemote(user, pack).catch((err) => {
      if (err instanceof PremiumLimitError) {
        setPremiumLimitMessage(err.message);
        return;
      }
      console.error("[팩인백] 팩 저장 실패:", err);
      show(`팩 저장에 실패했어요 (${firebaseErrorCode(err)})`);
    });
  };

  // 완전삭제 대신 휴지통으로 보낸다. BagEditorScreen 내부에서 팩을 지울 때(가방 속 팩
  // 삭제)와는 다른 함수다 - 이건 보관함 화면(PackLibraryEditorScreen)의 "삭제" 버튼용.
  // 이 팩은 늘 하위 항목이 없으니(폴더가 아니므로) 단일 항목으로 충분.
  const handleDeletePack = (packId: string) => {
    setEditingPack(null);
    if (isOfflineMode) {
      deleteLocalLibraryPack(packId);
      show("팩을 휴지통으로 보냈어요");
      return;
    }
    trashLibraryEntryRecursive(user.uid, activePacks, packId)
      .then(() => show("팩을 휴지통으로 보냈어요"))
      .catch((err) => {
        console.error("[팩인백] 팩 휴지통 이동 실패:", err);
        show(`팩을 휴지통으로 보내지 못했어요 (${firebaseErrorCode(err)})`);
      });
  };

  // 팩 보관함에서 길게 눌러 다중선택한 팩/폴더를 한꺼번에 휴지통으로 보낸다. 폴더를 선택했으면
  // 아이폰 메모처럼 하위 팩/폴더까지 모두 함께 보낸다(trashLibraryEntryRecursive).
  const handleBulkDeletePacks = async (packIds: string[]) => {
    if (isOfflineMode) {
      packIds.forEach((id) => deleteLocalLibraryPack(id));
      show(`${packIds.length}개를 휴지통으로 보냈어요`);
      return;
    }
    try {
      await Promise.all(packIds.map((id) => trashLibraryEntryRecursive(user.uid, activePacks, id)));
      show(`${packIds.length}개를 휴지통으로 보냈어요`);
    } catch (err) {
      console.error("[팩인백] 팩 일괄 휴지통 이동 실패:", err);
      show(`처리 중 일부가 실패했어요 (${firebaseErrorCode(err)})`);
    }
  };

  // 설정 > 휴지통에서 팩/폴더 복구. 폴더를 복구하면 하위 팩/폴더도 함께 복구된다
  // (restoreLibraryEntryRecursive). 트리 순회를 위해 휴지통에 있는 항목까지 포함된
  // libraryPacks(전체)를 넘겨야 한다.
  const handleRestorePack = async (packId: string) => {
    if (isOfflineMode) {
      restoreLocalLibraryPack(packId);
      show("팩을 복구했어요");
      return;
    }
    try {
      await restoreLibraryEntryRecursive(user, libraryPacks, packId);
      show("팩을 복구했어요");
    } catch (err) {
      console.error("[팩인백] 팩 복구 실패:", err);
      show(`팩 복구에 실패했어요 (${firebaseErrorCode(err)})`);
    }
  };

  // 설정 > 휴지통에서 "완전삭제" - 되돌릴 수 없다. 폴더면 하위 팩/폴더도 함께 영구삭제된다
  // (deleteLibraryEntryRecursive).
  const handlePermanentDeletePack = async (packId: string) => {
    if (isOfflineMode) {
      permanentDeleteLocalLibraryPack(packId);
      show("팩을 완전히 삭제했어요");
      return;
    }
    try {
      await deleteLibraryEntryRecursive(user.uid, libraryPacks, packId);
      show("팩을 완전히 삭제했어요");
    } catch (err) {
      console.error("[팩인백] 팩 완전삭제 실패:", err);
      show(`팩 삭제에 실패했어요 (${firebaseErrorCode(err)})`);
    }
  };

  // 빠른팩(다중선택) 이동 부해 - 특정 가방의 특정 팩 안으로 짐을 이동한다. 지금
  // 구독 중인 bags 배열을 기준으로 목표 팩에 아이템을 이어붙이고 그 가방 전체를 저장한다
  // (BagEditorScreen을 열지 않고 바로 저장하는 가방 자동저장과 같은 패턴).
  const handleAddItemsToBagPack = (bagId: string, packId: string, items: Item[]) => {
    const bag = bags.find((b) => b.id === bagId);
    if (!bag) return;
    const updated: Bag = {
      ...bag,
      packs: bag.packs.map((p) =>
        p.id === packId ? { ...p, items: [...p.items, ...items] } : p
      ),
      updatedAt: new Date().toISOString(),
    };
    if (isOfflineMode) {
      saveLocalBag(updated);
      return;
    }
    saveBagRemote(updated).catch((err) => {
      console.error("[팩인백] 가방으로 짐 이동 실패:", err);
      show(`가방으로 이동하는 데 실패했어요 (${firebaseErrorCode(err)})`);
    });
  };

  // 위 handleAddItemsToBagPack의 되돌리기(토스트 "되돌리기")용 - 방금 옮긴 짐만 id 기준으로
  // 그 가방 팩에서 제거한다.
  const handleRemoveItemsFromBagPack = (bagId: string, packId: string, itemIds: Set<string>) => {
    const bag = bags.find((b) => b.id === bagId);
    if (!bag) return;
    const updated: Bag = {
      ...bag,
      packs: bag.packs.map((p) =>
        p.id === packId ? { ...p, items: p.items.filter((i) => !itemIds.has(i.id)) } : p
      ),
      updatedAt: new Date().toISOString(),
    };
    if (isOfflineMode) {
      saveLocalBag(updated);
      return;
    }
    saveBagRemote(updated).catch((err) => {
      console.error("[팩인백] 가방 이동 되돌리기 실패:", err);
    });
  };

  // 하단 "+" 빠른입력 모달에서 항목을 추가할 때마다 호출된다. 빠른팩이 아직 없으면
  // (한 번도 안 썼으면) isQuickPack:true로 새로 만들고, 있으면 기존 팩 끝에 이어붙인다.
  // 빠른팩은 무료 3개 한도와 무관하게 항상 생성/저장이 허용된다(app/api/create-library-pack,
  // lib/premiumLimits.ts computeLockedPackIds 참고).
  const handleQuickAddItem = (data: { type: "check" | "text"; text: string }) => {
    const newItem: Item = { id: uid(), type: data.type, text: data.text, checked: false };
    const draft: Pack = quickPack
      ? { ...quickPack, items: [...quickPack.items, newItem] }
      : { id: QUICK_PACK_ID, name: "빠른팩", items: [newItem], isQuickPack: true };
    if (isOfflineMode) {
      saveLocalLibraryPack(draft);
      return;
    }
    saveLibraryPackRemote(user, draft).catch((err) => {
      console.error("[팩인백] 빠른입력 저장 실패:", err);
      show(`빠른입력 저장에 실패했어요 (${firebaseErrorCode(err)})`);
    });
  };

  const desktopSelection: DesktopSelection | null = editingBag
    ? { kind: "bag", bagId: editingBag.id, focusPackId: bagFocus?.packId }
    : editingPack
    ? { kind: "pack", packId: editingPack.id }
    : null;

  const handleDesktopSelectionChange = (sel: DesktopSelection | null) => {
    if (!sel) {
      setEditingBag(null);
      setIsNewBag(false);
      setBagFocus(null);
      setEditingPack(null);
      return;
    }
    if (sel.kind === "bag") {
      const bag = activeBags.find((b) => b.id === sel.bagId);
      setEditingPack(null);
      if (bag) {
        setIsNewBag(false);
        setEditingBag(bag);
        setBagFocus(sel.focusPackId ? { packId: sel.focusPackId } : null);
      }
      return;
    }
    if (sel.kind === "pack") {
      const pack = [...activePacks, ...(quickPack ? [quickPack] : [])].find((p) => p.id === sel.packId);
      setEditingBag(null);
      setIsNewBag(false);
      setBagFocus(null);
      if (pack) setEditingPack(pack);
      return;
    }
  };

  if (isDesktop) {
    return (
      <>
        <DesktopShell
          user={user}
          profile={profile}
          bags={activeBags}
          libraryPacks={activePacks}
          quickPack={quickPack}
          lockedBagIds={lockedBagIds}
          selection={desktopSelection}
          onSelectionChange={handleDesktopSelectionChange}
          isNewBag={isNewBag}
          requestUnlockForBag={requestUnlockForBag}
          requestUnlockForPack={requestUnlockForPack}
          onNewBag={openNewBag}
          onSaveBag={handleSaveBag}
          onDeleteBag={handleDeleteBag}
          onRenameBag={handleRenameBag}
          onSaveAsLibraryPack={handleSaveAsLibraryPack}
          onTrashPackFromBag={handleTrashPackFromBag}
          onLeaveBag={handleLeaveBag}
          onRemoveMember={handleRemoveMember}
          onRegenerateInviteCode={handleRegenerateInviteCode}
          onTransferOwnership={handleTransferOwnership}
          onAddItemsToBagPack={handleAddItemsToBagPack}
          onRemoveItemsFromBagPack={handleRemoveItemsFromBagPack}
          onNewPack={openNewPack}
          onNewFolder={handleCreateFolder}
          onRenamePackEntry={handleRenameLibraryEntry}
          onMovePackEntries={handleMoveLibraryEntries}
          onSavePack={handleSavePack}
          onDeletePack={handleDeletePack}
          announcements={announcements}
          dismissedAnnouncementIds={dismissedIds}
          onDismissAnnouncement={handleDismissAnnouncement}
          onCreateAnnouncement={handleCreateAnnouncement}
          onUpdateAnnouncement={handleUpdateAnnouncement}
          onDeleteAnnouncement={handleDeleteAnnouncement}
          trashedBags={trashedBags}
          trashedPacks={trashedPacks}
          onRestoreBag={handleRestoreBag}
          onPermanentDeleteBag={handlePermanentDeleteBag}
          onRestorePack={handleRestorePack}
          onPermanentDeletePack={handlePermanentDeletePack}
        />
        {showIntroModal && introSlides.length > 0 && (
          <InitialGuideCarouselModal
            slides={introSlides}
            onClose={() => setShowIntroModal(false)}
          />
        )}
        {premiumLimitMessage && (
          <PremiumLimitModal
            message={premiumLimitMessage}
            onClose={() => setPremiumLimitMessage(null)}
            onUnlocked={() => {
              setPremiumLimitMessage(null);
              show("이용권 코드가 적용됐어요! 다시 시도해주세요");
            }}
          />
        )}
        <SplashScreen visible={showSplash} />
        <PremiumSyncOverlay visible={showPremiumSyncOverlay} />
        <CreatingBagOverlay visible={creatingBag} />
        <CreatingPackOverlay visible={creatingPack} />
      </>
    );
  }

  const tabOrder: TabKey[] = ["packs", "home", "settings"];
  const tabIndex = tabOrder.indexOf(tab);

  // 빈 배경(카드/버튼/입력이 아닌 곳)을 좌우로 스와이프/드래그하면 탭이 전환된다.
  const handleSwipeGestureEnd = (dx: number, dy: number, isMouse = false) => {
    // 세로 이동(dy)이 45px 이상이거나, 가로/세로 비율이 1.7 미만이면 세로 스크롤로 간주
    if (Math.abs(dy) > 45 || Math.abs(dx) < Math.abs(dy) * 1.7) return;
    // 마우스 드래그는 클릭 오발동 방지를 위해 더 높은 임계값(75px) 적용
    const minThreshold = isMouse ? 75 : 60;
    if (Math.abs(dx) < minThreshold) return;

    const currentIndex = tabOrder.indexOf(tab);
    if (dx < 0 && currentIndex < tabOrder.length - 1) {
      setTab(tabOrder[currentIndex + 1]);
    } else if (dx > 0 && currentIndex > 0) {
      setTab(tabOrder[currentIndex - 1]);
    }
  };

  // [data-own-swipe-back]은 useSwipeBack 훅이 자기 루트 요소에 직접 붙이는 마커다. 설정 하위화면처럼
  // 이 탭전환 스와이프 컨테이너 안에서 자체 useSwipeBack을 따로 가진 화면은, 그 화면이
  // 이미 자기 스와이프를 처리했으니 여기서 또 반응하면 한 번에 두 단계(하위화면 닫기 +
  // 탭 전환) 뒤로가는 버그가 생긴다.
  // 롱프레스/카드 드래그존([data-bag-drop-id], [data-pack-drop-id] 등)도 완벽하게 보호한다.
  const isSwipeIgnoredTarget = (target: EventTarget | null) =>
    !!(target as HTMLElement)?.closest?.(
      'button, a, input, textarea, [role="button"], [data-pack-drop-id], [data-bag-drop-id], [data-pack-tile-drop-id], [data-own-swipe-back], [data-dragging], .fixed'
    );

  const handleTouchStart = (e: React.TouchEvent) => {
    if (homeSelectMode || packsSelectMode) return;
    const ignore = isSwipeIgnoredTarget(e.target);
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY, ignore };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (homeSelectMode || packsSelectMode) return;
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.ignore) return;
    const t = e.changedTouches[0];
    handleSwipeGestureEnd(t.clientX - start.x, t.clientY - start.y, false);
  };

  // 데스크톱 웹(마우스)에서도 동일한 탭전환 제스처가 되도록 마우스 드래그도 처리
  const handleMouseDown = (e: React.MouseEvent) => {
    if (homeSelectMode || packsSelectMode) return;
    const ignore = isSwipeIgnoredTarget(e.target);
    swipeStartRef.current = { x: e.clientX, y: e.clientY, ignore };
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (homeSelectMode || packsSelectMode) return;
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.ignore) return;
    handleSwipeGestureEnd(e.clientX - start.x, e.clientY - start.y, true);
  };

  return (
    <>
      <div className="relative flex flex-col h-dvh mx-auto w-full max-w-3xl md:max-w-4xl bg-background pib-safe-top">
        <EmailVerifyBanner />
        <div
          className="flex-1 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          <div
            className="flex h-full"
            style={{
              width: "300%",
              transform: `translateX(-${tabIndex * (100 / 3)}%)`,
              transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {/* 1. 팩 보관함 탭 */}
            <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 / 3}%` }}>
              <PacksScreen
                uid={user.uid}
                packs={activePacks}
                bags={activeBags}
                quickPack={quickPack}
                onOpenPack={(pack, focusItemId, searchQuery) => {
                  setEditingPack(pack);
                  setPackFocusItemId(focusItemId ?? null);
                  setPackFocusSearchQuery(searchQuery ?? null);
                }}
                onOpenBag={(bag, focus) => {
                  setIsNewBag(false);
                  setEditingBag(bag);
                  setBagFocus(focus ?? null);
                }}
                onNewPack={openNewPack}
                onNewFolder={handleCreateFolder}
                onRenameEntry={handleRenameLibraryEntry}
                onMoveEntries={handleMoveLibraryEntries}
                onBulkDeletePacks={handleBulkDeletePacks}
                onSelectModeChange={setPacksSelectMode}
              />
            </div>

            {/* 2. 가방 보관함 탭 */}
            <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 / 3}%` }}>
              <HomeScreen
                uid={user.uid}
                bags={activeBags}
                packs={activePacks}
                initialInviteCode={inviteCodeFromUrl()}
                lockedBagIds={lockedBagIds}
                quickPack={quickPack}
                currentUid={user.uid}
                onOpenBag={(bag, focus) => {
                  setIsNewBag(false);
                  setEditingBag(bag);
                  setBagFocus(focus ?? null);
                }}
                onOpenPack={(pack, focusItemId, searchQuery) => {
                  setEditingPack(pack);
                  setPackFocusItemId(focusItemId ?? null);
                  setPackFocusSearchQuery(searchQuery ?? null);
                }}
                onNewBag={openNewBag}
                onImportNote={openNewBagFromNote}
                onJoinBag={handleJoinBag}
                onOpenQuickPack={() => quickPack && setEditingPack(quickPack)}
                onBulkDeleteBags={handleBulkDeleteBags}
                onSelectModeChange={setHomeSelectMode}
              />
            </div>

            {/* 3. 설정 탭 */}
            <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 / 3}%` }}>
              <SettingsScreen
                uid={user.uid}
                bags={activeBags}
                libraryPacks={activePacks}
                announcements={announcements}
                dismissedAnnouncementIds={dismissedIds}
                onDismissAnnouncement={handleDismissAnnouncement}
                onCreateAnnouncement={handleCreateAnnouncement}
                onUpdateAnnouncement={handleUpdateAnnouncement}
                onDeleteAnnouncement={handleDeleteAnnouncement}
                trashedBags={trashedBags}
                trashedPacks={trashedPacks}
                onRestoreBag={handleRestoreBag}
                onPermanentDeleteBag={handlePermanentDeleteBag}
                onRestorePack={handleRestorePack}
                onPermanentDeletePack={handlePermanentDeletePack}
                onBack={() => setTab("home")}
              />
            </div>
          </div>
        </div>
        {!homeSelectMode && !packsSelectMode && (
          <>
            <BottomTabBar active={tab} onChange={setTab} onQuickAdd={() => setShowQuickAdd(true)} />
            <InstallPrompt />
          </>
        )}
      </div>

      {/* 가방 편집기 - 팩보관함보다 한 단계 더 위(zIndex 65)에서 슬라이드-인. editingBag이
          onBack에서 바로 null이 되므로, 닫히는 애니메이션 동안엔 캐싱해둔 displayedBag로 그린다. */}
      <SlideScreen active={!!editingBag} zIndex={65}>
        {displayedBag &&
          (() => {
            const isEditingBagLocked = lockedBagIds.has(displayedBag.id);
            return (
              <BagEditorScreen
                initialBag={displayedBag}
                libraryPacks={activePacks}
                bags={activeBags}
                uid={user.uid}
                nickname={profile.nickname}
                avatarId={profile.avatarId}
                isNew={isNewBag}
                readOnly={isEditingBagLocked}
                onRequestUnlock={requestUnlockForBag}
                onBack={handleBackFromEditor}
                onSave={handleSaveBag}
                onDeleteBag={handleDeleteBag}
                onSaveAsLibraryPack={handleSaveAsLibraryPack}
                onTrashPackFromBag={handleTrashPackFromBag}
                onLeaveBag={handleLeaveBag}
                onRemoveMember={handleRemoveMember}
                onRegenerateInviteCode={handleRegenerateInviteCode}
                onTransferOwnership={handleTransferOwnership}
                focusTarget={bagFocus}
                onFocusHandled={() => setBagFocus(null)}
              />
            );
          })()}
      </SlideScreen>

      {showQuickAdd && (
        <QuickAddModal
          onClose={() => setShowQuickAdd(false)}
          onAdd={handleQuickAddItem}
        />
      )}

      {/* 팩 에디터 - 에디터형(자유문서형 메모 팩)은 노션 페이지처럼 풀스크린으로 오른쪽에서
          슬라이드-인, 체크리스트형은 기존대로 하단 시트로 아래에서 슬라이드-업. 두 경우 모두
          editingPack이 onBack에서 바로 null이 되므로 각자 캐싱해둔 값으로 그린다. */}
      <SlideScreen
        active={!!editingPack && editingPack.kind === "editor"}
        zIndex={70}
        innerClassName="flex flex-col h-full w-full mx-auto max-w-3xl md:max-w-6xl bg-background pib-safe-top"
      >
        {displayedEditorPack && (
          <PackNoteEditorScreen
            pack={displayedEditorPack}
            readOnly={false}
            initialSearchQuery={packFocusSearchQuery ?? undefined}
            onBack={() => {
              setEditingPack(null);
              setPackFocusItemId(null);
              setPackFocusSearchQuery(null);
            }}
            onSave={handleSavePack}
            onDeletePack={() => handleDeletePack(displayedEditorPack.id)}
            premium={premium}
          />
        )}
      </SlideScreen>

      <SlideUpSheet
        active={!!editingPack && editingPack.kind !== "editor"}
        zIndex={75}
        onBackdropClick={() => {
          setEditingPack(null);
          setPackFocusItemId(null);
        }}
      >
        {displayedSheetPack && (
          <PackLibraryEditorScreen
            variant="sheet"
            initialPack={displayedSheetPack}
            libraryPacks={activePacks}
            bags={activeBags}
            lockedBagIds={lockedBagIds}
            readOnly={false}
            onRequestUnlock={requestUnlockForPack}
            onBack={() => {
              setEditingPack(null);
              setPackFocusItemId(null);
            }}
            onSave={handleSavePack}
            onSaveOtherPack={handleSavePack}
            onDelete={handleDeletePack}
            onAddItemsToBagPack={handleAddItemsToBagPack}
            onRemoveItemsFromBagPack={handleRemoveItemsFromBagPack}
            focusItemId={packFocusItemId}
            onFocusHandled={() => setPackFocusItemId(null)}
          />
        )}
      </SlideUpSheet>

      {showIntroModal && introSlides.length > 0 && (
        <InitialGuideCarouselModal
          slides={introSlides}
          onClose={() => setShowIntroModal(false)}
        />
      )}
      {premiumLimitMessage && (
        <PremiumLimitModal
          message={premiumLimitMessage}
          onClose={() => setPremiumLimitMessage(null)}
          onUnlocked={() => {
            setPremiumLimitMessage(null);
            show("이용권 코드가 적용됐어요! 다시 시도해주세요");
          }}
        />
      )}
      <SplashScreen visible={showSplash} />
      <PremiumSyncOverlay visible={showPremiumSyncOverlay} />
      <CreatingBagOverlay visible={creatingBag} />
      <CreatingPackOverlay visible={creatingPack} />
      <DeletingBagsOverlay
        visible={bulkDeleting !== null}
        total={bulkDeleting?.total ?? 0}
        completed={bulkDeleting?.completed ?? 0}
      />
    </>
  );
}
