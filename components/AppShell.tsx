"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bag, Item, Pack, Announcement, ImportedBagResult } from "@/lib/types";
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
  removePacksFromBagRemote,
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
  collectDescendantPackIds,
} from "@/lib/packsService";
import { findLinkedBagPackRefs } from "@/lib/packSync";
import {
  getAnnouncementsOnce,
  createAnnouncementRemote,
  updateAnnouncementRemote,
  deleteAnnouncementRemote,
  dismissAnnouncementRemote,
  isAnnouncementActive,
} from "@/lib/announcementsService";
import { deleteBagImage } from "@/lib/storageService";
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
  subscribeLocalData,
} from "@/lib/localBagsService";
import AuthScreen from "@/components/v2/auth/AuthScreenV2";
import GoogleProfileSetup from "@/components/v2/auth/ProfileSetupV2";
import EmailVerifyBanner from "@/components/EmailVerifyBanner";
import InstallPrompt from "@/components/InstallPrompt";
import SplashScreen from "@/components/SplashScreen";
import HomeScreen from "@/components/v2/home/HomeScreenV2";
import PacksScreen from "@/components/v2/packs/PacksScreenV2";
import SettingsScreen from "@/components/v2/settings/SettingsScreenV2";
import BagEditorScreen from "@/components/v2/bag/BagScreenV2";
import PackLibraryEditorScreen from "@/components/v2/packs/PackEditorV2";
import PackNoteEditorScreen from "@/components/screens/PackNoteEditorScreen";
import SlideScreen from "@/components/SlideScreen";
import SlideUpSheet from "@/components/SlideUpSheet";
import { useToast } from "@/components/Toast";
import { firebaseErrorCode } from "@/lib/errorMessage";
import {
  isPremiumUser,
  FREE_MAX_ACTIVE_BAGS,
  QUICK_PACK_ID,
  PremiumLimitError,
  computeLockedBagIds,
  isTrashExpired,
} from "@/lib/premiumLimits";
import { PremiumSheet } from "@/components/v2/sheets/PremiumSheet";
import { QuickAddSheet } from "@/components/v2/sheets/QuickAddSheet";
import { AnnouncementSheet } from "@/components/v2/sheets/AnnouncementSheet";
import { TabBarV2 } from "@/components/v2/shell/TabBarV2";
import { BusyOverlay } from "@/components/v2/shell/BusyOverlay";
import { WideShell } from "@/components/v2/shell/WideShell";
import { WIDE_QUERY, useMediaQuery, type TabKey } from "@/lib/v2/shell";
import { RECONNECTED_EVENT, getConnectivity, reportNetworkFailure } from "@/lib/v2/connectivity";
import {
  PENDING_CHANGE_EVENT,
  addPendingBag,
  addPendingPack,
  flushPendingCreates,
  getPendingBags,
  getPendingPacks,
  isNetworkError,
  isPendingBag,
  isPendingPack,
  removePendingBag,
  removePendingPack,
  withPending,
} from "@/lib/v2/pendingCreates";
import { OfflineImportSheet } from "@/components/v2/settings/OfflineImportSheet";
import { EASE_OUT, settleDuration, shouldCommit, useHorizontalSwipe } from "@/lib/useHorizontalSwipe";
import { ConnectionBar } from "@/components/v2/shell/ConnectionBar";
import { FirestoreRecoveryOverlay } from "@/components/v2/shell/FirestoreRecoveryOverlay";
import { OpenDetailContext } from "@/lib/v2/openDetail";
import { getOfflineDataSummary } from "@/lib/offlineImportService";

// 시작 공지 시트에 띄울 항목(안 본 공지)
type AnnouncementEntry = { id: string; announcement: Announcement; onDismiss: () => void };

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// 리디자인 v2: 탭 순서와 탭 넘기기 위치·전환. 손가락을 따라 움직이는 동안에는 같은 모양의 문자열을 직접 쓴다
const TAB_ORDER: TabKey[] = ["packs", "home", "settings"];
const TAB_TRANSITION = `transform 280ms ${EASE_OUT}`;
const tabTrackTransform = (index: number) => `translate3d(${-index * (100 / 3)}%, 0, 0)`;

function inviteCodeFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("invite")?.toUpperCase() ?? "";
}

export default function AppShell() {
  const { user, profile, loading, authBusy, isMaster, isOfflineMode } = useAuth();
  const { show } = useToast();
  // 넓은 화면: 900px 이상은 [목록 | 상세](1200px 이상은 레일까지) 한 셸
  const wide = useMediaQuery(WIDE_QUERY);

  const [bags, setBags] = useState<Bag[]>([]);
  const [libraryPacks, setLibraryPacks] = useState<Pack[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [tab, setTab] = useState<TabKey>("home");
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

  // 원격 Firestore에서 libraryPacks가 실시간 갱신될 때, 현재 열려 있는 에디터 팩 최신본으로 실시간 동기화
  useEffect(() => {
    if (!editingPack || editingPack.kind !== "editor") return;
    const remotePack = libraryPacks.find((p) => p.id === editingPack.id);
    if (!remotePack) return;
    const isDocDifferent =
      JSON.stringify(remotePack.editorDoc ?? null) !== JSON.stringify(editingPack.editorDoc ?? null);
    if (
      remotePack.updatedAt !== editingPack.updatedAt ||
      remotePack.name !== editingPack.name ||
      isDocDifferent
    ) {
      setDisplayedEditorPack(remotePack);
    }
  }, [libraryPacks, editingPack]);

  // 끊김 → 연결 때 Firestore 네트워크 다시 켜기는 lib/v2/connectivity 한 곳에서만 한다.
  // (예전에는 여기서도 online 이벤트마다 enableNetwork를 불렀는데, 절전에서 깨어날 때 SDK의 자체 재연결과
  // 겹쳐 불리는 것을 줄이려고 뺐다. 2026-10-06)

  const [displayedSheetPack, setDisplayedSheetPack] = useState<Pack | null>(null);
  useEffect(() => {
    if (!editingPack || editingPack.kind === "editor") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayedSheetPack(editingPack);
  }, [editingPack]);

  useEffect(() => {
    if (!editingPack || editingPack.kind === "editor") return;
    const remotePack = libraryPacks.find((p) => p.id === editingPack.id);
    if (!remotePack) return;
    if (remotePack.updatedAt !== editingPack.updatedAt || remotePack.name !== editingPack.name) {
      setDisplayedSheetPack(remotePack);
    }
  }, [libraryPacks, editingPack]);
  // 가방 보관함/팩 보관함 상단 검색 결과를 눌러서 들어왔을 때만 채워진다. 각각
  // BagEditorScreen(focusTarget)/PackLibraryEditorScreen(focusItemId)/PackNoteEditorScreen(initialSearchQuery)에 그대로 넘겨서 해당
  // 팩(+아이템/메모 텍스트)까지 자동 스크롤 + 하이라이트하게 한다. 한 번 쓰고 나면(onFocusHandled) 다시 null로 비운다.
  const [bagFocus, setBagFocus] = useState<{ packId?: string; itemId?: string; searchQuery?: string } | null>(null);
  const [packFocusItemId, setPackFocusItemId] = useState<string | null>(null);
  const [packFocusSearchQuery, setPackFocusSearchQuery] = useState<string | null>(null);
  const [packsSelectMode, setPacksSelectMode] = useState(false);
  // 하단 중앙 "+" 버튼(빠른입력) 모달 표시 여부.
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [splashMinTimeDone, setSplashMinTimeDone] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [introEntries, setIntroEntries] = useState<AnnouncementEntry[]>([]);
  const introCheckedRef = useRef(false);
  const [premiumLimitMessage, setPremiumLimitMessage] = useState<string | null>(null);
  // v2: 로그인했는데 이 기기에 오프라인 모드로 만든 가방·팩이 있으면 합치기 시트를 한 번 띄운다(연결 흐름 E)
  const [mergeOfflineOpen, setMergeOfflineOpen] = useState(false);
  const [showPremiumSyncOverlay, setShowPremiumSyncOverlay] = useState(false);
  // 새 가방을 Firestore에 쓰는 동안(openNewBag/openNewBagFromNote) true. CreatingBagOverlay를
  // 띄우는 용도로만 쓰이고, 실제 가방 생성 로직에는 영향을 주지 않는다.
  const [creatingBag, setCreatingBag] = useState(false);
  // 가방보관함 화면(HomeScreen)에서 다중 선택 모드(롱프레스) 중일 때 true.
  // 이 동안에는 하단 탭바와 팩트리 힌트 플로팅 버튼을 숨겨 가방 정리에만 집중시킨다.
  const [homeSelectMode, setHomeSelectMode] = useState(false);
  // 가방 다중 삭제/나가기 처리 중 진행률 ({ total, completed })
  const [bulkDeleting, setBulkDeleting] = useState<{ total: number; completed: number } | null>(null);

  // 탭(팩·가방·설정) 사이를 손가락을 따라 넘긴다. 화면 안쪽(폴더·보관함 뒤로가기,
  // 가로로 넘기는 목록)이 먼저 가져가면 양보한다(lib/useHorizontalSwipe.ts). 첫·마지막 탭에서는 고무줄처럼 조금만 따라온다.
  const tabTrackRef = useRef<HTMLDivElement>(null);
  const tabDragRef = useRef({ index: 0, width: 1 });
  const tabSwipeRef = useHorizontalSwipe<HTMLDivElement>(
    {
      claim: (_dir, _start, el) => {
        if (homeSelectMode || packsSelectMode || !tabTrackRef.current) return false;
        tabDragRef.current = { index: TAB_ORDER.indexOf(tab), width: el.clientWidth || window.innerWidth };
        return true;
      },
      move: (dx) => {
        const track = tabTrackRef.current;
        if (!track) return;
        const { index } = tabDragRef.current;
        const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === TAB_ORDER.length - 1);
        const offset = Math.round(atEdge ? dx * 0.25 : dx);
        track.style.transition = "none";
        track.style.transform = `translate3d(calc(${-index * (100 / 3)}% + ${offset}px), 0, 0)`;
      },
      end: (dx, velocity) => {
        const track = tabTrackRef.current;
        if (!track) return;
        const { index, width } = tabDragRef.current;
        let next = index;
        if (shouldCommit(dx, velocity, width)) {
          next = Math.max(0, Math.min(TAB_ORDER.length - 1, index + (dx < 0 ? 1 : -1)));
        }
        const remaining = next === index ? Math.abs(dx) : width - Math.abs(dx);
        const ms = settleDuration(remaining, velocity, 180, 340);
        track.style.transition = `transform ${ms}ms ${EASE_OUT}`;
        track.style.transform = tabTrackTransform(next);
        window.setTimeout(() => {
          if (tabTrackRef.current) tabTrackRef.current.style.transition = TAB_TRANSITION;
        }, ms + 30);
        if (next !== index) setTab(TAB_ORDER[next]);
      },
    }
  );

  useEffect(() => {
    const t = setTimeout(() => setSplashMinTimeDone(true), 900);
    return () => clearTimeout(t);
  }, []);

  const showSplash = loading || !splashMinTimeDone;

  useEffect(() => {
    if (!user) return;
    if (isOfflineMode) {
      setBags(getLocalBags());
      return subscribeLocalData(() => {
        setBags(getLocalBags());
      });
    }
    // v2: 끊겨 있을 때 만든 "만들기 대기" 가방도 목록에 함께 보여 준다(lib/v2/pendingCreates)
    const uid = user.uid;
    let remote: Bag[] = [];
    const emit = () => setBags(withPending(remote, getPendingBags(uid)));
    window.addEventListener(PENDING_CHANGE_EVENT, emit);
    const unsub = subscribeToUserBags(uid, (b) => {
      remote = b;
      emit();
    });
    return () => {
      unsub();
      window.removeEventListener(PENDING_CHANGE_EVENT, emit);
    };
  }, [user, isOfflineMode]);

  // v2: 다시 연결되면(또는 앱을 켰을 때) 대기 중인 가방·팩을 서버에 만든다. 무료 개수를 넘었으면 남겨 두고 프리미엄 안내
  useEffect(() => {
    if (!user || isOfflineMode) return;
    const run = () => {
      flushPendingCreates(user, {
        createBag: createBagRemote,
        saveBag: saveBagRemote,
        createPack: (u, p) => saveLibraryPackRemote(u, p, true),
        isLimitError: (e) => e instanceof PremiumLimitError,
      })
        .then((r) => {
          if (r.created > 0) show(`끊겨 있는 동안 만든 ${r.created}개를 계정에 올렸어요`);
          if (r.blockedMessage) setPremiumLimitMessage(r.blockedMessage);
        })
        .catch(() => {});
    };
    if (getConnectivity() !== "offline") run();
    window.addEventListener(RECONNECTED_EVENT, run);
    return () => window.removeEventListener(RECONNECTED_EVENT, run);
  }, [user, isOfflineMode, show]);

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
    const uid = user.uid;
    let remote: Pack[] = [];
    const emit = () => setLibraryPacks(withPending(remote, getPendingPacks(uid)));
    window.addEventListener(PENDING_CHANGE_EVENT, emit);
    const unsub = subscribeToLibraryPacks(uid, (p) => {
      remote = p;
      emit();
    });
    return () => {
      unsub();
      window.removeEventListener(PENDING_CHANGE_EVENT, emit);
    };
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
  // 하단 "+"(빠른입력) 버튼으로 만들어지는 시스템 팩. 사용자당 최대 1개, 고정 id.
  const quickPack = libraryPacks.find((p) => p.id === QUICK_PACK_ID);
  // v2: 빠른팩 + → 빠른팩에 적어 둔 게 있으면 그 내용을 바로 연다(아래 입력칸으로 계속 추가). 비어 있으면 빠른 입력 시트
  const openQuickAdd = () => {
    if (quickPack && quickPack.items.length > 0) {
      setEditingPack(quickPack);
      return;
    }
    setShowQuickAdd(true);
  };

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

  // 앱 진입 시(로그인 이후, 게스트 포함): 안 본 공지를 시작 공지 시트로 하나씩 띄운다.
  useEffect(() => {
    if (introCheckedRef.current || isOfflineMode) return;
    if (!profile) return;
    introCheckedRef.current = true;

    const entries: AnnouncementEntry[] = activeUndismissed.map((a) => ({
      id: `announcement-${a.id}`,
      announcement: a,
      onDismiss: () => handleDismissAnnouncement(a.id),
    }));

    if (entries.length > 0) {
      setIntroEntries(entries);
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

  // 온라인 로그인 시 로컬 스토리지에 미가져온 오프라인 데이터가 있으면 1회 토스트 안내
  useEffect(() => {
    if (isOfflineMode || !user || user.isAnonymous) return;
    try {
      const summary = getOfflineDataSummary();
      if (summary.totalUnimportedCount > 0) {
        const alerted = sessionStorage.getItem("pib_offline_import_notified");
        if (!alerted) {
          sessionStorage.setItem("pib_offline_import_notified", "true");
          // eslint-disable-next-line react-hooks/set-state-in-effect -- 로그인 직후 한 번만 여는 시트(세션당 1회 플래그로 막음)
          setMergeOfflineOpen(true);
        }
      }
    } catch {}
  }, [isOfflineMode, user]);

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

  // 무료 개수 제한은 "내가 소유한, 휴지통에 없는 가방"만 센다 - app/api/create-bag의 서버
  // 카운트/lib/premiumLimits.ts의 computeLockedBagIds와 동일한 기준. 여기서는 무료일 때
  // 버튼을 눌렀을 때 서버 응답을 기다리지 않고 바로 안내 모달을 띄우기 위해 클라이언트에서도
  // 거의 동일한 검사를 미리 한 번 해본다(실제 강제는 서버 쪽에서 한다).
  const ownedBagCount = activeBags.filter((b) => b.ownerId === user.uid).length;

  // v2: 계정 모드인데 인터넷이 안 되면(폐쇄망 포함) "만들기 대기"로 만들고 그대로 연다. 연결되면 자동으로 서버에 만든다
  // navigator.onLine은 iOS 웹뷰에서 늦게 바뀌는 경우가 있어 보지 않는다(앱 공통 연결 판단만 쓴다)
  const offlineNow = () => getConnectivity() === "offline";
  const createPendingBag = (draft: Bag) => {
    addPendingBag(user.uid, draft, { nickname: profile.nickname!, avatarId: profile.avatarId! });
    setIsNewBag(false);
    setEditingBag(draft);
    show("가방을 만들었어요. 인터넷에 연결되면 계정에 올라가요");
    return draft;
  };

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
    if (offlineNow()) return createPendingBag(draft);
    // 넓은 화면: 손대지 않은 새 가방이 열려 있으면 지우고 새로 만든다(빈 가방이 쌓이지 않게)
    if (editingBag && isNewBag) handleBackFromEditor(editingBag);
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
      if (isNetworkError(err)) {
        reportNetworkFailure();
        return createPendingBag(draft);
      }
      console.error("[팩인백] 가방 생성 실패:", err);
      show(`가방 생성에 실패했어요 (${firebaseErrorCode(err)})`);
    } finally {
      setCreatingBag(false);
    }
  };

  // 메모 AI 가져오기뿐 아니라 샘플 템플릿 선택, 해시태그 AI 생성 결과도 모두
  // 동일한 형태(ImportedBagResult)라서 이 함수를 함께 쓴다.
  const openNewBagFromNote = async (result: ImportedBagResult) => {
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
    const isOffline = isOfflineMode || (typeof navigator !== "undefined" && !navigator.onLine);
    if (isOffline) {
      saveLocalBag(draft);
      setEditingBag(draft);
      setIsNewBag(false);
      show(
        isOfflineMode
          ? "가방을 만들었어요"
          : "오프라인 상태에서 로컬 가방으로 만들었어요. 인터넷 연결 후 [설정 > 오프라인 데이터 가져오기]로 계정에 보관할 수 있어요"
      );
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
    // 아직 서버에 없는 "만들기 대기" 가방은 대기 목록에서만 지운다
    if (isPendingBag(user.uid, bag.id)) {
      removePendingBag(user.uid, bag.id);
      show("가방을 지웠어요");
      return;
    }
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
    // v2: 계정 모드에서 끊겼을 때 이 기기 오프라인 저장소로 빠지지 않고 "만들기 대기"로 둔다(연결되면 자동 생성)
    if (isOfflineMode) {
      setEditingPack(draft);
      saveLocalLibraryPack(draft);
      return draft;
    }
    if (offlineNow()) {
      addPendingPack(user.uid, draft);
      setEditingPack(draft);
      show("팩을 만들었어요. 인터넷에 연결되면 계정에 올라가요");
      return draft;
    }
    setEditingPack(draft);
    setCreatingPack(true);
    try {
      await saveLibraryPackRemote(user, draft);
      return draft;
    } catch (err) {
      if (isNetworkError(err)) {
        reportNetworkFailure();
        addPendingPack(user.uid, draft);
        show("팩을 만들었어요. 인터넷에 연결되면 계정에 올라가요");
        return draft;
      }
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
  const handleCreateFolder = async (parentId?: string, name?: string) => {
    const draft: Pack = {
      id: uid(),
      name: name?.trim() || "새 폴더",
      items: [],
      type: "folder",
      parentId,
    };
    const isOffline = isOfflineMode || (typeof navigator !== "undefined" && !navigator.onLine);
    if (isOffline) {
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

  // 보관함 팩(폴더면 하위 팩까지)을 불러온 가방 속 사본을 지운다(삭제 확인의 "가방 속 사본도 같이 지우기").
  // 예전에는 확인창이 이 값을 넘겨도 여기서 받지 않아 사본이 그대로 남았다. 잠긴(읽기 전용) 가방은
  // firestore.rules가 쓰기를 막으므로 건너뛴다. 지운 사본 개수를 돌려준다.
  const removeLinkedBagCopies = async (libraryIds: string[]): Promise<number> => {
    const ids = new Set<string>();
    libraryIds.forEach((id) => {
      ids.add(id);
      collectDescendantPackIds(activePacks, id).forEach((d) => ids.add(d));
    });
    const refs = findLinkedBagPackRefs(
      activeBags.filter((b) => !lockedBagIds.has(b.id)),
      ids
    );
    if (refs.length === 0) return 0;
    const byBag = new Map<string, string[]>();
    refs.forEach((r) => byBag.set(r.bagId, [...(byBag.get(r.bagId) ?? []), r.packId]));
    await Promise.all(Array.from(byBag, ([bagId, packIds]) => removePacksFromBagRemote(bagId, packIds)));
    return refs.length;
  };

  const trashedMessage = (base: string, copies: number) =>
    copies > 0 ? `${base} · 가방 속 사본 ${copies}개도 지웠어요` : base;

  // 완전삭제 대신 휴지통으로 보낸다. BagEditorScreen 내부에서 팩을 지울 때(가방 속 팩
  // 삭제)와는 다른 함수다 - 이건 보관함 화면(PackLibraryEditorScreen)의 "삭제" 버튼용.
  // 이 팩은 늘 하위 항목이 없으니(폴더가 아니므로) 단일 항목으로 충분.
  const handleDeletePack = (packId: string, alsoDeleteFromBags?: boolean) => {
    setEditingPack(null);
    if (isPendingPack(user.uid, packId)) {
      removePendingPack(user.uid, packId);
      show("팩을 지웠어요");
      return;
    }
    const copiesTask = alsoDeleteFromBags ? removeLinkedBagCopies([packId]) : Promise.resolve(0);
    if (isOfflineMode) {
      deleteLocalLibraryPack(packId);
      copiesTask
        .then((n) => show(trashedMessage("팩을 휴지통으로 보냈어요", n)))
        .catch(() => show("팩은 휴지통으로 보냈지만 가방 속 사본을 지우지 못했어요"));
      return;
    }
    trashLibraryEntryRecursive(user.uid, activePacks, packId)
      .then(() =>
        copiesTask
          .then((n) => show(trashedMessage("팩을 휴지통으로 보냈어요", n)))
          .catch((err) => {
            console.error("[팩인백] 가방 속 사본 삭제 실패:", err);
            show("팩은 휴지통으로 보냈지만 가방 속 사본을 지우지 못했어요");
          })
      )
      .catch((err) => {
        console.error("[팩인백] 팩 휴지통 이동 실패:", err);
        show(`팩을 휴지통으로 보내지 못했어요 (${firebaseErrorCode(err)})`);
      });
  };

  // 팩 보관함에서 길게 눌러 다중선택한 팩/폴더를 한꺼번에 휴지통으로 보낸다. 폴더를 선택했으면
  // 아이폰 메모처럼 하위 팩/폴더까지 모두 함께 보낸다(trashLibraryEntryRecursive).
  const handleBulkDeletePacks = async (packIds: string[], alsoDeleteFromBags?: boolean) => {
    if (isOfflineMode) {
      const n = alsoDeleteFromBags ? await removeLinkedBagCopies(packIds).catch(() => 0) : 0;
      packIds.forEach((id) => deleteLocalLibraryPack(id));
      show(trashedMessage(`${packIds.length}개를 휴지통으로 보냈어요`, n));
      return;
    }
    try {
      // 하위 팩 id를 모으려면 휴지통으로 보내기 전 목록이 필요하다 - 사본 지우기를 먼저 한다
      const n = alsoDeleteFromBags ? await removeLinkedBagCopies(packIds) : 0;
      await Promise.all(packIds.map((id) => trashLibraryEntryRecursive(user.uid, activePacks, id)));
      show(trashedMessage(`${packIds.length}개를 휴지통으로 보냈어요`, n));
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

  // 빠른팩(다중선택) 이동 부해 - 특정 가방의 특정 팩 안으로 아이템을 이동한다. 지금
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
      console.error("[팩인백] 가방으로 아이템 이동 실패:", err);
      show(`가방으로 이동하는 데 실패했어요 (${firebaseErrorCode(err)})`);
    });
  };

  // 위 handleAddItemsToBagPack의 되돌리기(토스트 "되돌리기")용 - 방금 옮긴 아이템만 id 기준으로
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

  // ---- 화면 조각(좁은 화면·넓은 화면 공통) -------------------------------------------------
  // 넓은 화면에서는 상세 칸에 하나만 보인다: 팩·메모가 열려 있으면 그것, 아니면 가방. 가방을 새로 고르면 열려 있던 팩은 닫는다
  // 만들기만 하고 손대지 않은 새 가방(isNewBag)을 둔 채 다른 가방을 고르면 그 빈 가방은 지운다(모바일의 뒤로가기와 같은 정리)
  const openBag = (bag: Bag, focus?: { packId?: string; itemId?: string; searchQuery?: string } | null) => {
    if (editingBag && isNewBag && editingBag.id !== bag.id) handleBackFromEditor(editingBag);
    setIsNewBag(false);
    setEditingBag(bag);
    setBagFocus(focus ?? null);
    if (wide) setEditingPack(null);
  };
  const openPack = (pack: Pack, focusItemId?: string, searchQuery?: string) => {
    setEditingPack(pack);
    setPackFocusItemId(focusItemId ?? null);
    setPackFocusSearchQuery(searchQuery ?? null);
  };
  const closePack = () => {
    setEditingPack(null);
    setPackFocusItemId(null);
    setPackFocusSearchQuery(null);
  };

  const packsScreenEl = (
    <PacksScreen
      uid={user.uid}
      packs={activePacks}
      bags={activeBags}
      quickPack={quickPack}
      onOpenPack={openPack}
      onOpenBag={openBag}
      onNewPack={openNewPack}
      onNewFolder={handleCreateFolder}
      onRenameEntry={handleRenameLibraryEntry}
      onMoveEntries={handleMoveLibraryEntries}
      onBulkDeletePacks={handleBulkDeletePacks}
      onSelectModeChange={setPacksSelectMode}
    />
  );
  const homeScreenEl = (
    <HomeScreen
      uid={user.uid}
      bags={activeBags}
      packs={activePacks}
      initialInviteCode={inviteCodeFromUrl()}
      lockedBagIds={lockedBagIds}
      quickPack={quickPack}
      currentUid={user.uid}
      onOpenBag={openBag}
      onOpenPack={openPack}
      onNewBag={openNewBag}
      onImportNote={openNewBagFromNote}
      onJoinBag={handleJoinBag}
      onOpenQuickPack={() => quickPack && setEditingPack(quickPack)}
      onBulkDeleteBags={handleBulkDeleteBags}
      onSelectModeChange={setHomeSelectMode}
    />
  );
  const settingsScreenEl = (
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
  );

  const renderBag = (bag: Bag) => (
    <BagEditorScreen
      key={bag.id}
      initialBag={bag}
      libraryPacks={activePacks}
      bags={activeBags}
      uid={user.uid}
      nickname={profile.nickname!}
      avatarId={profile.avatarId!}
      isNew={isNewBag}
      readOnly={lockedBagIds.has(bag.id)}
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
  const renderMemo = (pack: Pack) => (
    <PackNoteEditorScreen
      key={pack.id}
      pack={pack}
      readOnly={false}
      initialSearchQuery={packFocusSearchQuery ?? undefined}
      onBack={closePack}
      onSave={handleSavePack}
      onDeletePack={() => handleDeletePack(pack.id)}
      premium={premium}
    />
  );
  const renderPackEditor = (pack: Pack) => (
    <PackLibraryEditorScreen
      key={pack.id}
      variant="sheet"
      initialPack={pack}
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
  );

  // ---- 넓은 화면(웹 PC · 아이패드 가로 · 포터블 앱) ------------------------------------------
  if (wide) {
    // 편집 중인 팩은 보관함 최신본으로(다른 기기 수정 반영). 다른 팩을 고른 직후에는 캐시가 아직 예전 팩이라 id로 확인한다
    const latestMemo = displayedEditorPack?.id === editingPack?.id ? displayedEditorPack : editingPack;
    const latestSheetPack = displayedSheetPack?.id === editingPack?.id ? displayedSheetPack : editingPack;
    const detail = editingPack ? (
      editingPack.kind === "editor" ? (
        <div className="flex h-full min-h-0 flex-col bg-background">{renderMemo(latestMemo ?? editingPack)}</div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">{renderPackEditor(latestSheetPack ?? editingPack)}</div>
      )
    ) : editingBag ? (
      renderBag(editingBag)
    ) : null;

    return (
      <>
        <FirestoreRecoveryOverlay />
        <ConnectionBar />
        <WideShell
          tab={tab}
          onTab={setTab}
          onQuickAdd={openQuickAdd}
          list={
            <OpenDetailContext.Provider value={{ bagId: editingPack ? undefined : editingBag?.id, packId: editingPack?.id }}>
              {tab === "packs" ? packsScreenEl : tab === "settings" ? settingsScreenEl : homeScreenEl}
            </OpenDetailContext.Provider>
          }
          detail={detail}
          offline={isOfflineMode}
          onNewBag={() => void openNewBag()}
          onNewPack={() => void openNewPack()}
          onCloseDetail={() => {
            if (editingPack) closePack();
            else if (editingBag) handleBackFromEditor(editingBag);
          }}
          banner={<EmailVerifyBanner />}
        />
        <QuickAddSheet
          open={showQuickAdd}
          onClose={() => setShowQuickAdd(false)}
          onAdd={handleQuickAddItem}
          savedCount={quickPack?.items.length ?? 0}
          onOpenQuickPack={() => {
            setShowQuickAdd(false);
            if (quickPack) setEditingPack(quickPack);
          }}
        />
        <AnnouncementSheet
          open={showIntroModal}
          entries={introEntries}
          onClose={() => setShowIntroModal(false)}
        />
        <PremiumSheet
          open={!!premiumLimitMessage}
          message={premiumLimitMessage}
          onClose={() => setPremiumLimitMessage(null)}
          onUnlocked={() => {
            setPremiumLimitMessage(null);
            show("프리미엄이 적용됐어요. 다시 시도해 주세요");
          }}
        />
        <OfflineImportSheet
          open={mergeOfflineOpen}
          mode="merge"
          onClose={() => setMergeOfflineOpen(false)}
          onLimit={setPremiumLimitMessage}
        />
        <SplashScreen visible={showSplash} />
        <BusyOverlay visible={showPremiumSyncOverlay} />
        <BusyOverlay visible={creatingBag} message="가방을 만들고 있어요" />
        <BusyOverlay visible={creatingPack} message="팩을 만들고 있어요" />
        <BusyOverlay
          visible={bulkDeleting !== null}
          message="가방을 정리하고 있어요"
          progress={{ total: bulkDeleting?.total ?? 0, completed: bulkDeleting?.completed ?? 0 }}
        />
      </>
    );
  }

  const tabIndex = TAB_ORDER.indexOf(tab);

  // 탭 3개를 가로로 잇대어 둔 트랙(좌우로 넘김)
  const tabArea = (
    <div ref={tabSwipeRef} className="flex-1 overflow-hidden">
      <div
        ref={tabTrackRef}
        className="flex h-full"
        style={{
          width: "300%",
          transform: tabTrackTransform(tabIndex),
          transition: TAB_TRANSITION,
        }}
      >
        {/* 1. 팩 보관함 탭 */}
        <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 / 3}%` }}>
          {packsScreenEl}
        </div>

        {/* 2. 가방 보관함 탭 */}
        <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 / 3}%` }}>
          {homeScreenEl}
        </div>

        {/* 3. 설정 탭 */}
        <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 / 3}%` }}>
          {settingsScreenEl}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <FirestoreRecoveryOverlay />
      <ConnectionBar />
      <div className="relative flex flex-col flex-1 h-dvh mx-auto w-full max-w-3xl md:max-w-4xl bg-background pib-safe-top overflow-hidden">
        <EmailVerifyBanner />
        {/* 탭바는 탭 화면 위에 떠 있다(위치 기준 = 이 칸). 탭 넘기기 스와이프 영역(tabArea) 밖의 형제라
            탭바를 끌어도 탭이 넘어가지 않는다. 높이는 탭바가 재서 이 칸의 --pib-dock으로 적는다 */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {tabArea}
          {!homeSelectMode && !packsSelectMode && (
            <TabBarV2 active={tab} onChange={setTab} onQuickAdd={openQuickAdd} />
          )}
        </div>
        {!homeSelectMode && !packsSelectMode && <InstallPrompt />}
      </div>

      {/* 가방 편집기 - 팩보관함보다 한 단계 더 위(zIndex 65)에서 슬라이드-인. editingBag이
          onBack에서 바로 null이 되므로, 닫히는 애니메이션 동안엔 캐싱해둔 displayedBag로 그린다. */}
      <SlideScreen
        active={!!editingBag}
        zIndex={65}
        swipeBack
        innerClassName="flex flex-col h-full w-full bg-background pib-safe-top"
      >
        {displayedBag && renderBag(displayedBag)}
      </SlideScreen>

      <QuickAddSheet
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onAdd={handleQuickAddItem}
        savedCount={quickPack?.items.length ?? 0}
        onOpenQuickPack={() => {
          setShowQuickAdd(false);
          if (quickPack) setEditingPack(quickPack);
        }}
      />

      {/* 팩 에디터 - 에디터형(자유문서형 메모 팩)은 노션 페이지처럼 풀스크린으로 오른쪽에서
          슬라이드-인, 체크리스트형은 기존대로 하단 시트로 아래에서 슬라이드-업. 두 경우 모두
          editingPack이 onBack에서 바로 null이 되므로 각자 캐싱해둔 값으로 그린다. */}
      <SlideScreen
        active={!!editingPack && editingPack.kind === "editor"}
        zIndex={70}
        swipeBack
        onSwipeBack={() => {
          setEditingPack(null);
          setPackFocusItemId(null);
          setPackFocusSearchQuery(null);
        }}
        innerClassName="flex flex-col h-full w-full mx-auto max-w-3xl md:max-w-6xl bg-background pib-safe-top"
      >
        {displayedEditorPack && renderMemo(displayedEditorPack)}
      </SlideScreen>

      <SlideUpSheet
        active={!!editingPack && editingPack.kind !== "editor"}
        zIndex={75}
        onBackdropClick={() => {
          setEditingPack(null);
          setPackFocusItemId(null);
        }}
      >
        {displayedSheetPack && renderPackEditor(displayedSheetPack)}
      </SlideUpSheet>

      <AnnouncementSheet
        open={showIntroModal}
        entries={introEntries}
        onClose={() => setShowIntroModal(false)}
      />
      <PremiumSheet
        open={!!premiumLimitMessage}
        message={premiumLimitMessage}
        onClose={() => setPremiumLimitMessage(null)}
        onUnlocked={() => {
          setPremiumLimitMessage(null);
          show("프리미엄이 적용됐어요. 다시 시도해 주세요");
        }}
      />
      <SplashScreen visible={showSplash} />
      <OfflineImportSheet
        open={mergeOfflineOpen}
        mode="merge"
        onClose={() => setMergeOfflineOpen(false)}
        onLimit={setPremiumLimitMessage}
      />
      <BusyOverlay visible={showPremiumSyncOverlay} />
      <BusyOverlay visible={creatingBag} message="가방을 만들고 있어요" />
      <BusyOverlay visible={creatingPack} message="팩을 만들고 있어요" />
      <BusyOverlay
        visible={bulkDeleting !== null}
        message="가방을 정리하고 있어요"
        progress={{ total: bulkDeleting?.total ?? 0, completed: bulkDeleting?.completed ?? 0 }}
      />
    </>
  );
}