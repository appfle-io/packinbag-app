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
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  User,
} from "firebase/auth";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserProfile } from "@/lib/types";
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
  updateDefaultTab: (defaultTab: "home" | "packs") => Promise<void>;
  updateBagSortBy: (sortBy: UserProfile["bagSortBy"]) => Promise<void>;
  updatePackSortBy: (sortBy: UserProfile["packSortBy"]) => Promise<void>;
  toggleBagPinned: (bagId: string) => Promise<void>;
  togglePackPinned: (packId: string) => Promise<void>;
  updateBagOrder: (order: string[]) => Promise<void>;
  updatePackOrder: (order: string[]) => Promise<void>;
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
        packSortBy: data?.packSortBy as UserProfile["packSortBy"],
        pinnedBagIds: data?.pinnedBagIds as string[] | undefined,
        pinnedPackIds: data?.pinnedPackIds as string[] | undefined,
        bagOrder: data?.bagOrder as string[] | undefined,
        packOrder: data?.packOrder as string[] | undefined,
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
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!cred.user.emailVerified) {
      await signOut(auth);
      throw new Error("EMAIL_NOT_VERIFIED");
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // 이전에 로그인했던 계정으로 자동 로그인되지 않고, 누를때마다 구글 계정 선택
    // 화면을 다시 보여줘서 다른 계정으로 바꿔 로그인할 수 있게 한다.
    provider.setCustomParameters({ prompt: "select_account" });
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
  const updateDefaultTab = async (defaultTab: "home" | "packs") => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { defaultTab }, { merge: true });
  };

  const updateBagSortBy = async (sortBy: UserProfile["bagSortBy"]) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { bagSortBy: sortBy }, { merge: true });
  };

  const updatePackSortBy = async (sortBy: UserProfile["packSortBy"]) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { packSortBy: sortBy }, { merge: true });
  };

  // 고정핀 토글(최대 2개까지). 이미 고정된 걸 다시 누르면 해제되고, 2개가 다 찬 상태에서
  // 새로 고정하려 하면 togglePinned이 조용히 무시한다.
  const toggleBagPinned = async (bagId: string) => {
    if (!user) return;
    const next = togglePinned(profile?.pinnedBagIds, bagId);
    await setDoc(doc(db, "users", user.uid), { pinnedBagIds: next }, { merge: true });
  };

  const togglePackPinned = async (packId: string) => {
    if (!user) return;
    const next = togglePinned(profile?.pinnedPackIds, packId);
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
  const updatePackDisplayState = async (
    bagId: string,
    packId: string,
    state: "normal" | "wide" | "collapsed"
  ) => {
    if (!user) return;
    const next = { ...(profile?.packDisplayStates ?? {}), [`${bagId}:${packId}`]: state };
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
        completeProfile,
        updateNickname,
        updateAvatar,
        updateThemePrefs,
        updateFontScale,
        updateDefaultTab,
        updateBagSortBy,
        updatePackSortBy,
        toggleBagPinned,
        togglePackPinned,
        updateBagOrder,
        updatePackOrder,
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
