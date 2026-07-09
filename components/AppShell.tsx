"use client";

import { useEffect, useRef, useState } from "react";
import { Bag, Pack, Announcement } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import {
  subscribeToUserBags,
  createBagRemote,
  saveBagRemote,
  deleteBagWithInviteCodeRemote,
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
import { useToast } from "@/components/Toast";
import { firebaseErrorCode } from "@/lib/errorMessage";
import { isPremiumUser, FREE_MAX_LIBRARY_PACKS, FREE_MAX_ACTIVE_BAGS, PremiumLimitError } from "@/lib/premiumLimits";
import PremiumLimitModal from "@/components/PremiumLimitModal";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function inviteCodeFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("invite")?.toUpperCase() ?? "";
}

export default function AppShell() {
  const { user, profile, loading } = useAuth();
  const { show } = useToast();

  const [bags, setBags] = useState<Bag[]>([]);
  const [libraryPacks, setLibraryPacks] = useState<Pack[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [tab, setTab] = useState<TabKey>("home");
  const appliedDefaultTabRef = useRef(false);
  const [editingBag, setEditingBag] = useState<Bag | null>(null);
  const [isNewBag, setIsNewBag] = useState(false);
  const [editingPack, setEditingPack] = useState<Pack | null>(null);
  const [splashMinTimeDone, setSplashMinTimeDone] = useState(false);
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(false);
  const announcementPopupShownRef = useRef(false);
  const swipeStartRef = useRef<{ x: number; y: number; ignore: boolean } | null>(null);
  const [premiumLimitMessage, setPremiumLimitMessage] = useState<string | null>(null);

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

  const openNewBag = async () => {
    if (bags.length >= FREE_MAX_ACTIVE_BAGS && !isPremiumUser(user.email, profile)) {
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
    }
  };

  // 메모 AI 가져오기뿐 아니라 샘플 템플릿 선택, 해시태그 AI 생성 결과도 모두
  // 동일한 형태(ImportedBagResult)라서 이 함수를 함께 쓴다.
  const openNewBagFromNote = async (result: NoteImportResult) => {
    if (bags.length >= FREE_MAX_ACTIVE_BAGS && !isPremiumUser(user.email, profile)) {
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
    try {
      const created = await createBagRemote(user, draft, {
        nickname: profile.nickname!,
        avatarId: profile.avatarId!,
      });
      setEditingBag(created);
      show("가방을 채웠어요. 확인 후 저장해주세요");
    } catch (err) {
      setIsNewBag(false);
      if (err instanceof PremiumLimitError) {
        setPremiumLimitMessage(err.message);
        return;
      }
      console.error("[팩인백] 가방 생성 실패:", err);
      show(`가방 생성에 실패했어요 (${firebaseErrorCode(err)})`);
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

  // 완전 삭제(휴지통 버튼): 이미지까지 함께 정리하고 초대코드 매핑도 지운다.
  const handleDeleteBag = (bag: Bag) => {
    setEditingBag(null);
    setIsNewBag(false);
    (async () => {
      try {
        await Promise.all(bag.images.map((url) => deleteBagImage(url)));
        await deleteBagWithInviteCodeRemote(bag);
        show("가방을 삭제했어요");
      } catch (err) {
        console.error("[팩인백] 가방 삭제 실패:", err);
        show(`가방 삭제에 실패했어요 (${firebaseErrorCode(err)})`);
      }
    })();
  };

  // 새로 만들다가(아직 한 번도 저장 안 하고) 뒤로가기 하면, 미리 만들어둔 임시 가방을 조용히 정리한다.
  const handleBackFromEditor = (currentBag: Bag) => {
    const wasNew = isNewBag;
    setEditingBag(null);
    setIsNewBag(false);
    if (wasNew) {
      Promise.all(currentBag.images.map((url) => deleteBagImage(url)))
        .then(() => deleteBagWithInviteCodeRemote(currentBag))
        .catch((err) => {
          console.error("[팩인백] 임시 가방 정리 실패:", err);
        });
    }
  };

  const handleLeaveBag = (bagId: string) => {
    leaveBagRemote(user.uid, bagId).catch((err) => {
      console.error("[팩인백] 가방 나가기 실패:", err);
      show(`가방 나가기에 실패했어요 (${firebaseErrorCode(err)})`);
    });
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
      return await regenerateInviteCodeRemote(bag);
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
    const isNewLibraryPack = !libraryPacks.some((p) => p.id === pack.id);
    if (
      isNewLibraryPack &&
      libraryPacks.length >= FREE_MAX_LIBRARY_PACKS &&
      !isPremiumUser(user.email, profile)
    ) {
      setPremiumLimitMessage(
        `무료로는 팩 라이브러리에 ${FREE_MAX_LIBRARY_PACKS}개까지만 저장할 수 있어요. 더 저장하려면 이용권 코드를 등록해주세요.`
      );
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

  const openNewPack = () => {
    if (
      libraryPacks.length >= FREE_MAX_LIBRARY_PACKS &&
      !isPremiumUser(user.email, profile)
    ) {
      setPremiumLimitMessage(
        `무료로는 팩 라이브러리에 ${FREE_MAX_LIBRARY_PACKS}개까지만 저장할 수 있어요. 더 저장하려면 이용권 코드를 등록해주세요.`
      );
      return;
    }
    setEditingPack({ id: uid(), name: "새 팩", items: [] });
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

  const handleDeletePack = (packId: string) => {
    setEditingPack(null);
    deleteLibraryPackRemote(user.uid, packId)
      .then(() => show("팩을 삭제했어요"))
      .catch((err) => {
        console.error("[팩인백] 팩 삭제 실패:", err);
        show(`팩 삭제에 실패했어요 (${firebaseErrorCode(err)})`);
      });
  };

  if (editingBag) {
    return (
      <>
        <div className="flex flex-col h-dvh mx-auto w-full max-w-3xl md:max-w-4xl bg-background">
          <BagEditorScreen
            initialBag={editingBag}
            libraryPacks={libraryPacks}
            uid={user.uid}
            nickname={profile.nickname}
            avatarId={profile.avatarId}
            isNew={isNewBag}
            onBack={handleBackFromEditor}
            onSave={handleSaveBag}
            onDeleteBag={handleDeleteBag}
            onSaveAsLibraryPack={handleSaveAsLibraryPack}
            onLeaveBag={handleLeaveBag}
            onRemoveMember={handleRemoveMember}
            onRegenerateInviteCode={handleRegenerateInviteCode}
          />
        </div>
        <SplashScreen visible={showSplash} />
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

  if (editingPack) {
    return (
      <>
        <div className="flex flex-col h-dvh mx-auto w-full max-w-3xl md:max-w-4xl bg-background">
          <PackLibraryEditorScreen
            initialPack={editingPack}
            onBack={() => setEditingPack(null)}
            onSave={handleSavePack}
            onDelete={handleDeletePack}
          />
        </div>
        <SplashScreen visible={showSplash} />
      </>
    );
  }

  const tabOrder: TabKey[] = ["packs", "home", "settings"];
  const tabIndex = tabOrder.indexOf(tab);

  // 빈 배경(카드/버튼/입력이 아닌 곳)을 좌우로 스와이프하면 탭이 전환된다.
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    const ignore = !!target.closest(
      "button, a, input, textarea, [data-pack-drop-id], .fixed"
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
              width: "300%",
              transform: `translateX(-${tabIndex * (100 / 3)}%)`,
              transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 / 3}%` }}>
              <PacksScreen
                packs={libraryPacks}
                onOpenPack={(pack) => setEditingPack(pack)}
                onNewPack={openNewPack}
              />
            </div>
            <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 / 3}%` }}>
              <HomeScreen
                bags={bags}
                initialInviteCode={inviteCodeFromUrl()}
                onOpenBag={(bag) => {
                  setIsNewBag(false);
                  setEditingBag(bag);
                }}
                onNewBag={openNewBag}
                onImportNote={openNewBagFromNote}
                onJoinBag={handleJoinBag}
              />
            </div>
            <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 / 3}%` }}>
              <SettingsScreen
                uid={user.uid}
                announcements={announcements}
                dismissedAnnouncementIds={dismissedIds}
                onDismissAnnouncement={handleDismissAnnouncement}
                onCreateAnnouncement={handleCreateAnnouncement}
                onUpdateAnnouncement={handleUpdateAnnouncement}
                onDeleteAnnouncement={handleDeleteAnnouncement}
              />
            </div>
          </div>
        </div>
        <BottomTabBar active={tab} onChange={setTab} />
        <InstallPrompt />
      </div>
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
    </>
  );
}
