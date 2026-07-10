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
  useEffect(() => {
    const code = rawProfile?.unlockCode;
    if (!code) {
      setUnlockLiveStatus(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "unlockCodes", code),
      (snap) => {
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
        const expired =
          !!expiresAt &&
          typeof expiresAt.toDate === "function" &&
          expiresAt.toDate().getTime() < Date.now();
        setUnlockLiveStatus(expired ? "expired" : "active");
      },
      () => {
        // 권한 문제/로그아웃 경합 등으로 구독 자체가 실패하면 상태를 모르는 채로 두고,
        // premiumLimits.ts가 기존처럼 캐시된 unlockCodeExpiresAt 기준으로 판단하게 둔다.
        setUnlockLiveStatus(null);
      }
    );
    return unsub;
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
    const cred = await signInWithEmailAndPassword(auth, email, password);
    try {
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
      }
    } finally {
      await signOut(auth);
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
