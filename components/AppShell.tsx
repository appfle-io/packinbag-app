"use client";

import { useEffect, useRef, useState } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { Bag, Item, Pack, Announcement } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import {
  subscribeToUserBags,
  createBagRemote,
  saveBagRemote,
  deleteBagWithInviteCodeRemote,
  trashBagRemote,
  restoreBagRemote,
  joinBagByCode,
  leaveBagRemote,
  removeMemberRemote,
  regenerateInviteCodeRemote,
  updateMemberProfileSnapshot,
} from "@/lib/bagsService";
import {
  subscribeToLibraryPacks,
  saveLibraryPackRemote,
  deleteLibraryPackRemote,
  trashLibraryEntryRecursive,
  restoreLibraryEntryRecursive,
  deleteLibraryEntryRecursive,
} from "@/lib/packsService";
import {
  subscribeToAnnouncements,
  createAnnouncementRemote,
  updateAnnouncementRemote,
  deleteAnnouncementRemote,
  dismissAnnouncementRemote,
  isAnnouncementActive,
} from "@/lib/announcementsService";
import { deleteBagImage } from "@/lib/storageService";
import AuthScreen from "@/components/auth/AuthScreen";
import GoogleProfileSetup from "@/components/auth/GoogleProfileSetup";
import EmailVerifyBanner from "@/components/EmailVerifyBanner";
import InstallPrompt from "@/components/InstallPrompt";
import BottomTabBar, { TabKey } from "@/components/BottomTabBar";
import { NoteImportResult } from "@/components/NoteImportModal";
import SplashScreen from "@/components/SplashScreen";
import AnnouncementPopupStack from "@/components/AnnouncementPopupStack";
import HomeScreen from "@/components/screens/HomeScreen";
import PacksScreen from "@/components/screens/PacksScreen";
import SettingsScreen from "@/components/screens/SettingsScreen";
import BagEditorScreen from "@/components/screens/BagEditorScreen";
import PackLibraryEditorScreen from "@/components/screens/PackLibraryEditorScreen";
import QuickAddModal from "@/components/QuickAddModal";
import Portal from "@/components/Portal";
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
import PremiumLimitModal from "@/components/PremiumLimitModal";

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

export default function AppShell() {
  const { user, profile, loading, authBusy } = useAuth();
  const { show } = useToast();

  const [bags, setBags] = useState<Bag[]>([]);
  const [libraryPacks, setLibraryPacks] = useState<Pack[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [tab, setTab] = useState<TabKey>("home");
  const appliedDefaultTabRef = useRef(false);
  const [editingBag, setEditingBag] = useState<Bag | null>(null);
  const [isNewBag, setIsNewBag] = useState(false);
  const [editingPack, setEditingPack] = useState<Pack | null>(null);
  // 가방 보관함/팩 보관함 상단 검색 결과를 눌러서 들어왔을 때만 채워진다. 각각
  // BagEditorScreen(focusTarget)/PackLibraryEditorScreen(focusItemId)에 그대로 넘겨서 해당
  // 팩(+짐)까지 자동 스크롤 + 하이라이트하게 한다. 한 번 쓰고 나면(onFocusHandled) 다시 null로 비운다.
  const [bagFocus, setBagFocus] = useState<{ packId?: string; itemId?: string } | null>(null);
  const [packFocusItemId, setPackFocusItemId] = useState<string | null>(null);
  // 설정은 더 이상 하단 탭이 아니라, 팩/가방 화면 헤더 톱니바퀴로 열고 뒤로가기로
  // 닫는 풀스크린 화면이다(editingBag/editingPack과 동일한 "위로 쌓이는" 패턴).
  const [showSettings, setShowSettings] = useState(false);
  // 하단 중앙 "+" 버튼(빠른입력) 모달 표시 여부.
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [splashMinTimeDone, setSplashMinTimeDone] = useState(false);
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(false);
  const announcementPopupShownRef = useRef(false);
  const swipeStartRef = useRef<{ x: number; y: number; ignore: boolean } | null>(null);
  const [premiumLimitMessage, setPremiumLimitMessage] = useState<string | null>(null);
  const [showPremiumSyncOverlay, setShowPremiumSyncOverlay] = useState(false);
  // 새 가방을 Firestore에 쓰는 동안(openNewBag/openNewBagFromNote) true. CreatingBagOverlay를
  // 띄우는 용도로만 쓰이고, 실제 가방 생성 로직에는 영향을 주지 않는다.
  const [creatingBag, setCreatingBag] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashMinTimeDone(true), 900);
    return () => clearTimeout(t);
  }, []);


  // 계정에 저장된 "시작 화면" 설정이 있으면 최초 1회만 반영한다 (이후엔 사용자가 직접 탭 전환).
  // Firestore(외부 시스템)에서 온 값을 반영하는 의도된 동기화라 set-state-in-effect 규칙은 비활성화한다.
  useEffect(() => {
    if (!profile || appliedDefaultTabRef.current) return;
    if (!profile.defaultTab) return;
    appliedDefaultTabRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(profile.defaultTab);
  }, [profile]);

  const showSplash = loading || !splashMinTimeDone;

  useEffect(() => {
    if (!user) return;
    return subscribeToUserBags(user.uid, setBags);
  }, [user]);

  // 내 닉네임/아바타를 바꾼 뒤(혹은 예전에 참여해두고 한 번도 갱신 안 된 채로 남아있는
  // 경우까지) 각 가방에 찍힌 memberProfiles 스냅샷이 최신 프로필과 다르면 그 가방만
  // 가볍게 고쳐쓴다. 이미 실시간 구독 중인 bags 목록을 그대로 비교에 쓰기 때문에 별도
  // 쿼리 없이 동작하고, 실제로 값이 어긋난 가방에만 쓰기가 일어난다.
  useEffect(() => {
    if (!user || !profile?.nickname || !profile.avatarId) return;
    bags.forEach((bag) => {
      const snap = bag.memberProfiles?.[user.uid];
      if (!snap) return;
      if (snap.nickname === profile.nickname && snap.avatarId === profile.avatarId) return;
      updateMemberProfileSnapshot(bag.id, user.uid, {
        nickname: profile.nickname!,
        avatarId: profile.avatarId!,
      }).catch(() => {});
    });
  }, [bags, user, profile]);

  useEffect(() => {
    if (!user) return;
    return subscribeToLibraryPacks(user.uid, setLibraryPacks);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToAnnouncements(setAnnouncements);
  }, [user]);

  // 설정 > 휴지통 보관기간(TRASH_RETENTION_DAYS, 30일)이 지난 가방/팩을 조용히 정리한다.
  // 별도 서버 배치/크론 없이, 그 항목의 삭제 권한을 가진 계정(가방은 소유자, 팩은 본인)의
  // 클라이언트가 다음에 로그인해서 열릴 때 한 번 검사해서 지운다 - 그래서 30일이 지난
  // 정확한 그 순간이 아니라 "그 이후 다음 접속 시점"에 지워진다(대부분의 개인용 앱에서는
  // 이 정도 지연이 실사용에 문제되지 않는다).
  useEffect(() => {
    if (!user) return;
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
  }, [bags, libraryPacks, user]);

  // 지금 이 사용자가 프리미엄인지 - AuthProvider가 unlockCodes/{code} 문서까지 실시간
  // 구독해서 profile에 얹어주므로(unlockCodeLiveStatus), 관리자가 무효화하는 순간
  // 이 값도 바로 바뀐다.
  const premium = user && profile ? isPremiumUser(user.email, profile) : false;

  // 이용권 상태(premium)가 true<->false로 바뀌는 순간을 감지한다.
  // - 첫 렌더에서는 기준값만 저장하고 아무 동작도 하지 않는다(로그인 직후 로딩 중 잠깐
  //   false로 보이다가 true로 바뀌는 정상적인 초기 로딩까지 "다운그레이드"로 오인하면 안 됨).
  // - 그 이후로 값이 실제로 바뀌면: (1) 서버에 잠금 상태 재계산을 요청하고
  //   (app/api/sync-lock-status - 무료<->프리미엄 양방향 모두), (2) 무료로 떨어진 경우에만
  //   짧은 오버레이 + 안내 토스트로 "뭔가 바뀌었다"는 걸 직관적으로 알린다.
  const premiumRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!user) {
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
      .then((idToken) =>
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

  // 무료 전환으로 잠긴(내가 소유한) 가방/팩 id 집합. 프리미엄이면 항상 빈 집합.
  // (computeLockedBagIds/computeLockedPackIds 내부에서 휴지통으로 보낸 항목은 이미 제외된다.)
  const lockedBagIds = user && !premium ? computeLockedBagIds(bags, user.uid) : new Set<string>();
  // v68: 팩 개수 제한이 폐지되어 팩/폴더는 더 이상 잠기지 않는다.
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

  const dismissedIds = profile?.dismissedAnnouncementIds ?? [];
  const activeUndismissed = announcements
    .filter((a) => isAnnouncementActive(a))
    .filter((a) => !dismissedIds.includes(a.id));

  // 앱 진입 시(로그인 이후) 아직 안 본 공지사항이 있으면 한 번 자동으로 띄운다.
  // Firestore(외부 시스템)에서 온 값을 반영하는 의도된 동기화라 set-state-in-effect 규칙은 비활성화한다.
  useEffect(() => {
    if (announcementPopupShownRef.current) return;
    if (!profile) return;
    if (activeUndismissed.length === 0) return;
    announcementPopupShownRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowAnnouncementPopup(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, announcements]);

  const handleDismissAnnouncement = (id: string) => {
    if (!user) return;
    dismissAnnouncementRemote(user.uid, id).catch((err) => {
      console.error("[팩인백] 공지사항 다시 보지 않기 실패:", err);
    });
  };

  if (loading) {
    return <SplashScreen visible={showSplash} />;
  }

  // 회원가입/이메일재발송처럼 잠깐 로그인했다가 눈 깜짝할 사이 signOut하는 흐름 동안은,
  // user가 잠시 생기더라도 홈 화면으로 넘어가면 안 된다(넘어갔다가 곧바로 되돌아오는
  // 부자연스러운 깜빡임이 생기기 때문). 계속 로그인 화면을 보여준다.
  if (!user || authBusy)
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
          items: [{ id: uid(), type: "check", text: "", checked: false }],
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
      images: [],
      packs:
        result.packs.length > 0
          ? result.packs.map((p) => ({
              id: uid(),
              name: p.name,
              items: p.items.map((raw) => {
                const text = typeof raw === "string" ? raw : raw.text;
                const type = typeof raw === "string" ? "check" : raw.type ?? "check";
                return {
                  id: uid(),
                  type,
                  text,
                  checked: false,
                };
              }),
            }))
          : [
              {
                id: uid(),
                name: "새 팩",
                items: [{ id: uid(), type: "check", text: "", checked: false }],
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
      show("가방을 채웠어요. 자동으로 저장되니 확인만 해주세요");
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
    trashBagRemote(bag.id)
      .then(() => show("가방을 휴지통으로 보냈어요"))
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
    const targets = bags.filter((b) => bagIds.includes(b.id));
    const owned = targets.filter((b) => b.ownerId === user.uid);
    const shared = targets.filter((b) => b.ownerId !== user.uid);
    try {
      await Promise.all([
        ...owned.map((bag) => trashBagRemote(bag.id)),
        ...shared.map((bag) => leaveBagRemote(user.uid, bag.id)),
      ]);
      const parts: string[] = [];
      if (owned.length > 0) parts.push(`${owned.length}개 휴지통 이동`);
      if (shared.length > 0) parts.push(`${shared.length}개 나가기`);
      show(`${parts.join(" · ")}했어요`);
    } catch (err) {
      console.error("[팩인백] 가방 일괄 처리 실패:", err);
      show(`처리 중 일부가 실패했어요 (${firebaseErrorCode(err)})`);
    }
  };

  // 설정 > 휴지통에서 가방 복구. 무료 동시 진행 개수 제한을 서버가 다시 검증하므로
  // (app/api/restore-bag) 한도에 걸리면 PremiumLimitError로 던져지고, 그 경우 일반 실패
  // 토스트 대신 이용권 등록을 유도하는 PremiumLimitModal을 띄운다.
  const handleRestoreBag = async (bagId: string) => {
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

  const handleJoinBag = async (code: string) => {
    try {
      await joinBagByCode(user.uid, code, {
        nickname: profile.nickname!,
        avatarId: profile.avatarId!,
      });
      show("가방에 참여했어요");
    } catch (err) {
      console.error("[팩인백] 가방 참여 실패:", err);
      throw err;
    }
  };

  const handleSaveAsLibraryPack = (pack: Pack) => {
    saveLibraryPackRemote(user, pack).catch((err) => {
      if (err instanceof PremiumLimitError) {
        setPremiumLimitMessage(err.message);
        return;
      }
      console.error("[팩인백] 팩 저장 실패:", err);
      show(`팩 저장에 실패했어요 (${firebaseErrorCode(err)})`);
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

  const openNewPack = (parentId?: string) => {
    setEditingPack({ id: uid(), name: "새 팩", items: [], parentId });
  };

  // v68: 폴더는 팩 편집 화면(items가 없음)을 열 필요 없이 바로 생성된다. 생성 직후에는
  // 팩 트리 화면에서 이름을 편집 상태로 보여줘서 곧바로 이름을 바꿀(EditableText) 수 있게 해준다.
  const handleCreateFolder = (parentId?: string) => {
    const draft: Pack = {
      id: uid(),
      name: "새 폴더",
      items: [],
      type: "folder",
      parentId,
    };
    saveLibraryPackRemote(user, draft).catch((err) => {
      console.error("[팩인백] 폴더 생성 실패:", err);
      show(`폴더 생성에 실패했어요 (${firebaseErrorCode(err)})`);
    });
  };

  // 폴더/팩 이름 바꾸기(트리 행의 이름 탭 편집). 폴더는 편집 화면이 없어서
  // 이 경로로만 이름을 바꿀 수 있다(팩은 편집 화면 안 EditableText로도 바꿀 수 있지만
  // 트리에서 직접 바꿀 때는 이 경로를 쓴다).
  const handleRenameLibraryEntry = (pack: Pack, name: string) => {
    saveLibraryPackRemote(user, { ...pack, name }).catch((err) => {
      console.error("[팩인백] 이름 바꿀 실패:", err);
      show(`이름 바꿀에 실패했어요 (${firebaseErrorCode(err)})`);
    });
  };

  // 팩/폴더를 다른 폴더로(또는 최상위로) 이동한다. 트리 및 다중선택에서 "이동" 액션으로 호출된다.
  const handleMoveLibraryEntries = (packIds: string[], parentId: string | undefined) => {
    const idSet = new Set(packIds);
    Promise.all(
      activePacks
        .filter((p) => idSet.has(p.id))
        .map((p) => saveLibraryPackRemote(user, { ...p, parentId }))
    ).catch((err) => {
      console.error("[팩인백] 폴더 이동 실패:", err);
      show(`이동에 실패했어요 (${firebaseErrorCode(err)})`);
    });
  };

  const handleSavePack = (pack: Pack) => {
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
  // 삭제)와는 다른 함수다 - 이건 라이브러리 화면(PackLibraryEditorScreen)의 "삭제" 버튼용.
  // 이 팩은 늘 하위 항목이 없으니(폴더가 아니므로) 단일 항목으로 충분.
  const handleDeletePack = (packId: string) => {
    setEditingPack(null);
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
    saveLibraryPackRemote(user, draft).catch((err) => {
      console.error("[팩인백] 빠른입력 저장 실패:", err);
      show(`빠른입력 저장에 실패했어요 (${firebaseErrorCode(err)})`);
    });
  };

  if (editingBag) {
    const isEditingBagLocked = lockedBagIds.has(editingBag.id);
    return (
      <>
        <div className="flex flex-col h-dvh mx-auto w-full max-w-3xl md:max-w-4xl bg-background">
          <BagEditorScreen
            initialBag={editingBag}
            libraryPacks={realPacksOnly}
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
            onLeaveBag={handleLeaveBag}
            onRemoveMember={handleRemoveMember}
            onRegenerateInviteCode={handleRegenerateInviteCode}
            focusTarget={bagFocus}
            onFocusHandled={() => setBagFocus(null)}
          />
        </div>
        <SplashScreen visible={showSplash} />
        <PremiumSyncOverlay visible={showPremiumSyncOverlay} />
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
      </>
    );
  }

  if (showSettings) {
    return (
      <>
        <div className="flex flex-col h-dvh mx-auto w-full max-w-3xl md:max-w-4xl bg-background">
          <SettingsScreen
            uid={user.uid}
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
            onBack={() => setShowSettings(false)}
          />
        </div>
        <SplashScreen visible={showSplash} />
        <PremiumSyncOverlay visible={showPremiumSyncOverlay} />
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
      </>
    );
  }

  const tabOrder: TabKey[] = ["packs", "home"];
  const tabIndex = tabOrder.indexOf(tab);

  // 빈 배경(카드/버튼/입력이 아닌 곳)을 좌우로 스와이프하면 탭이 전환된다.
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    const ignore = !!target.closest(
      'button, a, input, textarea, [role="button"], [data-pack-drop-id], [data-bag-drop-id], [data-pack-tile-drop-id], .fixed'
    );
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY, ignore };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.ignore) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const currentIndex = tabOrder.indexOf(tab);
    if (dx < 0 && currentIndex < tabOrder.length - 1) {
      setTab(tabOrder[currentIndex + 1]);
    } else if (dx > 0 && currentIndex > 0) {
      setTab(tabOrder[currentIndex - 1]);
    }
  };

  return (
    <>
      <div className="flex flex-col h-dvh mx-auto w-full max-w-3xl md:max-w-4xl bg-background">
        <EmailVerifyBanner />
        <div
          className="flex-1 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex h-full"
            style={{
              width: "200%",
              transform: `translateX(-${tabIndex * (100 / 2)}%)`,
              transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 / 2}%` }}>
              <PacksScreen
                uid={user.uid}
                packs={activePacks}
                quickPack={quickPack}
                onOpenPack={(pack, focusItemId) => {
                  setEditingPack(pack);
                  setPackFocusItemId(focusItemId ?? null);
                }}
                onNewPack={openNewPack}
                onNewFolder={handleCreateFolder}
                onRenameEntry={handleRenameLibraryEntry}
                onMoveEntries={handleMoveLibraryEntries}
                onOpenSettings={() => setShowSettings(true)}
                onBulkDeletePacks={handleBulkDeletePacks}
              />
            </div>
            <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 / 2}%` }}>
              <HomeScreen
                uid={user.uid}
                bags={activeBags}
                initialInviteCode={inviteCodeFromUrl()}
                lockedBagIds={lockedBagIds}
                quickPack={quickPack}
                currentUid={user.uid}
                onOpenBag={(bag, focus) => {
                  setIsNewBag(false);
                  setEditingBag(bag);
                  setBagFocus(focus ?? null);
                }}
                onNewBag={openNewBag}
                onImportNote={openNewBagFromNote}
                onJoinBag={handleJoinBag}
                onOpenSettings={() => setShowSettings(true)}
                onOpenQuickPack={() => quickPack && setEditingPack(quickPack)}
                onBulkDeleteBags={handleBulkDeleteBags}
              />
            </div>
          </div>
        </div>
        <BottomTabBar active={tab} onChange={setTab} onQuickAdd={() => setShowQuickAdd(true)} />
        <InstallPrompt />
      </div>
      {showQuickAdd && (
        <QuickAddModal
          onClose={() => setShowQuickAdd(false)}
          onAdd={handleQuickAddItem}
        />
      )}
      {editingPack && (() => {
        const closePackEditor = () => {
          setEditingPack(null);
          setPackFocusItemId(null);
        };
        return (
          <Portal>
            <div
              className="fixed inset-0 z-[75] flex items-end justify-center"
              style={{ background: "rgba(0,0,0,0.45)" }}
              onClick={closePackEditor}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-3xl md:max-w-4xl rounded-t-2xl bg-background flex flex-col overflow-hidden"
                style={{ maxHeight: "85vh" }}
              >
                <PackLibraryEditorScreen
                  variant="sheet"
                  initialPack={editingPack}
                  libraryPacks={realPacksOnly}
                  bags={activeBags}
                  lockedBagIds={lockedBagIds}
                  readOnly={false}
                  onRequestUnlock={requestUnlockForPack}
                  onBack={closePackEditor}
                  onSave={handleSavePack}
                  onSaveOtherPack={handleSavePack}
                  onDelete={handleDeletePack}
                  onAddItemsToBagPack={handleAddItemsToBagPack}
                  onRemoveItemsFromBagPack={handleRemoveItemsFromBagPack}
                  focusItemId={packFocusItemId}
                  onFocusHandled={() => setPackFocusItemId(null)}
                />
              </div>
            </div>
          </Portal>
        );
      })()}
      {showAnnouncementPopup && activeUndismissed.length > 0 && (
        <AnnouncementPopupStack
          announcements={activeUndismissed}
          onDismiss={handleDismissAnnouncement}
          onClose={() => setShowAnnouncementPopup(false)}
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
    </>
  );
}
