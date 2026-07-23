"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  User,
} from "firebase/auth";
import { isNativePlatform, nativeAppleIdToken, nativeGoogleIdToken } from "@/lib/nativeAuth";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserProfile } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";
import { togglePinned } from "@/lib/listSort";
import { deleteAllUserData } from "@/lib/accountService";
import { seedSampleDataForNewUser } from "@/lib/sampleOnboardingData";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  // 회원가입 처리 중(계정 생성 -> 샘플데이터/인증메일 -> 로그아웃) true. 이 사이에는
  // Firebase가 잠깐 로그인 상태가 되지만, 화면은 절대 홈으로 넘어가면 안 된다
  // (넘어갔다가 마지막에 signOut하면서 다시 로그인 화면으로 튕기는 부자연스러운
  // 깜빡임이 생기기 때문 - AppShell에서 이 값을 user와 함께 확인해서 막는다).
  authBusy: boolean;
  signUpWithEmail: (
    email: string,
    password: string,
    nickname: string,
    avatarId: string
  ) => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  completeProfile: (nickname: string, avatarId: string) => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  updateAvatar: (avatarId: string) => Promise<void>;
  updateThemePrefs: (prefs: {
    themeMode?: string;
    accentId?: string;
    customAccentHex?: string;
    bagColorId?: string;
    customBagColorHex?: string;
    packGridColorId?: string;
    customPackGridColorHex?: string;
    packLibraryColorId?: string;
    customPackLibraryColorHex?: string;
    bagColorOpacity?: number;
    packGridColorOpacity?: number;
    packLibraryColorOpacity?: number;
    baseOpacity?: number;
    bagCardScale?: number;
    packCardScale?: number;
    packLibraryCardScale?: number;
    packCardFontScale?: number;
  }) => Promise<void>;
  updateFontScale: (fontScale: "sm" | "md" | "lg") => Promise<void>;
  updateDefaultTab: (defaultTab: "home" | "settings" | "packs") => Promise<void>;
  updateBagSortBy: (sortBy: UserProfile["bagSortBy"]) => Promise<void>;
  updateBagCardSize: (size: UserProfile["bagCardSize"]) => Promise<void>;
  updatePackSortBy: (sortBy: UserProfile["packSortBy"]) => Promise<void>;
  toggleBagPinned: (bagId: string) => Promise<void>;
  toggleBagArchived: (bagId: string) => Promise<void>;
  archiveBags: (bagIds: string[]) => Promise<void>;
  dismissArchiveSuggestions: (bagIds: string[]) => Promise<void>;
  togglePackPinned: (packId: string) => Promise<void>;
  updateBagOrder: (order: string[]) => Promise<void>;
  updatePackOrder: (order: string[]) => Promise<void>;
  updatePackOrderByParent: (parentKey: string, order: string[]) => Promise<void>;
  updateExpandedPackFolderIds: (ids: string[]) => Promise<void>;
  createBagFolder: (name: string, parentId?: string) => Promise<string>;
  renameBagFolder: (folderId: string, name: string) => Promise<void>;
  deleteBagFolder: (folderId: string) => Promise<void>;
  moveBagFolder: (folderId: string, parentId: string | undefined) => Promise<void>;
  moveBagToFolder: (bagId: string, folderId: string | undefined) => Promise<void>;
  moveBagsToFolder: (bagIds: string[], folderId: string | undefined) => Promise<void>;
  updateBagOrderByParent: (parentKey: string, order: string[]) => Promise<void>;
  updateExpandedBagFolderIds: (ids: string[]) => Promise<void>;
  updatePackSettings: (settings: Partial<NonNullable<UserProfile["packSettings"]>>) => Promise<void>;
  updateQuickPackCollapsed: (collapsed: boolean) => Promise<void>;
  updatePackDisplayState: (
    bagId: string,
    packId: string,
    state: "normal" | "wide" | "collapsed"
  ) => Promise<void>;
  updateAllPackDisplayStates: (
    bagId: string,
    packIds: string[],
    state: "normal" | "wide" | "collapsed"
  ) => Promise<void>;
  updateBagViewMode: (bagId: string, mode: "pack" | "notebook") => Promise<void>;
  updateDefaultBagViewMode: (mode: "pack" | "notebook") => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  resendVerificationByCredential: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function ensureUserDoc(user: User) {
  const ref = doc(db, "users", user.uid);
  await setDoc(
    ref,
    {
      email: user.email,
      displayName: user.displayName,
      createdAt: serverTimestamp(),
      // nickname/avatarId는 merge라서 이미 있으면 덮어쓰지 않음 -> 처음 가입한 사람만 비어있음
    },
    { merge: true }
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // users/{uid} 문서에서 그대로 읽어온 값. 이용권이 실제로 지금 유효한지(무효화/만료
  // 여부)는 여기 없다 - 아래 unlockLiveStatus가 따로 담당한다 (그 이유는 바로 아래 주석 참고).
  const [rawProfile, setRawProfile] = useState<UserProfile | null>(null);
  // unlockCodes/{code} 문서를 실시간 구독해서 얻는 값. 마스터가 "무효화" 버튼을 누르면
  // unlockCodes/{code}.status만 바뀌고 users/{uid} 문서는 안 건드리기 때문에, users/{uid}
  // 구독만으로는 무효화를 실시간으로 알 수 없다 - 그래서 이 문서도 별도로 구독해야 한다.
  const [unlockLiveStatus, setUnlockLiveStatus] = useState<
    "active" | "invalidated" | "expired" | null
  >(null);
  const [loading, setLoading] = useState(true);
  // signUpWithEmail/resendVerificationByCredential처럼 잠깐 로그인했다가 곧바로
  // signOut하는 흐름 동안 true. AppShell이 이 값을 user와 함께 확인해서 그 사이엔
  // 절대 홈 화면으로 넘어가지 않게 막는다.
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setRawProfile(null);
        setLoading(false);
      } else {
        // 재로그인 시 이전 세션의 profile(null)이 잠깐 남아있는 상태에서
        // "닉네임 정하기" 화면이 한 프레임 스치듯 보이는 걸 막기 위해
        // 새 프로필 문서를 읽어올 때까지 다시 로딩 상태로 되돌린다.
        setLoading(true);
      }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsubDoc = onSnapshot(ref, (snap) => {
      const data = snap.data();
      setRawProfile({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        nickname: (data?.nickname as string | undefined) ?? null,
        avatarId: (data?.avatarId as string | undefined) ?? null,
        themeMode: data?.themeMode as UserProfile["themeMode"],
        accentId: data?.accentId as string | undefined,
        customAccentHex: data?.customAccentHex as string | undefined,
        bagColorId: data?.bagColorId as string | undefined,
        customBagColorHex: data?.customBagColorHex as string | undefined,
        packGridColorId: data?.packGridColorId as string | undefined,
        customPackGridColorHex: data?.customPackGridColorHex as string | undefined,
        packLibraryColorId: data?.packLibraryColorId as string | undefined,
        customPackLibraryColorHex: data?.customPackLibraryColorHex as string | undefined,
        bagColorOpacity: data?.bagColorOpacity as number | undefined,
        packGridColorOpacity: data?.packGridColorOpacity as number | undefined,
        packLibraryColorOpacity: data?.packLibraryColorOpacity as number | undefined,
        baseOpacity: data?.baseOpacity as number | undefined,
        bagCardScale: data?.bagCardScale as number | undefined,
        packCardScale: data?.packCardScale as number | undefined,
        packLibraryCardScale: data?.packLibraryCardScale as number | undefined,
        packCardFontScale: data?.packCardFontScale as number | undefined,
        fontScale: data?.fontScale as UserProfile["fontScale"],
        defaultTab: data?.defaultTab as UserProfile["defaultTab"],
        dismissedAnnouncementIds: data?.dismissedAnnouncementIds as string[] | undefined,
        bagSortBy: data?.bagSortBy as UserProfile["bagSortBy"],
        bagCardSize: data?.bagCardSize as UserProfile["bagCardSize"],
        packSortBy: data?.packSortBy as UserProfile["packSortBy"],
        pinnedBagIds: data?.pinnedBagIds as string[] | undefined,
        pinnedPackIds: data?.pinnedPackIds as string[] | undefined,
        archivedBagIds: data?.archivedBagIds as string[] | undefined,
        archiveSuggestionDismissedIds: data?.archiveSuggestionDismissedIds as string[] | undefined,
        bagOrder: data?.bagOrder as string[] | undefined,
        packOrder: data?.packOrder as string[] | undefined,
        packOrderByParent: data?.packOrderByParent as UserProfile["packOrderByParent"],
        expandedPackFolderIds: data?.expandedPackFolderIds as string[] | undefined,
        bagFolders: data?.bagFolders as UserProfile["bagFolders"],
        bagFolderAssignments: data?.bagFolderAssignments as UserProfile["bagFolderAssignments"],
        bagOrderByParent: data?.bagOrderByParent as UserProfile["bagOrderByParent"],
        expandedBagFolderIds: data?.expandedBagFolderIds as string[] | undefined,
        packSettings: data?.packSettings as UserProfile["packSettings"],
        quickPackCollapsed: data?.quickPackCollapsed as boolean | undefined,
        packDisplayStates: data?.packDisplayStates as UserProfile["packDisplayStates"],
        bagViewMode: data?.bagViewMode as UserProfile["bagViewMode"],
        defaultBagViewMode: data?.defaultBagViewMode as UserProfile["defaultBagViewMode"],
        aiUsage: data?.aiUsage as UserProfile["aiUsage"],
        unlockCode: data?.unlockCode as string | undefined,
        unlockCodeExpiresAt: data?.unlockCodeExpiresAt as string | null | undefined,
      });
      setLoading(false);
    });
    return unsubDoc;
  }, [user]);

  // unlockCodes/{code} 문서를 실시간 구독해서, 관리자가 "무효화" 버튼을 누르는 순간
  // (또는 만료 시각이 지나는 순간) 화면에 바로 반영되게 한다. 코드가 없으면 구독하지 않고
  // 상태를 null로 비운다(마스터 계정처럼 코드 자체가 필요 없는 경우 등).
  // Firestore 문서 자체는 안 바뀌고 시간만 흘러서 만료 시각을 넘기는 경우, onSnapshot은
  // 재실행되지 않는다. 그래서 만료 시각이 되는 정확한 순간에 한 번만 재평가하도록
  // setTimeout을 걸어둔다 - 폴링이 아니라 1회성 타이머라 네트워크 요청/Firestore 읽기가
  // 전혀 없고, 부하도 setTimeout 하나 도는 정도로 무시할 수준이다.
  // 주의: setTimeout은 대략 24.8일(2^31ms)을 넘기는 지연시간을 주면 즉시 실행돼버리는
  // 오버플로 버그가 있다(1년짜리 이용권 코드도 있어서 실제로 걸릴 수 있는 문제). 그래서
  // 20일 단위로 잘라서, 만료 시각에 도달할 때까지 재귀적으로 다시 건다.
  useEffect(() => {
    const code = rawProfile?.unlockCode;
    if (!code) {
      setUnlockLiveStatus(null);
      return;
    }
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    const clearExpiryTimer = () => {
      if (expiryTimer) {
        clearTimeout(expiryTimer);
        expiryTimer = null;
      }
    };
    const scheduleExpiryCheck = (expiresAtMs: number) => {
      clearExpiryTimer();
      const MAX_TIMEOUT_MS = 20 * 24 * 60 * 60 * 1000; // 20일 (setTimeout 32비트 한계 방지)
      const tick = () => {
        const remaining = expiresAtMs - Date.now();
        if (remaining <= 0) {
          setUnlockLiveStatus("expired");
          return;
        }
        expiryTimer = setTimeout(tick, Math.min(remaining, MAX_TIMEOUT_MS));
      };
      tick();
    };
    const unsub = onSnapshot(
      doc(db, "unlockCodes", code),
      (snap) => {
        clearExpiryTimer();
        if (!snap.exists()) {
          setUnlockLiveStatus("invalidated");
          return;
        }
        const data = snap.data();
        if (data.status === "invalidated") {
          setUnlockLiveStatus("invalidated");
          return;
        }
        const expiresAt = data.expiresAt as { toDate?: () => Date } | null | undefined;
        const expiresAtMs =
          expiresAt && typeof expiresAt.toDate === "function" ? expiresAt.toDate().getTime() : null;
        const expired = expiresAtMs !== null && expiresAtMs < Date.now();
        setUnlockLiveStatus(expired ? "expired" : "active");
        // 아직 만료 전이면, 만료되는 정확한 시각에 한 번 더 재평가하도록 예약해둔다.
        if (!expired && expiresAtMs !== null) {
          scheduleExpiryCheck(expiresAtMs);
        }
      },
      () => {
        // 권한 문제/로그아웃 경합 등으로 구독 자체가 실패하면 상태를 모르는 채로 두고,
        // premiumLimits.ts가 기존처럼 캐시된 unlockCodeExpiresAt 기준으로 판단하게 둔다.
        clearExpiryTimer();
        setUnlockLiveStatus(null);
      }
    );
    return () => {
      clearExpiryTimer();
      unsub();
    };
  }, [rawProfile?.unlockCode]);

  // 화면/로직에 실제로 노출되는 profile. rawProfile(users/{uid} 문서)과 unlockLiveStatus
  // (unlockCodes/{code} 문서)를 합친다 - 둘이 서로 다른 문서를 구독하는 별개의 상태라서,
  // 여기서 하나로 합쳐야 lib/premiumLimits.ts 등 기존 호출부를 안 건드리고 바로 반영된다.
  const profile = useMemo<UserProfile | null>(() => {
    if (!rawProfile) return null;
    return { ...rawProfile, unlockCodeLiveStatus: unlockLiveStatus };
  }, [rawProfile, unlockLiveStatus]);

  const signUpWithEmail = async (
    email: string,
    password: string,
    nickname: string,
    avatarId: string
  ): Promise<boolean> => {
    setAuthBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: nickname });
      await setDoc(doc(db, "users", cred.user.uid), {
        email,
        displayName: nickname,
        nickname,
        avatarId,
        createdAt: serverTimestamp(),
      });
      // 신규 가입자 온보딩 샘플(가방/팩 라이브러리)을 심어준다. 이 과정에서 문제가 생겨도
      // 가입 자체를 막으면 안 되니 실패는 콘솔에만 남기고 넘어간다.
      try {
        await seedSampleDataForNewUser(cred.user, { nickname, avatarId });
      } catch (err) {
        console.error("[팩인백] 샘플 데이터 생성 실패:", err);
      }
      let sent = true;
      try {
        await sendEmailVerification(cred.user);
      } catch (err) {
        // 계정 생성 자체는 성공했으니 가입을 막지는 않되, 원인 파악용으로 콘솔에 남긴다.
        console.error("[팩인백] 인증 메일 발송 실패:", err);
        sent = false;
      }
      // 이메일 인증 전에는 로그인 상태를 유지시키지 않는다. (인증 완료 후 직접 로그인해야 함)
      await signOut(auth);
      return sent;
    } finally {
      setAuthBusy(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    // signUpWithEmail/resendVerificationByCredential과 동일한 이유로 authBusy로 감싸야 한다.
    // signInWithEmailAndPassword가 성공하는 순간 Firebase는 이메일 인증 여부와 무관하게
    // 일단 로그인 상태로 만들어버리고 onAuthStateChanged가 즉시 발동되는데, authBusy
    // 가드가 없으면 우리 코드가 emailVerified를 확인하고 다시 로그아웃시키는 그 짧은 순간
    // 동안 AppShell이 홈 화면을 잠깐 보여줬다가 다시 로그인 화면으로 튕겨나가는
    // 깜빡임이 생긴다(이메일 인증 안 된 계정으로 로그인 시도할 때만 해당).
    setAuthBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!cred.user.emailVerified) {
        await signOut(auth);
        throw new Error("EMAIL_NOT_VERIFIED");
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    if (isNativePlatform()) {
      // WKWebView 안에서는 구글이 signInWithPopup을 정책적으로 막기 때문에,
      // 네이티브 앱에서는 OS 네이티브 로그인 창(플러그인)에서 idToken만 받아와서
      // Firebase에는 그 idToken으로만 로그인한다. (APP_STORE_GUIDE.md 0.5번)
      const idToken = await nativeGoogleIdToken();
      const credential = GoogleAuthProvider.credential(idToken);
      const cred = await signInWithCredential(auth, credential);
      await ensureUserDoc(cred.user);
      return;
    }
    const provider = new GoogleAuthProvider();
    // 이전에 로그인했던 계정으로 자동 로그인되지 않고, 누를때마다 구글 계정 선택
    // 화면을 다시 보여줘서 다른 계정으로 바꿔 로그인할 수 있게 한다.
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    await ensureUserDoc(cred.user);
  };

  // 애플 로그인. 구글 로그인을 제공하면서 애플 로그인을 제공하지 않으면 심사 가이드라인
  // 4.8 위반으로 거절될 수 있어서 추가한다 (APP_STORE_GUIDE.md 9번 참고).
  const signInWithApple = async () => {
    if (isNativePlatform()) {
      const { idToken, rawNonce } = await nativeAppleIdToken();
      const provider = new OAuthProvider("apple.com");
      const credential = provider.credential({ idToken, rawNonce });
      const cred = await signInWithCredential(auth, credential);
      await ensureUserDoc(cred.user);
      return;
    }
    // 웹에서는 Firebase 콘솔 > Authentication > Sign-in method에서 Apple을
    // 공급자로 먼저 추가해둬야 동작한다 (아직 미설정이면 auth/operation-not-allowed 에러).
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    const cred = await signInWithPopup(auth, provider);
    await ensureUserDoc(cred.user);
  };

  // 구글로 가입한 사람이 처음 한 번 닉네임/아바타를 고르면 호출됨
  const completeProfile = async (nickname: string, avatarId: string) => {
    if (!user) return;
    // 닉네임/아바타가 둘 다 비어있던 경우만 "진짜 처음"이다 - 기존 유저가 프로필을
    // 다시 수정하는 경로(설정 화면)는 updateNickname/updateAvatar를 따로 쓰기 때문에
    // 여기로는 안 들어오지만, 혹시 몰라 한 번 더 방어적으로 확인한다.
    const isFirstTime = !profile?.nickname && !profile?.avatarId;
    await setDoc(
      doc(db, "users", user.uid),
      { nickname, avatarId },
      { merge: true }
    );
    if (isFirstTime) {
      try {
        await seedSampleDataForNewUser(user, { nickname, avatarId });
      } catch (err) {
        console.error("[팩인백] 샘플 데이터 생성 실패:", err);
      }
    }
  };

  const updateNickname = async (nickname: string) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { nickname }, { merge: true });
  };

  const updateAvatar = async (avatarId: string) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { avatarId }, { merge: true });
  };

  // 화면 모드/강조 색상을 계정에 저장 (기기 간 동기화용). 로그인 안 했으면 아무것도 안 함.
  const updateThemePrefs = async (prefs: {
    themeMode?: string;
    accentId?: string;
    customAccentHex?: string;
    bagColorId?: string;
    customBagColorHex?: string;
    packGridColorId?: string;
    customPackGridColorHex?: string;
    packLibraryColorId?: string;
    customPackLibraryColorHex?: string;
    bagColorOpacity?: number;
    packGridColorOpacity?: number;
    packLibraryColorOpacity?: number;
    baseOpacity?: number;
    bagCardScale?: number;
    packCardScale?: number;
    packLibraryCardScale?: number;
    packCardFontScale?: number;
  }) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), prefs, { merge: true });
  };

  // 글자 크기 설정 (계정에 저장해서 기기 간 동기화)
  const updateFontScale = async (fontScale: "sm" | "md" | "lg") => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { fontScale }, { merge: true });
  };

  // 앱 실행 시 처음 보여줄 탭
  const updateDefaultTab = async (defaultTab: "home" | "settings" | "packs") => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { defaultTab }, { merge: true });
  };

  const updateBagSortBy = async (sortBy: UserProfile["bagSortBy"]) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { bagSortBy: sortBy }, { merge: true });
  };

  const updateBagCardSize = async (size: UserProfile["bagCardSize"]) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { bagCardSize: size }, { merge: true });
  };

  const updatePackSortBy = async (sortBy: UserProfile["packSortBy"]) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { packSortBy: sortBy }, { merge: true });
  };

  // 고정핀 토글(최대 3개까지). 이미 고정된 걸 다시 누르면 해제되고, 3개가 다 찬 상태에서
  // 새로 고정하려 하면 togglePinned이 조용히 무시한다.
  const toggleBagPinned = async (bagId: string) => {
    if (!user) return;
    const next = togglePinned(profile?.pinnedBagIds, bagId);
    await setDoc(doc(db, "users", user.uid), { pinnedBagIds: next }, { merge: true });
  };

  // 보관 토글 (개수 제한 없음 - togglePinned은 이름과 달리 그냥 "배열에 넣고 빼기" 범용
  // 유틸이라 재사용한다. max에 Infinity를 넘겨 제한을 없앤다).
  const toggleBagArchived = async (bagId: string) => {
    if (!user) return;
    const next = togglePinned(profile?.archivedBagIds, bagId, Infinity);
    await setDoc(doc(db, "users", user.uid), { archivedBagIds: next }, { merge: true });
  };

  // "지난 여행 보관함으로 옮길까요?" 배너에서 여러 개를 한 번에 보관 처리할 때 쓴다.
  // toggleBagArchived를 여러 번 연달아 부르면 각 호출이 같은(갱신되지 않은) profile
  // 스냅샷을 기준으로 next를 계산해서 마지막 호출 것만 반영되는 문제가 있어, 병합을
  // 한 번에 계산해서 한 번만 쓴다.
  const archiveBags = async (bagIds: string[]) => {
    if (!user || bagIds.length === 0) return;
    const current = profile?.archivedBagIds ?? [];
    const next = Array.from(new Set([...current, ...bagIds]));
    await setDoc(doc(db, "users", user.uid), { archivedBagIds: next }, { merge: true });
  };

  // 보관 제안 배너를 "닫기"로 넘긴 가방들은 다음에 다시 물어보지 않는다.
  const dismissArchiveSuggestions = async (bagIds: string[]) => {
    if (!user || bagIds.length === 0) return;
    const current = profile?.archiveSuggestionDismissedIds ?? [];
    const next = Array.from(new Set([...current, ...bagIds]));
    await setDoc(doc(db, "users", user.uid), { archiveSuggestionDismissedIds: next }, { merge: true });
  };

  // v69: 팩은 고정핀 개수 제한이 폐지되어 무제한이다(togglePinned에 max 생략 시 기본 2개 제한이라 Infinity를 명시적으로 넘겨야 함).
  const togglePackPinned = async (packId: string) => {
    if (!user) return;
    const next = togglePinned(profile?.pinnedPackIds, packId, Infinity);
    await setDoc(doc(db, "users", user.uid), { pinnedPackIds: next }, { merge: true });
  };

  // 항목을 길게 눌러 끌어다 순서를 바꾸는 순간 호출된다. 지정한 순서(order)와 정렬기준을
  // "custom"으로 함께 저장해야 다음에 다시 봐도 같은 순서가 유지된다.
  const updateBagOrder = async (order: string[]) => {
    if (!user) return;
    await setDoc(
      doc(db, "users", user.uid),
      { bagOrder: order, bagSortBy: "custom" },
      { merge: true }
    );
  };

  const updatePackOrder = async (order: string[]) => {
    if (!user) return;
    await setDoc(
      doc(db, "users", user.uid),
      { packOrder: order, packSortBy: "custom" },
      { merge: true }
    );
  };

  // v69: 팩 트리(폴더)에서 드래그로 순서를 바꿈거나 다른 폴더로 옷긴 직후 호출된다.
  // parentKey는 폴더 id(최상위는 "root")고, order는 그 레벨의 형제 전체 id 순서다.
  const updatePackOrderByParent = async (parentKey: string, order: string[]) => {
    if (!user) return;
    const next = { ...(profile?.packOrderByParent ?? {}), [parentKey]: order };
    await setDoc(
      doc(db, "users", user.uid),
      { packOrderByParent: next, packSortBy: "custom" },
      { merge: true }
    );
  };

  // 팩 트리에서 펼쳐져있는 폴더 id 목록. 폴더를 탭할 때마다 호출되므로 빈도가 높을 수 있지만,
  // 배열 하나 쓰는 가벼운 쓰기라 부담이 크지 않다.
  const updateExpandedPackFolderIds = async (ids: string[]) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { expandedPackFolderIds: ids }, { merge: true });
  };

  // --- 가방보관함 폴더 (개인 메타데이터, 가방 문서 미수) -----------------------------
  const createBagFolder = async (name: string, parentId?: string): Promise<string> => {
    if (!user) return "";
    const id = `bagfolder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next = {
      ...(profile?.bagFolders ?? {}),
      [id]: { id, name, parentId, createdAt: new Date().toISOString() },
    };
    await setDoc(doc(db, "users", user.uid), stripUndefined({ bagFolders: next }), { merge: true });
    return id;
  };

  const renameBagFolder = async (folderId: string, name: string) => {
    if (!user) return;
    const current = profile?.bagFolders ?? {};
    if (!current[folderId]) return;
    const next = { ...current, [folderId]: { ...current[folderId], name } };
    await setDoc(doc(db, "users", user.uid), stripUndefined({ bagFolders: next }), { merge: true });
  };

  // 폴더 삭제 - 가방 문서는 전혀 건드리지 않고, 그 안의 가방/하위폴더는 이 폴더의 상위
  // (없으면 최상위)로 한 단계씨 올라간다(아이폰 메모처럼).
  const deleteBagFolder = async (folderId: string) => {
    if (!user) return;
    const folders = profile?.bagFolders ?? {};
    const target = folders[folderId];
    if (!target) return;
    const newParentId = target.parentId;

    const updates: Record<string, unknown> = {
      [`bagFolders.${folderId}`]: deleteField(),
    };
    for (const [key, f] of Object.entries(folders)) {
      if (key === folderId) continue;
      if (f.parentId === folderId) {
        updates[`bagFolders.${key}.parentId`] = newParentId ? newParentId : deleteField();
      }
    }
    const assignments = profile?.bagFolderAssignments ?? {};
    for (const [bagId, fId] of Object.entries(assignments)) {
      if (fId !== folderId) continue;
      updates[`bagFolderAssignments.${bagId}`] = newParentId ? newParentId : deleteField();
    }
    await updateDoc(doc(db, "users", user.uid), updates);
  };

  // 폴더를 다른 폴더 안으로(또는 최상위로) 옮기기.
  const moveBagFolder = async (folderId: string, parentId: string | undefined) => {
    if (!user) return;
    const folders = profile?.bagFolders ?? {};
    if (!folders[folderId]) return;
    await updateDoc(doc(db, "users", user.uid), {
      [`bagFolders.${folderId}.parentId`]: parentId ? parentId : deleteField(),
    });
  };

  // 가방을 폴더로(또는 최상위로) 옮기기 - 가방 문서는 전혀 건드리지 않는다.
  const moveBagToFolder = async (bagId: string, folderId: string | undefined) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), {
      [`bagFolderAssignments.${bagId}`]: folderId ? folderId : deleteField(),
    });
  };

  // 다중선택해서 한꺼번에 여러 가방을 폴더로 옥길 때 쓰는 버전 - moveBagToFolder를 루프로 여러 번
  // 불러오면 각 호출이 같은(갱신안된) profile 스냵샷을 기준으로 계산해서 먹히는 문제가 있어,
  // 병합을 한 번에 계산해서 한 번만 쓴다.
  const moveBagsToFolder = async (bagIds: string[], folderId: string | undefined) => {
    if (!user || bagIds.length === 0) return;
    const updates: Record<string, unknown> = {};
    for (const bagId of bagIds) {
      updates[`bagFolderAssignments.${bagId}`] = folderId ? folderId : deleteField();
    }
    await updateDoc(doc(db, "users", user.uid), updates);
  };

  const updateBagOrderByParent = async (parentKey: string, order: string[]) => {
    if (!user) return;
    const next = { ...(profile?.bagOrderByParent ?? {}), [parentKey]: order };
    await setDoc(
      doc(db, "users", user.uid),
      { bagOrderByParent: next, bagSortBy: "custom" },
      { merge: true }
    );
  };

  const updateExpandedBagFolderIds = async (ids: string[]) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { expandedBagFolderIds: ids }, { merge: true });
  };

  // 팩(짐 목록) 표시 설정은 부분 업데이트라서 기존 값과 merge해서 저장한다.
  const updatePackSettings = async (
    settings: Partial<NonNullable<UserProfile["packSettings"]>>
  ) => {
    if (!user) return;
    await setDoc(
      doc(db, "users", user.uid),
      { packSettings: { ...(profile?.packSettings ?? {}), ...settings } },
      { merge: true }
    );
  };

  // 하단 QuickPackBar를 접은 상태(오른쪽 끝 떠있는 작은 버블)로 보여줄지. 계정에 저장해서 어느
  // 화면(팩/가방)에서도 동일하게 적용된다.
  const updateQuickPackCollapsed = async (collapsed: boolean) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { quickPackCollapsed: collapsed }, { merge: true });
  };

  // 가방 속 팩 하나의 펼침/접힘/넓게보기 상태를 바꿔 저장한다. 그룹원과 동기화되는
  // 가방 문서가 아니라 계정(users/{uid})에만 쓰기 때문에, 같은 사용자가 다른 기기에서도
  // 그대로 보이고 다른 그룹원에게는 전혀 영향을 주지 않는다. 키는 `${bagId}:${packId}`.
  // 낙관적(optimistic) 로컬 반영: Firestore 왕복(onSnapshot)을 기다리지 않고 로컬 rawProfile을
  // 먼저 갱신한다. 안 그러면 handleChangeDisplayState에서 이 두 함수를 연달아 호출할 때(예:
  // "가방 열 때 팩 접어서 보기" 오버라이드를 끄는 순간과 동시에) 화면 오버라이드는 즉시 꺼지는데
  // 서버 값은 아직 반영 전이라, 그 사이(네트워크 왕복 시간) 잠깐 잘못된 기본값(collapsed 대신
  // normal)으로 보이는 깜빡임 버그가 있었다.
  const updatePackDisplayState = async (
    bagId: string,
    packId: string,
    state: "normal" | "wide" | "collapsed"
  ) => {
    if (!user) return;
    const next = { ...(profile?.packDisplayStates ?? {}), [`${bagId}:${packId}`]: state };
    setRawProfile((prev) => (prev ? { ...prev, packDisplayStates: next } : prev));
    await setDoc(doc(db, "users", user.uid), { packDisplayStates: next }, { merge: true });
  };

  // 상단 "전체확장/전체접기" 컨트롤용 - 같은 가방 안 모든 팩을 한번에 같은 상태로 바꾼다.
  const updateAllPackDisplayStates = async (
    bagId: string,
    packIds: string[],
    state: "normal" | "wide" | "collapsed"
  ) => {
    if (!user) return;
    const next = { ...(profile?.packDisplayStates ?? {}) };
    for (const packId of packIds) next[`${bagId}:${packId}`] = state;
    setRawProfile((prev) => (prev ? { ...prev, packDisplayStates: next } : prev));
    await setDoc(doc(db, "users", user.uid), { packDisplayStates: next }, { merge: true });
  };

  // 이 가방만의 보기 방식(팩뷰/메모장뷰) 개별 오버라이드. 이것도 사용자별 설정이라
  // 같은 가방을 보는 다른 그룹원은 각자 원하는 보기 방식으로 자유롭게 볼 수 있다.
  const updateBagViewMode = async (bagId: string, mode: "pack" | "notebook") => {
    if (!user) return;
    const next = { ...(profile?.bagViewMode ?? {}), [bagId]: mode };
    await setDoc(doc(db, "users", user.uid), { bagViewMode: next }, { merge: true });
  };

  // 설정 > 가방설정에서 고르는 새 가방의 기본 보기 방식(전역 기본값).
  const updateDefaultBagViewMode = async (mode: "pack" | "notebook") => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { defaultBagViewMode: mode }, { merge: true });
  };

  const resendVerificationEmail = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
    } catch (err) {
      console.error("[팩인백] 인증 메일 재발송 실패:", err);
      throw err;
    }
  };

  // 로그인 화면에서 "인증 메일이 아직 안 왔어요" 상황일 때, 앱에 로그인 상태로
  // 남기지 않으면서 인증 메일만 다시 보내기 위한 함수. 잠깐 로그인했다가 바로 로그아웃한다.
  const resendVerificationByCredential = async (email: string, password: string) => {
    setAuthBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      try {
        if (!cred.user.emailVerified) {
          await sendEmailVerification(cred.user);
        }
      } finally {
        await signOut(auth);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  // 비밀번호 변경은 보안상 최근 로그인이 필요해서, 현재 비밀번호로 재인증한 뒤 바꾼다.
  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user || !user.email) return;
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  };

  const logout = () => signOut(auth);

  const deleteAccount = async () => {
    if (!user) return;
    // Firestore/Storage 데이터를 먼저 정리하고, 마지막에 Auth 계정을 지운다.
    // (순서를 반대로 하면 로그인 정보가 먼저 사라져서 이후 Firestore 규칙상 접근이 막힘)
    await deleteAllUserData(user.uid);
    try {
      await deleteUser(user);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (code === "auth/requires-recent-login") {
        throw new Error(
          "보안을 위해 다시 로그인한 뒤 탈퇴를 진행해주세요. (데이터는 이미 삭제되었어요)"
        );
      }
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authBusy,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        signInWithApple,
        completeProfile,
        updateNickname,
        updateAvatar,
        updateThemePrefs,
        updateFontScale,
        updateDefaultTab,
        updateBagSortBy,
        updateBagCardSize,
        updatePackSortBy,
        toggleBagPinned,
        toggleBagArchived,
        archiveBags,
        dismissArchiveSuggestions,
        togglePackPinned,
        updateBagOrder,
        updatePackOrder,
        updatePackOrderByParent,
        updateExpandedPackFolderIds,
        createBagFolder,
        renameBagFolder,
        deleteBagFolder,
        moveBagFolder,
        moveBagToFolder,
        moveBagsToFolder,
        updateBagOrderByParent,
        updateExpandedBagFolderIds,
        updatePackSettings,
        updateQuickPackCollapsed,
        updatePackDisplayState,
        updateAllPackDisplayStates,
        updateBagViewMode,
        updateDefaultBagViewMode,
        resendVerificationEmail,
        resendVerificationByCredential,
        sendPasswordReset,
        changePassword,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
