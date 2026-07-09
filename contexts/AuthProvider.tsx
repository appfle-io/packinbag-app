"use client";

import {
  createContext,
  useContext,
  useEffect,
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
import { deleteAllUserData } from "@/lib/accountService";

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
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
      setProfile({
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
        packSettings: data?.packSettings as UserProfile["packSettings"],
        aiUsage: data?.aiUsage as UserProfile["aiUsage"],
        unlockCode: data?.unlockCode as string | undefined,
      });
      setLoading(false);
    });
    return unsubDoc;
  }, [user]);

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
    await setDoc(
      doc(db, "users", user.uid),
      { nickname, avatarId },
      { merge: true }
    );
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
