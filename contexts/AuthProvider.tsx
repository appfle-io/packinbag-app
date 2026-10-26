"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  OAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  User,
} from "firebase/auth";
import { isNativePlatform, nativeAppleIdToken, nativeGoogleIdToken } from "@/lib/nativeAuth";
import { ensurePurchasesConfigured } from "@/lib/purchaseService";
import {
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteField,
  runTransaction,
  clearIndexedDbPersistence,
  type DocumentData,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { sendVerificationEmailWithFallback } from "@/lib/emailVerification";
import { UserProfile, StartPageConfig, BagReminder, BagPushKind, PrivateLock, WidgetStyle } from "@/lib/types";
import { setNativeSummaryLocks, pushWidgetStyles } from "@/lib/v2/nativeBridge";
import { effectiveWidgetStyles } from "@/lib/v2/widgetStyles";
import { isPremiumUser } from "@/lib/premiumLimits";
import { stripUndefined } from "@/lib/firestoreSanitize";
import { togglePinned, V2_MAX_PINNED_BAGS } from "@/lib/listSort";
import { recheckConnectivity } from "@/lib/v2/connectivity";
import { resolveFolderNameClashes } from "@/lib/bagFolderNames";
import { deleteAccountServerSide, deleteAllUserData } from "@/lib/accountService";
import { getApiUrl } from "@/lib/apiBase";
import { seedSampleDataForNewUser } from "@/lib/sampleOnboardingData";
import { getUserBagsOnce } from "@/lib/bagsService";
import {
  OFFLINE_USER_UID,
  getLocalProfile,
  saveLocalProfile,
} from "@/lib/localBagsService";
import { isDemoMode } from "@/lib/demoMode";
import { seedDemoDataOnce } from "@/lib/demoSeed";
import { isReminderEmpty } from "@/lib/v2/reminderPlan";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isGuest: boolean;
  isOfflineMode: boolean;
  // 회원가입 처리 중(계정 생성 -> 샘플데이터/인증메일 -> 로그아웃) true. 이 사이에는
  // Firebase가 잠깐 로그인 상태가 되지만, 화면은 절대 홈으로 넘어가면 안 된다
  // (넘어갔다가 마지막에 signOut하면서 다시 로그인 화면으로 튕기는 부자연스러운
  // 깜빡임이 생기기 때문 - AppShell에서 이 값을 user와 함께 확인해서 막는다).
  authBusy: boolean;
  // 로그인했는데 프로필 문서를 서버에서 끝내 못 받은 상태(닉네임을 모름). 첫 프로필 화면 대신 "다시 시도"를 보여 준다(2026-10-17)
  profileUnconfirmed: boolean;
  retryProfileLoad: () => void;
  isMaster: boolean;
  startOfflineMode: () => void;
  exitOfflineMode: () => void;
  switchToOnlineMode: () => void;
  signInAsGuest: () => Promise<void>;
  linkAccountWithGoogle: () => Promise<void>;
  linkAccountWithApple: () => Promise<void>;
  linkAccountWithEmail: (email: string, password: string) => Promise<boolean>;
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
    themeMode?: UserProfile["themeMode"];
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
    bagCardFontScale?: number;
    packCardScale?: number;
    packLibraryCardScale?: number;
    packCardFontScale?: number;
    fontFamily?: UserProfile["fontFamily"];
  }) => Promise<void>;
  updateFontScale: (fontScale: "sm" | "md" | "lg") => Promise<void>;
  updateDefaultTab: (defaultTab: "home" | "settings" | "packs") => Promise<void>;
  updateStartPage: (startPage: StartPageConfig) => Promise<void>;
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
  flattenBagFolders: () => Promise<void>;
  moveBagToFolder: (bagId: string, folderId: string | undefined) => Promise<void>;
  moveBagsToFolder: (bagIds: string[], folderId: string | undefined) => Promise<void>;
  updateBagOrderByParent: (parentKey: string, order: string[]) => Promise<void>;
  updateExpandedBagFolderIds: (ids: string[]) => Promise<void>;
  updateBagSettings: (settings: Partial<NonNullable<UserProfile["bagSettings"]>>) => Promise<void>;
  updatePackSettings: (settings: Partial<NonNullable<UserProfile["packSettings"]>>) => Promise<void>;
  updateQuickPackCollapsed: (collapsed: boolean) => Promise<void>;
  updateBagPhoneColumns: (columns: 1 | 2) => Promise<void>;
  updateSidebarWidth: (width: number) => Promise<void>;
  updateSidebarCollapsed: (collapsed: boolean) => Promise<void>;
  updateShortUrlEnabled: (enabled: boolean) => Promise<void>;
  updateRegionRecommendEnabled: (enabled: boolean) => Promise<void>;
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
  // 가방 하나의 내 알림 설정(null이면 지움). lib/v2/bagReminders.ts
  updateBagReminder: (bagId: string, reminder: BagReminder | null) => Promise<void>;
  // 서버 푸시 종류별 켜기 · 가방별 끄기(2026-10-11)
  updatePushPref: (kind: "activity" | "assign" | "member", on: boolean) => Promise<void>;
  setBagPushMuted: (bagId: string, muted: boolean) => Promise<void>;
  // 이 가방에서 끈 소식 종류(빈 배열이면 지움, 2026-10-11)
  setBagPushOff: (bagId: string, kinds: BagPushKind[]) => Promise<void>;
  // 개인 잠금 설정 통째로 쓰기(null이면 지움, 2026-10-12)
  updatePrivateLock: (next: PrivateLock | null) => Promise<void>;
  // 북마크 위젯 꾸미기 목록 통째로 쓰기(2026-10-18). 사진 올리기 · 지우기는 lib/v2/widgetStyles.ts
  updateWidgetStyles: (next: WidgetStyle[]) => Promise<void>;
  // 본인 확인(이메일 계정은 비밀번호, 소셜은 다시 로그인 창). PIN을 잊었을 때 재설정에 쓴다
  reauthenticate: (password?: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  resendVerificationByCredential: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  // 이메일 가입 계정은 지금 비밀번호로 다시 확인한 뒤 지운다(소셜 계정은 password 없이)
  deleteAccount: (password?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// users/{uid} 쓰기에서 "이 필드 지우기" 표시. 온라인이면 deleteField()로 바꾸고, 오프라인 모드면 로컬 프로필에서 지운다
const REMOVE_FIELD = Symbol("pib-remove-field");
type UserPatch = Record<string, unknown>;

// 오프라인 모드용: "bagFolders.abc.parentId" 같은 점 경로까지 로컬 프로필 객체에 그대로 적용한다
function applyUserPatch<T extends object>(base: T, patch: UserPatch): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    const path = key.split(".");
    let node = out;
    for (let i = 0; i < path.length - 1; i++) {
      const child = node[path[i]];
      const copy: Record<string, unknown> =
        child && typeof child === "object" && !Array.isArray(child) ? { ...(child as Record<string, unknown>) } : {};
      node[path[i]] = copy;
      node = copy;
    }
    const last = path[path.length - 1];
    if (value === REMOVE_FIELD) delete node[last];
    else node[last] = value;
  }
  return out as T;
}

function toFirestorePatch(patch: UserPatch): UserPatch {
  const out: UserPatch = {};
  for (const [key, value] of Object.entries(patch)) out[key] = value === REMOVE_FIELD ? deleteField() : value;
  return out;
}

async function ensureUserDoc(user: User) {
  const ref = doc(db, "users", user.uid);
  // createdAt은 문서가 처음 생길 때만 쓴다. 예전에는 Google · Apple · 게스트 로그인 · 연동 때마다 merge로 덮어써
  // 가입 시각이 "마지막 로그인 시각"이 됐다(2026-10-15, auth.md 확인 필요 1). 로그인할 때 읽기 1번이 늘어난다
  let exists = true;
  try {
    exists = (await getDoc(ref)).exists();
  } catch {
    // 못 읽으면 가입 시각을 건드리지 않는 쪽으로
  }
  await setDoc(
    ref,
    {
      email: user.email,
      displayName: user.displayName,
      ...(exists ? {} : { createdAt: serverTimestamp() }),
      // nickname/avatarId는 merge라서 이미 있으면 덮어쓰지 않음 -> 처음 가입한 사람만 비어있음
    },
    { merge: true }
  );
}

const LOCAL_DEVICE_START_PAGE_KEY = "pib_device_start_page";

function getDeviceStartPage(): StartPageConfig {
  if (typeof window === "undefined") {
    return { type: "home", title: "가방 보관함 (기본)" };
  }
  try {
    const saved = localStorage.getItem(LOCAL_DEVICE_START_PAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object" && parsed.type) {
        return parsed as StartPageConfig;
      }
    }
  } catch {}
  return { type: "home", title: "가방 보관함 (기본)" };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [deviceStartPage, setDeviceStartPage] = useState<StartPageConfig>(getDeviceStartPage);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_DEVICE_START_PAGE_KEY) {
        setDeviceStartPage(getDeviceStartPage());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // users/{uid} 문서에서 그대로 읽어온 값. 이용권이 실제로 지금 유효한지(무효화/만료
  // 여부)는 여기 없다 - 아래 unlockLiveStatus가 따로 담당한다 (그 이유는 바로 아래 주석 참고).
  const isInitialOffline = () => {
    if (typeof window !== "undefined") {
      // 체험 모드(?demo=1)는 여기서 보지 않는다. useState 초기값이 서버 화면과 달라져 하이드레이션 오류가 나서,
      // 첫 화면을 그린 뒤 아래 시작 effect에서 startOfflineMode()로 들어간다(2026-10-18)
      const urlParams = new URLSearchParams(window.location.search);
      if (
        urlParams.get("offline") === "true" ||
        localStorage.getItem("pib_offline_mode") === "true"
      ) {
        return true;
      }
    }
    return false;
  };

  const [rawProfile, setRawProfile] = useState<UserProfile | null>(() => {
    if (isInitialOffline()) {
      return {
        ...getLocalProfile(),
        role: "master",
        premiumPurchase: {
          purchased: true,
          purchasedAt: new Date().toISOString(),
        },
      };
    }
    return null;
  });
  // unlockCodes/{code} 문서를 실시간 구독해서 얻는 값. 마스터가 "무효화" 버튼을 누르면
  // unlockCodes/{code}.status만 바뀌고 users/{uid} 문서는 안 건드리기 때문에, users/{uid}
  // 구독만으로는 무효화를 실시간으로 알 수 없다 - 그래서 이 문서도 별도로 구독해야 한다.
  const [unlockLiveStatus, setUnlockLiveStatus] = useState<
    "active" | "invalidated" | "expired" | null
  >(null);
  const [loading, setLoading] = useState(() => !isInitialOffline());
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(isInitialOffline);
  // signUpWithEmail/resendVerificationByCredential처럼 잠깐 로그인했다가 곧바로
  // signOut하는 흐름 동안 true. AppShell이 이 값을 user와 함께 확인해서 그 사이엔
  const [authBusy, setAuthBusy] = useState(false);
  const [profileUnconfirmed, setProfileUnconfirmed] = useState(false);
  // 바뀌면 users 문서 구독을 다시 시작한다("다시 시도")
  const [profileLoadKey, setProfileLoadKey] = useState(0);
  const retryProfileLoad = () => {
    setProfileUnconfirmed(false);
    setLoading(true);
    setProfileLoadKey((k) => k + 1);
  };
  const [isMasterDoc, setIsMasterDoc] = useState(false);
  const [isMasterToken, setIsMasterToken] = useState(false);
  const [isMasterApi, setIsMasterApi] = useState(false);

  const startOfflineMode = () => {
    // 체험 모드는 진짜 오프라인 모드 표시를 남기지 않는다(다음에 팩인백을 열면 평소대로)
    if (typeof window !== "undefined" && !isDemoMode()) {
      localStorage.setItem("pib_offline_mode", "true");
    }
    if (isDemoMode()) seedDemoDataOnce();
    setIsOfflineMode(true);
    setUser({
      uid: OFFLINE_USER_UID,
      email: "offline@local",
      displayName: "오프라인 사용자",
      emailVerified: true,
      isAnonymous: false,
      providerData: [],
      getIdToken: async () => "offline-token",
      getIdTokenResult: async () => ({ token: "offline-token", claims: {} }),
      reload: async () => {},
    } as unknown as User);
    setRawProfile({
      ...getLocalProfile(),
      role: "master",
      premiumPurchase: {
        purchased: true,
        purchasedAt: new Date().toISOString(),
      },
    });
    setLoading(false);
  };

  const exitOfflineMode = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("pib_offline_mode");
    }
    setIsOfflineMode(false);
    setUser(null);
    setRawProfile(null);
    setLoading(false);
  };

  // 계정 → 오프라인 모드 전환(switchToOfflineMode)은 10/4에 화면에서 빠졌고 10/15에 함수도 지웠다(원칙 1: 세션이 있으면 언제나 계정 모드)
  const switchToOnlineMode = () => {
    // 새로고침 없이 그 자리에서 바꾼다. 이 기기에 로그인 세션이 남아 있으면 바로 그 계정으로,
    // 없으면 로그인 화면으로. 로그인 뒤 오프라인 데이터 합치기 시트는 AppShell이 띄운다
    if (typeof window !== "undefined") localStorage.removeItem("pib_offline_mode");
    setIsOfflineMode(false);
    setRawProfile(null);
    const current = auth.currentUser;
    if (current) {
      setUser(current);
      setLoading(true);
    } else {
      setUser(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const isExplicitOffline =
      isDemoMode() ||
      localStorage.getItem("pib_offline_mode") === "true" ||
      urlParams.get("offline") === "true";

    if (isExplicitOffline) {
      // 시작할 때 한 번: 주소(?offline=true)나 이 기기에 남은 오프라인 모드 표시를 따른다
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startOfflineMode();
      return;
    }

  }, []);

  useEffect(() => {
    if (!user || isOfflineMode) {
      // 로그아웃 · 오프라인 모드면 마스터 판정을 비운다
      /* eslint-disable react-hooks/set-state-in-effect */
      setIsMasterDoc(false);
      setIsMasterToken(false);
      setIsMasterApi(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    // 1) Auth ID Token Custom Claims 확인
    user.getIdTokenResult().then((res) => {
      if (res.claims.role === "master" || res.claims.admin === true) {
        setIsMasterToken(true);
      }
    }).catch(() => {});

    // 2) 서버 API로 마스터 여부 확인 및 DB 동기화
    user.getIdToken().then((token) => {
      fetch("/api/auth/master-status", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.isMaster) {
            setIsMasterApi(true);
          }
        })
        .catch(() => {});
    }).catch(() => {});

    // 3) Firestore masters/{uid} 문서 구독
    const unsubMaster = onSnapshot(
      doc(db, "masters", user.uid),
      (snap) => {
        setIsMasterDoc(snap.exists());
      },
      () => {
        setIsMasterDoc(false);
      }
    );
    return () => unsubMaster();
  }, [user, isOfflineMode]);

  // 앱을 켜고 처음 받는 로그인 상태인지. "세션 없음 + 인터넷 없음 → 바로 오프라인 모드"는 시작할 때만 한다.
  // 로그아웃·탈퇴 뒤에는 항상 로그인 화면으로(2026-10-11). 끊겨 있으면 로그인 화면이 "오프라인 모드로 시작"을 보여 준다
  const authResolvedOnceRef = useRef(false);

  // 개인 잠금으로 잠근 가방 · 팩은 위젯 · 잠금화면 요약에서 뺀다(lib/v2/nativeBridge, 2026-10-12)
  const privateLockValue = rawProfile?.privateLock;
  useEffect(() => {
    setNativeSummaryLocks(privateLockValue ?? null);
  }, [privateLockValue]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      const isStartup = !authResolvedOnceRef.current;
      authResolvedOnceRef.current = true;
      // 체험 모드면 이 브라우저의 로그인 세션을 무시한다(실제 계정이 체험 화면에 뜨거나 저장되지 않게, OFF-DEMO-02)
      if (isDemoMode()) return;
      // 1. 유효한 로그인 계정 세션이 감지된 경우:
      // 기존 오프라인 플래그(pib_offline_mode)에 가로막히지 않고 세션을 최우선 적용.
      // 케이스 1-2(오프라인 캐시 이어쓰기), 3-1(로그인 후 계정 진입), 3-2(자동 동기화) 완벽 보장.
      if (firebaseUser) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("pib_offline_mode");
        }
        setIsOfflineMode(false);
        setUser(firebaseUser);
        // 재로그인 시 이전 세션의 profile(null)이 잠깐 남아있는 상태에서
        // "닉네임 정하기" 화면이 한 프레임 스치듯 보이는 걸 막기 위해
        // 새 프로필 문서를 읽어올 때까지 로딩 상태 유지
        setLoading(true);
        ensurePurchasesConfigured(firebaseUser.uid).catch((err) => {
          console.error("[팩인백] RevenueCat 초기화 실패:", err);
        });
        return;
      }

      // 2. 비로그인 상태일 때:
      // 이미 명시적 오프라인 모드인 경우 null로 덮어쓰지 않고 유지
      const isCurrentlyOffline =
        isOfflineMode ||
        (typeof window !== "undefined" &&
          (localStorage.getItem("pib_offline_mode") === "true" ||
            new URLSearchParams(window.location.search).get("offline") === "true"));
      if (isCurrentlyOffline) {
        return;
      }

      setUser(null);
      setRawProfile(null);

      if (!isStartup) {
        setLoading(false);
        return;
      }

      // 세션이 없는데 인터넷(폐쇄망 포함)이 안 되면 모든 플랫폼에서 바로 오프라인 모드로 시작한다.
      // 나중에 연결되면 연결 줄의 "로그인"으로 계정에 합친다(lib/v2/connectivity, ConnectionBar). 확인하는 동안은 스플래시
      recheckConnectivity(1500).then((c) => {
        if (c === "offline") startOfflineMode();
        else setLoading(false);
      });
    });
    return unsubAuth;
    // 로그인 상태 구독은 한 번만 한다. isOfflineMode를 넣으면 오프라인 모드로 바꿀 때 다시 구독되면서
    // 남아 있는 세션이 곧바로 들어와 계정 모드로 되돌린다(오프라인 여부는 localStorage로도 확인함)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 오프라인 모드(가짜 user)는 Firestore를 구독하지 않는다. 구독하면 폐쇄망에서 "문서 없음" 캐시 스냅샷이
  // 로컬 프로필(닉네임·프리미엄)을 덮어써 닉네임 정하기 화면으로 튕긴다. 오프라인 프로필은 localStorage가 원본
  useEffect(() => {
    if (!user || isOfflineMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 로그아웃 · 오프라인 모드면 "다시 시도" 상태를 비운다
      setProfileUnconfirmed(false);
      return;
    }
    const ref = doc(db, "users", user.uid);
    let cancelled = false;
    // 믿을 수 있는 값(닉네임이 있거나 서버가 확인한 값)으로 화면을 열었는지
    let done = false;
    // 닉네임이 없는 캐시 · 내 쓰기 스냅샷(서버 답을 기다리는 동안 들고 있는 값)
    let deferred: UserProfile | null = null;

    const build = (data: DocumentData | undefined): UserProfile => ({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          nickname: (data?.nickname as string | undefined) ?? null,
          avatarId: (data?.avatarId as string | undefined) ?? null,
          role: (data?.role as "master" | "user" | undefined) ?? undefined,
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
          bagCardFontScale: data?.bagCardFontScale as number | undefined,
          packCardScale: data?.packCardScale as number | undefined,
          packLibraryCardScale: data?.packLibraryCardScale as number | undefined,
          packCardFontScale: data?.packCardFontScale as number | undefined,
          fontScale: data?.fontScale as UserProfile["fontScale"],
          // 주의: UserProfile에 필드를 만들면 여기에도 추가해야 화면에 반영된다
          fontFamily: data?.fontFamily as UserProfile["fontFamily"],
          defaultTab: data?.defaultTab as UserProfile["defaultTab"],
          startPage: data?.startPage as UserProfile["startPage"],
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
          bagFolderOrder: data?.bagFolderOrder as string[] | undefined,
          bagOrderByParent: data?.bagOrderByParent as UserProfile["bagOrderByParent"],
          expandedBagFolderIds: data?.expandedBagFolderIds as string[] | undefined,
          bagSettings: data?.bagSettings as UserProfile["bagSettings"],
          packSettings: data?.packSettings as UserProfile["packSettings"],
          quickPackCollapsed: data?.quickPackCollapsed as boolean | undefined,
          bagPhoneColumns: data?.bagPhoneColumns as UserProfile["bagPhoneColumns"],
          sidebarWidth: data?.sidebarWidth as number | undefined,
          sidebarCollapsed: data?.sidebarCollapsed as boolean | undefined,
          packDisplayStates: data?.packDisplayStates as UserProfile["packDisplayStates"],
          bagViewMode: data?.bagViewMode as UserProfile["bagViewMode"],
          defaultBagViewMode: data?.defaultBagViewMode as UserProfile["defaultBagViewMode"],
          aiUsage: data?.aiUsage as UserProfile["aiUsage"],
          shortUrlEnabled: data?.shortUrlEnabled as boolean | undefined,
          regionRecommendEnabled: data?.regionRecommendEnabled as boolean | undefined,
          unlockCode: data?.unlockCode as string | undefined,
          unlockCodeExpiresAt: data?.unlockCodeExpiresAt as string | null | undefined,
          // 인앱결제(RevenueCat 웹훅이 기록). 예전에는 여기서 빠져 있어 구매자가 화면에서 무료로 보였다(2026-10-09)
          premiumPurchase: data?.premiumPurchase as UserProfile["premiumPurchase"],
          // 가방 알림(2026-10-10)
          bagReminders: data?.bagReminders as UserProfile["bagReminders"],
          // 서버 푸시 설정(2026-10-11)
          pushPrefs: data?.pushPrefs as UserProfile["pushPrefs"],
          pushMutedBagIds: data?.pushMutedBagIds as string[] | undefined,
          bagPushOff: data?.bagPushOff as UserProfile["bagPushOff"],
          // 개인 잠금(2026-10-12)
          privateLock: data?.privateLock as UserProfile["privateLock"],
          // 북마크 위젯 꾸미기(2026-10-18)
          widgetStyles: data?.widgetStyles as UserProfile["widgetStyles"],
    });

    function open(p: UserProfile) {
      done = true;
      clearTimeout(safetyTimer);
      deferred = null;
      setProfileUnconfirmed(false);
      setRawProfile(p);
      setLoading(false);
    }

    // 2.5초 안에 믿을 수 있는 값이 안 오면 서버에 직접 물어본다(최대 8초, 그동안 스플래시).
    // 예전에는 닉네임 없는 캐시 값으로 그냥 열어서, 로그아웃 · 앱 재설치 뒤 느린 망에서 있는 계정인데
    // 첫 프로필(닉네임 정하기)이 떴다(2026-10-17, auth.md AUTH-BOOT-03). 끝내 못 받으면 "다시 시도" 화면(profileUnconfirmed)
    const safetyTimer = setTimeout(() => {
      if (done) return;
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
      Promise.race([getDocFromServer(ref).catch(() => null), timeout]).then((snap) => {
        if (cancelled || done) return;
        if (snap) {
          open(build(snap.data()));
          return;
        }
        setRawProfile(deferred ?? build(undefined));
        setProfileUnconfirmed(true);
        setLoading(false);
      });
    }, 2500);

    const unsubDoc = onSnapshot(
      ref,
      // 캐시 → 서버 확인처럼 내용은 같고 출처만 바뀌는 스냅샷도 받는다(읽기 비용 없음)
      { includeMetadataChanges: true },
      (snap) => {
        const next = build(snap.data());
        // 구글·애플 로그인 직후: 로그아웃 때 캐시를 지워서, ensureUserDoc(이메일·이름만 merge)의 내 쓰기만 담긴
        // 스냅샷(닉네임 없음)이 먼저 온다. 이걸 믿으면 기존 계정인데 "닉네임 정하기"가 뜨니,
        // 닉네임이 없고 서버에서 확인된 값이 아니면 로딩을 유지한다(2026-10-11)
        if (!next.nickname && (snap.metadata.fromCache || snap.metadata.hasPendingWrites)) {
          deferred = next;
          return;
        }
        open(next);
      },
      (err) => {
        // 구독이 실패해도 안전 타이머가 서버에 직접 물어보고, 안 되면 "다시 시도"를 보여 준다
        console.warn("[AuthProvider] user doc onSnapshot error/offline:", err);
      }
    );
    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      unsubDoc();
    };
  }, [user, isOfflineMode, profileLoadKey]);

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
      // 이용권이 없으면 구독하지 않고 상태를 비운다
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    return {
      ...rawProfile,
      unlockCodeLiveStatus: unlockLiveStatus,
      startPage: deviceStartPage,
    };
  }, [rawProfile, unlockLiveStatus, deviceStartPage]);

  // 북마크 위젯 꾸미기를 iOS 위젯에 넘긴다(2026-10-18, 1.7 앱부터). 무료면 1개 · 기본 바탕만. 같은 내용이면 네이티브를 안 부른다
  const widgetStylesValue = rawProfile?.widgetStyles;
  const widgetPremium = !!profile && isPremiumUser(profile.email, profile);
  const hasRawProfile = !!rawProfile;
  useEffect(() => {
    if (!user || isOfflineMode || !hasRawProfile) return;
    void pushWidgetStyles(effectiveWidgetStyles(widgetStylesValue, widgetPremium));
  }, [user, isOfflineMode, hasRawProfile, widgetStylesValue, widgetPremium]);

  const packDisplayStatesRef = useRef<NonNullable<UserProfile["packDisplayStates"]>>({});
  const packDisplayDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandedPackFolderDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandedBagFolderDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    packDisplayStatesRef.current = profile?.packDisplayStates ?? {};
  }, [profile?.packDisplayStates]);

  // 프리미엄 전용 토글(짧은 URL 사용하기/지역 추천)은 이용권이 만료/무효화되어 프리미엄이
  // 아닌 상태로 돌아오는 순간, 켜져있던 값이 그대로 남아있으면 자동으로 꺼준다.
  // "직전 세션에서 true였다가 false로 바뀌는 순간"만 감지하는 대신, profile이 갱신될 때마다
  // "지금 프리미엄이 아닌데도 켜져있는" 상태를 매번 검사해서 고치는 자가치유 방식으로 구현했다 -
  // 앱을 닫았다 켜는 사이에 이용권이 만료되어(다음 세션에서는 "전환"을 못 보는) 경우도 놓치지 않는다.
  useEffect(() => {
    if (!user || !profile) return;
    if (isPremiumUser(profile.email, profile)) return;
    if (!profile.shortUrlEnabled && !profile.regionRecommendEnabled) return;
    setDoc(
      doc(db, "users", user.uid),
      { shortUrlEnabled: false, regionRecommendEnabled: false },
      { merge: true }
    ).catch((err) => {
      console.error("[팩인백] 프리미엄 전용 기능 자동 비활성화 실패:", err);
    });
  }, [user, profile]);

  // users/{uid} 쓰기 공통. 오프라인 모드면 Firestore 대신 이 기기(localStorage)에 저장하고 화면에 바로 반영한다.
  // dotted=true면 점 경로 부분 수정(updateDoc), 아니면 setDoc merge
  const writeUser = async (patch: UserPatch, dotted = false) => {
    if (!user) return;
    if (isOfflineMode) {
      saveLocalProfile(applyUserPatch(getLocalProfile(), patch));
      setRawProfile((prev) => (prev ? applyUserPatch(prev, patch) : prev));
      return;
    }
    const ref = doc(db, "users", user.uid);
    const data = toFirestorePatch(patch);
    if (dotted) await updateDoc(ref, data);
    else await setDoc(ref, data, { merge: true });
  };

  // 가방 알림 설정은 그 가방 키만 고친다(다른 가방 설정을 덮어쓰지 않게 점 경로). 비었으면 키를 지운다
  const updateBagReminder = async (bagId: string, reminder: BagReminder | null) => {
    const empty = isReminderEmpty(reminder);
    await writeUser({ [`bagReminders.${bagId}`]: empty ? REMOVE_FIELD : stripUndefined(reminder) }, true);
  };

  // 서버 푸시 설정(2026-10-11). 점 경로로 그 값만. 서버(functions)는 값이 없으면 켜진 것으로 본다
  const updatePushPref = async (kind: "activity" | "assign" | "member", on: boolean) => {
    setRawProfile((prev) => (prev ? { ...prev, pushPrefs: { ...(prev.pushPrefs ?? {}), [kind]: on } } : prev));
    await writeUser({ [`pushPrefs.${kind}`]: on }, true);
  };

  const setBagPushMuted = async (bagId: string, muted: boolean) => {
    const current = profile?.pushMutedBagIds ?? [];
    const next = muted ? Array.from(new Set([...current, bagId])) : current.filter((id) => id !== bagId);
    setRawProfile((prev) => (prev ? { ...prev, pushMutedBagIds: next } : prev));
    await writeUser({ pushMutedBagIds: next });
  };

  // 이 가방에서 끈 소식 종류. 그 가방 키만 점 경로로, 비면 키를 지운다
  const setBagPushOff = async (bagId: string, kinds: BagPushKind[]) => {
    const next = Array.from(new Set(kinds));
    setRawProfile((prev) => {
      if (!prev) return prev;
      const map = { ...(prev.bagPushOff ?? {}) };
      if (next.length) map[bagId] = next;
      else delete map[bagId];
      return { ...prev, bagPushOff: map };
    });
    await writeUser({ [`bagPushOff.${bagId}`]: next.length ? next : REMOVE_FIELD }, true);
  };

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
        // Resend(브랜드 도메인)로 먼저 시도하고, 실패하면 내부에서 자동으로
        // Firebase 기본 발송으로 폴백한다 (lib/emailVerification.ts 참고).
        await sendVerificationEmailWithFallback(cred.user);
      } catch (err) {
        // 계정 생성 자체는 성공했으니 가입을 막지는 않되, 원인 파악용으로 콘솔에 남긴다.
        console.error("[팩인백] 인증 메일 발송 실패(Resend/Firebase 둘 다):", err);
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
    if (typeof window !== "undefined") {
      localStorage.removeItem("pib_offline_mode");
    }
    setIsOfflineMode(false);
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
    if (typeof window !== "undefined") {
      localStorage.removeItem("pib_offline_mode");
    }
    setIsOfflineMode(false);
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
    if (typeof window !== "undefined") {
      localStorage.removeItem("pib_offline_mode");
    }
    setIsOfflineMode(false);
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

  // 게스트(익명) 로그인: 이메일/비밀번호 없이 로컬 전용 임시 세션으로 시작
  const signInAsGuest = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("pib_offline_mode");
    }
    setIsOfflineMode(false);
    setAuthBusy(true);
    try {
      const cred = await signInAnonymously(auth);
      await ensureUserDoc(cred.user);
    } finally {
      setAuthBusy(false);
    }
  };

  // 게스트 계정 -> Google 계정 연동 (데이터 유지)
  const linkAccountWithGoogle = async () => {
    if (!user) throw new Error("게스트 상태가 아니에요");
    if (isNativePlatform()) {
      const idToken = await nativeGoogleIdToken();
      const credential = GoogleAuthProvider.credential(idToken);
      const res = await linkWithCredential(user, credential);
      await ensureUserDoc(res.user);
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const res = await linkWithPopup(user, provider);
    await ensureUserDoc(res.user);
  };

  // 게스트 계정 -> Apple 계정 연동 (데이터 유지)
  const linkAccountWithApple = async () => {
    if (!user) throw new Error("게스트 상태가 아니에요");
    if (isNativePlatform()) {
      const { idToken, rawNonce } = await nativeAppleIdToken();
      const provider = new OAuthProvider("apple.com");
      const credential = provider.credential({ idToken, rawNonce });
      const res = await linkWithCredential(user, credential);
      await ensureUserDoc(res.user);
      return;
    }
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    const res = await linkWithPopup(user, provider);
    await ensureUserDoc(res.user);
  };

  // 게스트 계정 -> 이메일/비밀번호 연동 (데이터 유지)
  const linkAccountWithEmail = async (email: string, password: string): Promise<boolean> => {
    if (!user) throw new Error("게스트 상태가 아니에요");
    const credential = EmailAuthProvider.credential(email, password);
    const res = await linkWithCredential(user, credential);
    await setDoc(
      doc(db, "users", res.user.uid),
      { email, updatedAt: serverTimestamp() },
      { merge: true }
    );
    let sent = true;
    try {
      await sendVerificationEmailWithFallback(res.user);
    } catch (err) {
      console.error("[팩인백] 연동 후 인증 메일 발송 실패(Resend/Firebase 둘 다):", err);
      sent = false;
    }
    return sent;
  };

  // 구글/게스트로 가입한 사람이 처음 한 번 닉네임/아바타를 고르면 호출됨
  const completeProfile = async (nickname: string, avatarId: string) => {
    if (!user) return;
    // 닉네임/아바타가 둘 다 비어있던 경우만 "진짜 처음"이다 - 기존 유저가 프로필을
    // 다시 수정하는 경로(설정 화면)는 updateNickname/updateAvatar를 따로 쓰기 때문에
    // 여기로는 안 들어오지만, 혹시 몰라 한 번 더 방어적으로 확인한다.
    const isFirstTime = !profile?.nickname && !profile?.avatarId;
    if (isFirstTime) {
      try {
        // 추가 방어: 닉네임/아바타가 비어있어도 이미 실제로 쓰던 가방이 있으면(예: users/{uid}
        // 문서의 nickname/avatarId 필드만 어떤 이유로 유실된 경우) 샘플 데이터를 새로 심지
        // 않는다. 이 체크가 없으면 기존 가방/팩 위에 온보딩 샘플이 겹쳐서 보이는 사고가 난다.
        const existingBags = await getUserBagsOnce(user.uid);
        if (existingBags.length === 0) {
          await seedSampleDataForNewUser(user, { nickname, avatarId });
        } else {
          console.warn(
            "[팩인백] 닉네임/아바타는 비어있지만 기존 가방이 있어 샘플 데이터 생성을 건너뜁니다:",
            user.uid
          );
        }
      } catch (err) {
        console.error("[팩인백] 샘플 데이터 생성 실패:", err);
      }
    }
    await writeUser({ nickname, avatarId });
  };

  const updateNickname = async (nickname: string) => {
    if (!user) return;
    await writeUser({ nickname });
  };

  const updateAvatar = async (avatarId: string) => {
    if (!user) return;
    await writeUser({ avatarId });
  };

  // 화면 모드/강조 색상을 계정에 저장 (기기 간 동기화용). 슬라이더/피커 조작 시
  // 연쇄 쓰기를 방지하기 위해 로컬에 먼저 즉시 반영하고 서버 저장은 400ms 디바운스한다.
  const updateThemePrefs = async (prefs: {
    themeMode?: UserProfile["themeMode"];
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
    bagCardFontScale?: number;
    packCardScale?: number;
    packLibraryCardScale?: number;
    packCardFontScale?: number;
    fontFamily?: UserProfile["fontFamily"];
  }) => {
    if (!user) return;
    setRawProfile((prev) => (prev ? { ...prev, ...prefs } : prev));
    if (isOfflineMode) {
      saveLocalProfile(prefs);
      return;
    }
    if (themeDebounceTimerRef.current) clearTimeout(themeDebounceTimerRef.current);
    themeDebounceTimerRef.current = setTimeout(() => {
      writeUser(prefs).catch((err) => {
        console.error("[팩인백] 테마 설정 저장 실패:", err);
      });
    }, 400);
  };

  // 글자 크기 설정 (계정에 저장해서 기기 간 동기화)
  const updateFontScale = async (fontScale: "sm" | "md" | "lg") => {
    if (!user) return;
    setRawProfile((prev) => (prev ? { ...prev, fontScale } : prev));
    if (isOfflineMode) {
      saveLocalProfile({ fontScale });
      return;
    }
    await writeUser({ fontScale });
  };

  // 앱 실행 시 처음 보여줄 탭
  const updateDefaultTab = async (defaultTab: "home" | "settings" | "packs") => {
    if (!user) return;
    setRawProfile((prev) => (prev ? { ...prev, defaultTab } : prev));
    if (isOfflineMode) {
      saveLocalProfile({ defaultTab });
      return;
    }
    await writeUser({ defaultTab });
  };

  // 앱 실행 시 처음 보여줄 시작페이지 설정 (디바이스별 독립 로컬 스토리지 저장)
  const updateStartPage = async (startPage: StartPageConfig) => {
    setDeviceStartPage(startPage);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCAL_DEVICE_START_PAGE_KEY, JSON.stringify(startPage));
      } catch (err) {
        console.error("[AuthProvider] 로컬 스토리지 시작페이지 저장 실패:", err);
      }
    }
  };

  const updateBagSortBy = async (sortBy: UserProfile["bagSortBy"]) => {
    if (!user) return;
    await writeUser({ bagSortBy: sortBy });
  };

  const updateBagCardSize = async (size: UserProfile["bagCardSize"]) => {
    if (!user) return;
    await writeUser({ bagCardSize: size });
  };

  const updatePackSortBy = async (sortBy: UserProfile["packSortBy"]) => {
    if (!user) return;
    await writeUser({ packSortBy: sortBy });
  };

  // 고정핀 토글(최대 5개). 이미 고정된 걸 다시 누르면 해제되고, 다 찬 상태에서
  // 새로 고정하려 하면 togglePinned이 조용히 무시한다.
  // 보관한 가방은 고정 칸을 차지하지 않는다(2026-10-14): 예전에 고정한 채로 보관해 남아 있던 id는 이때 같이 뺀다
  const toggleBagPinned = async (bagId: string) => {
    if (!user) return;
    const archived = new Set(profile?.archivedBagIds ?? []);
    const current = (profile?.pinnedBagIds ?? []).filter((id) => !archived.has(id));
    // v2 홈은 고정 가방을 따로 보여주므로 5개까지(구 UI는 그대로 3개)
    const next = togglePinned(current, bagId, V2_MAX_PINNED_BAGS);
    await writeUser({ pinnedBagIds: next });
  };

  // 보관하면 고정을 같이 푼다(2026-10-14). 고정된 채 보관되면 홈에는 안 보이는데 고정 칸만 차지했다
  const unpinnedFor = (bagIds: string[]): string[] | null => {
    const pinned = profile?.pinnedBagIds ?? [];
    const drop = new Set(bagIds);
    const next = pinned.filter((id) => !drop.has(id));
    return next.length === pinned.length ? null : next;
  };

  // 보관 토글 (개수 제한 없음 - togglePinned은 이름과 달리 그냥 "배열에 넣고 빼기" 범용
  // 유틸이라 재사용한다. max에 Infinity를 넘겨 제한을 없앤다).
  const toggleBagArchived = async (bagId: string) => {
    if (!user) return;
    const wasArchived = (profile?.archivedBagIds ?? []).includes(bagId);
    const next = togglePinned(profile?.archivedBagIds, bagId, Infinity);
    const pinned = wasArchived ? null : unpinnedFor([bagId]);
    await writeUser(pinned ? { archivedBagIds: next, pinnedBagIds: pinned } : { archivedBagIds: next });
  };

  // "지난 여행 보관함으로 옮길까요?" 배너에서 여러 개를 한 번에 보관 처리할 때 쓴다.
  // toggleBagArchived를 여러 번 연달아 부르면 각 호출이 같은(갱신되지 않은) profile
  // 스냅샷을 기준으로 next를 계산해서 마지막 호출 것만 반영되는 문제가 있어, 병합을
  // 한 번에 계산해서 한 번만 쓴다.
  const archiveBags = async (bagIds: string[]) => {
    if (!user || bagIds.length === 0) return;
    const current = profile?.archivedBagIds ?? [];
    const next = Array.from(new Set([...current, ...bagIds]));
    const pinned = unpinnedFor(bagIds);
    await writeUser(pinned ? { archivedBagIds: next, pinnedBagIds: pinned } : { archivedBagIds: next });
  };

  // 보관 제안 배너를 "닫기"로 넘긴 가방들은 다음에 다시 물어보지 않는다.
  const dismissArchiveSuggestions = async (bagIds: string[]) => {
    if (!user || bagIds.length === 0) return;
    const current = profile?.archiveSuggestionDismissedIds ?? [];
    const next = Array.from(new Set([...current, ...bagIds]));
    await writeUser({ archiveSuggestionDismissedIds: next });
  };

  // v69: 팩은 고정핀 개수 제한이 폐지되어 무제한이다(togglePinned에 max 생략 시 기본 2개 제한이라 Infinity를 명시적으로 넘겨야 함).
  const togglePackPinned = async (packId: string) => {
    if (!user) return;
    const next = togglePinned(profile?.pinnedPackIds, packId, Infinity);
    await writeUser({ pinnedPackIds: next });
  };

  // 항목을 길게 눌러 끌어다 순서를 바꾸는 순간 호출된다. 지정한 순서(order)와 정렬기준을
  // "custom"으로 함께 저장해야 다음에 다시 봐도 같은 순서가 유지된다.
  const updateBagOrder = async (order: string[]) => {
    if (!user) return;
    await writeUser({ bagOrder: order, bagSortBy: "custom" });
  };

  const updatePackOrder = async (order: string[]) => {
    if (!user) return;
    await writeUser({ packOrder: order, packSortBy: "custom" });
  };

  // v69: 팩 트리(폴더)에서 드래그로 순서를 바꿈거나 다른 폴더로 옷긴 직후 호출된다.
  // parentKey는 폴더 id(최상위는 "root")고, order는 그 레벨의 형제 전체 id 순서다.
  const updatePackOrderByParent = async (parentKey: string, order: string[]) => {
    if (!user) return;
    const next = { ...(profile?.packOrderByParent ?? {}), [parentKey]: order };
    await writeUser({ packOrderByParent: next, packSortBy: "custom" });
  };

  // 팩 트리에서 펼쳐져있는 폴더 id 목록. 연속 탭 시의 Firestore 쓰기/읽기를 줄이기 위해
  // 로컬에 먼저 즉시 반영하고 서버 저장은 800ms 디바운스한다.
  const updateExpandedPackFolderIds = async (ids: string[]) => {
    if (!user) return;
    setRawProfile((prev) => (prev ? { ...prev, expandedPackFolderIds: ids } : prev));
    if (expandedPackFolderDebounceTimerRef.current) clearTimeout(expandedPackFolderDebounceTimerRef.current);
    expandedPackFolderDebounceTimerRef.current = setTimeout(() => {
      writeUser({ expandedPackFolderIds: ids }).catch((err) => {
        console.error("[팩인백] 팩 폴더 펼침 상태 저장 실패:", err);
      });
    }, 800);
  };

  // --- 가방보관함 폴더 (개인 메타데이터, 가방 문서 미수) -----------------------------
  const createBagFolder = async (name: string, parentId?: string): Promise<string> => {
    if (!user) return "";
    const id = `bagfolder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next = {
      ...(profile?.bagFolders ?? {}),
      [id]: { id, name, parentId, createdAt: new Date().toISOString() },
    };
    await writeUser(stripUndefined({ bagFolders: next }));
    return id;
  };

  const renameBagFolder = async (folderId: string, name: string) => {
    if (!user) return;
    const current = profile?.bagFolders ?? {};
    if (!current[folderId]) return;
    const next = { ...current, [folderId]: { ...current[folderId], name } };
    await writeUser(stripUndefined({ bagFolders: next }));
  };

  // 폴더 삭제 - 가방 문서는 전혀 건드리지 않고, 그 안의 가방/하위폴더는 이 폴더의 상위
  // (없으면 최상위)로 한 단계씨 올라간다(아이폰 메모처럼).
  const deleteBagFolder = async (folderId: string) => {
    if (!user || !profile?.bagFolders?.[folderId]) return;
    await writeBagFolderPatch((folders, assignments) => {
      const target = folders[folderId];
      if (!target) return null;
      const newParentId = target.parentId;
      const updates: UserPatch = { [`bagFolders.${folderId}`]: REMOVE_FIELD };
      for (const [key, f] of Object.entries(folders)) {
        if (key === folderId) continue;
        if (f.parentId === folderId) {
          updates[`bagFolders.${key}.parentId`] = newParentId ? newParentId : REMOVE_FIELD;
        }
      }
      for (const [bagId, fId] of Object.entries(assignments)) {
        if (fId !== folderId) continue;
        updates[`bagFolderAssignments.${bagId}`] = newParentId ? newParentId : REMOVE_FIELD;
      }
      return updates;
    });
  };

  // 폴더 삭제·옮기기·평탄화는 점 경로(bagFolders.{id}.parentId 등)로 일부 필드만 쓴다. 이때 화면이 들고 있는 profile이
  // 예전 것이면(다른 기기에서 그 폴더를 지웠으면) 없는 폴더에 필드만 생겨 "이름 없는 폴더"가 되살아난다.
  // 그래서 계정 모드에서는 트랜잭션으로 서버 최신본을 읽고(읽기 1) 폴더가 있을 때만 쓴다. 간혹 쓰는 동작이라 비용은 무시할 만하다.
  // 오프라인 모드(이 기기 저장)나 연결이 끊겨 트랜잭션을 못 하면 화면의 profile 기준으로 예전처럼 쓴다.
  const writeBagFolderPatch = async (
    build: (folders: NonNullable<UserProfile["bagFolders"]>, assignments: Record<string, string>) => UserPatch | null
  ) => {
    if (!user) return;
    const fromProfile = () => build(profile?.bagFolders ?? {}, profile?.bagFolderAssignments ?? {});
    if (isOfflineMode) {
      const patch = fromProfile();
      if (patch) await writeUser(patch, true);
      return;
    }
    const ref = doc(db, "users", user.uid);
    try {
      await runTransaction(db, async (tx) => {
        const data = (await tx.get(ref)).data();
        const patch = build(
          (data?.bagFolders as UserProfile["bagFolders"]) ?? {},
          (data?.bagFolderAssignments as Record<string, string> | undefined) ?? {}
        );
        if (patch) tx.update(ref, toFirestorePatch(patch));
      });
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
      if (code !== "unavailable" && code !== "failed-precondition") throw err;
      const patch = fromProfile();
      if (patch) await writeUser(patch, true);
    }
  };

  // 폴더를 다른 폴더 안으로(또는 최상위로) 옮기기.
  const moveBagFolder = async (folderId: string, parentId: string | undefined) => {
    if (!user || !profile?.bagFolders?.[folderId]) return;
    await writeBagFolderPatch((folders) => {
      if (!folders[folderId] || (parentId && !folders[parentId])) return null;
      return { [`bagFolders.${folderId}.parentId`]: parentId ? parentId : REMOVE_FIELD };
    });
  };

  // 가방을 폴더로(또는 최상위로) 옮기기 - 가방 문서는 전혀 건드리지 않는다.
  const moveBagToFolder = async (bagId: string, folderId: string | undefined) => {
    if (!user) return;
    await writeUser({
      [`bagFolderAssignments.${bagId}`]: folderId ? folderId : REMOVE_FIELD,
    }, true);
  };

  // 다중선택해서 한꺼번에 여러 가방을 폴더로 옥길 때 쓰는 버전 - moveBagToFolder를 루프로 여러 번
  // 불러오면 각 호출이 같은(갱신안된) profile 스냵샷을 기준으로 계산해서 먹히는 문제가 있어,
  // 병합을 한 번에 계산해서 한 번만 쓴다.
  const moveBagsToFolder = async (bagIds: string[], folderId: string | undefined) => {
    if (!user || bagIds.length === 0) return;
    const updates: Record<string, unknown> = {};
    for (const bagId of bagIds) {
      updates[`bagFolderAssignments.${bagId}`] = folderId ? folderId : REMOVE_FIELD;
    }
    await writeUser(updates, true);
  };

  // 리디자인 v2: 가방 폴더는 1단계(홈 상단 칩)만 쓴다. 하위 폴더를 전부 최상위로 올리고,
  // 원래 부모는 legacyParentId에 남겨 둔다(롤백용). 폴더에 담긴 가방(bagFolderAssignments)은 그대로다.
  // 올리면서 같은 이름이 생기면("여행/Archive"와 "업무/Archive") "Archive (업무)"처럼 이름을 바꾸고 원래 이름은
  // legacyName에 남긴다(lib/bagFolderNames.ts). 이미 평평해진 뒤 남아 있던 겹침도 같이 정리한다.
  // 바꿀 게 없으면 아무것도 쓰지 않는다.
  const flattenBagFolders = async () => {
    if (!user || isOfflineMode) return;
    await writeBagFolderPatch((folders) => {
      const updates: UserPatch = {};
      for (const [key, f] of Object.entries(folders)) {
        if (!f.parentId) continue;
        updates[`bagFolders.${key}.parentId`] = REMOVE_FIELD;
        updates[`bagFolders.${key}.legacyParentId`] = f.parentId;
      }
      const renames = resolveFolderNameClashes(folders);
      for (const [key, name] of Object.entries(renames)) {
        updates[`bagFolders.${key}.name`] = name;
        if (!folders[key].legacyName) updates[`bagFolders.${key}.legacyName`] = folders[key].name;
      }
      return Object.keys(updates).length === 0 ? null : updates;
    });
  };

  const updateBagOrderByParent = async (parentKey: string, order: string[]) => {
    if (!user) return;
    const next = { ...(profile?.bagOrderByParent ?? {}), [parentKey]: order };
    await writeUser({ bagOrderByParent: next, bagSortBy: "custom" });
  };

  // 가방 폴더 펼침 상태 디바운스 저장
  const updateExpandedBagFolderIds = async (ids: string[]) => {
    if (!user) return;
    setRawProfile((prev) => (prev ? { ...prev, expandedBagFolderIds: ids } : prev));
    if (expandedBagFolderDebounceTimerRef.current) clearTimeout(expandedBagFolderDebounceTimerRef.current);
    expandedBagFolderDebounceTimerRef.current = setTimeout(() => {
      writeUser({ expandedBagFolderIds: ids }).catch((err) => {
        console.error("[팩인백] 가방 폴더 펼침 상태 저장 실패:", err);
      });
    }, 800);
  };

  // 가방 표시 설정은 부분 업데이트라서 기존 값과 merge해서 저장한다.
  const updateBagSettings = async (
    settings: Partial<NonNullable<UserProfile["bagSettings"]>>
  ) => {
    if (!user) return;
    const next = { ...(profile?.bagSettings ?? {}), ...settings };
    setRawProfile((prev) => (prev ? { ...prev, bagSettings: next } : prev));
    await writeUser({ bagSettings: next });
  };

  // 팩(아이템 목록) 표시 설정은 부분 업데이트라서 기존 값과 merge해서 저장한다.
  const updatePackSettings = async (
    settings: Partial<NonNullable<UserProfile["packSettings"]>>
  ) => {
    if (!user) return;
    const next = { ...(profile?.packSettings ?? {}), ...settings };
    setRawProfile((prev) => (prev ? { ...prev, packSettings: next } : prev));
    await writeUser({ packSettings: next });
  };

  // 하단 QuickPackBar를 접은 상태(오른쪽 끝 떠있는 작은 버블)로 보여줄지. 계정에 저장해서 어느
  // 화면(팩/가방)에서도 동일하게 적용된다.
  const updateQuickPackCollapsed = async (collapsed: boolean) => {
    if (!user) return;
    setRawProfile((prev) => (prev ? { ...prev, quickPackCollapsed: collapsed } : prev));
    if (isOfflineMode) {
      saveLocalProfile({ quickPackCollapsed: collapsed });
      return;
    }
    await writeUser({ quickPackCollapsed: collapsed });
  };

  // 리디자인 v2: 좁은 화면에서 가방 속 팩 열 수(1/2). 화면에 먼저 반영하고 계정에 저장한다.
  const updateBagPhoneColumns = async (columns: 1 | 2) => {
    if (!user) return;
    setRawProfile((prev) => (prev ? { ...prev, bagPhoneColumns: columns } : prev));
    if (isOfflineMode) {
      saveLocalProfile({ bagPhoneColumns: columns });
      return;
    }
    await writeUser({ bagPhoneColumns: columns });
  };

  // 데스크톱 사이드바 폭(px) - 오른쪽 가장자리 드래그가 끝난 지점에서만 호출되므로(드래그 중에는
  // 로컬 state만 바꾸다), 매번 쓰기가 일어나지 않아 다른 설정값들과 달리 디바운스가 필요하지 않다.
  const updateSidebarWidth = async (width: number) => {
    if (!user) return;
    setRawProfile((prev) => (prev ? { ...prev, sidebarWidth: width } : prev));
    if (isOfflineMode) {
      saveLocalProfile({ sidebarWidth: width });
      return;
    }
    await writeUser({ sidebarWidth: width });
  };

  const updateSidebarCollapsed = async (collapsed: boolean) => {
    if (!user) return;
    setRawProfile((prev) => (prev ? { ...prev, sidebarCollapsed: collapsed } : prev));
    if (isOfflineMode) {
      saveLocalProfile({ sidebarCollapsed: collapsed });
      return;
    }
    await writeUser({ sidebarCollapsed: collapsed });
  };

  // 설정 > AI 기능 하위 "짧은 URL 사용하기" 토글. 프리미엄 판정은 화면(SettingsScreen)에서 하고, 여기서는
  // 값만 그대로 저장한다(다른 설정값들과 동일한 패턴).
  const updateShortUrlEnabled = async (enabled: boolean) => {
    if (!user) return;
    await writeUser({ shortUrlEnabled: enabled });
  };

  // 설정 > AI 기능 하위 "지역 추천" 토글. 위와 동일한 패턴.
  const updateRegionRecommendEnabled = async (enabled: boolean) => {
    if (!user) return;
    await writeUser({ regionRecommendEnabled: enabled });
  };

  // 가방 속 팩 하나의 펼침/접힘/넓게보기 상태를 바꿔 저장한다. 그룹원과 동기화되는
  // 가방 문서가 아니라 계정(users/{uid})에만 쓰기 때문에, 같은 사용자가 다른 기기에서도
  // 그대로 보이고 다른 그룹원에게는 전혀 영향을 주지 않는다. 키는 `${bagId}:${packId}`.
  // 낙관적(optimistic) 로컬 반영: Firestore 왕복(onSnapshot)을 기다리지 않고 로컬 rawProfile을
  // 먼저 갱신하고, 서버 저장은 800ms 디바운스하여 연속 클릭 시의 Write/Read 낭비를 차단한다.
  const updatePackDisplayState = async (
    bagId: string,
    packId: string,
    state: "normal" | "wide" | "collapsed"
  ) => {
    if (!user) return;
    const next = { ...packDisplayStatesRef.current, [`${bagId}:${packId}`]: state };
    packDisplayStatesRef.current = next;
    setRawProfile((prev) => (prev ? { ...prev, packDisplayStates: next } : prev));
    if (packDisplayDebounceTimerRef.current) clearTimeout(packDisplayDebounceTimerRef.current);
    packDisplayDebounceTimerRef.current = setTimeout(() => {
      writeUser({ packDisplayStates: packDisplayStatesRef.current }).catch(
        (err) => {
          console.error("[팩인백] 팩 표시 상태 저장 실패:", err);
        }
      );
    }, 800);
  };

  // 상단 "전체확장/전체접기" 컨트롤용 - 같은 가방 안 모든 팩을 한번에 같은 상태로 바꾼다.
  const updateAllPackDisplayStates = async (
    bagId: string,
    packIds: string[],
    state: "normal" | "wide" | "collapsed"
  ) => {
    if (!user) return;
    const next = { ...packDisplayStatesRef.current };
    for (const packId of packIds) next[`${bagId}:${packId}`] = state;
    packDisplayStatesRef.current = next;
    setRawProfile((prev) => (prev ? { ...prev, packDisplayStates: next } : prev));
    if (packDisplayDebounceTimerRef.current) clearTimeout(packDisplayDebounceTimerRef.current);
    packDisplayDebounceTimerRef.current = setTimeout(() => {
      writeUser({ packDisplayStates: packDisplayStatesRef.current }).catch(
        (err) => {
          console.error("[팩인백] 전체 팩 표시 상태 저장 실패:", err);
        }
      );
    }, 800);
  };

  // 이 가방만의 보기 방식(팩뷰/심플뷰) 개별 오버라이드. 이것도 사용자별 설정이라
  // 같은 가방을 보는 다른 그룹원은 각자 원하는 보기 방식으로 자유롭게 볼 수 있다.
  const updateBagViewMode = async (bagId: string, mode: "pack" | "notebook") => {
    if (!user) return;
    const next = { ...(profile?.bagViewMode ?? {}), [bagId]: mode };
    await writeUser({ bagViewMode: next });
  };

  // 설정 > 가방설정에서 고르는 새 가방의 기본 보기 방식(전역 기본값).
  const updateDefaultBagViewMode = async (mode: "pack" | "notebook") => {
    if (!user) return;
    await writeUser({ defaultBagViewMode: mode });
  };

  // 개인 잠금(lib/v2/privateLock.ts). 통째로 쓴다(작은 객체). 화면에 먼저 반영한다
  const updatePrivateLock = async (next: PrivateLock | null) => {
    if (!user || isOfflineMode) return;
    setRawProfile((prev) => (prev ? { ...prev, privateLock: next ?? undefined } : prev));
    await writeUser({ privateLock: next ?? REMOVE_FIELD });
  };

  // 북마크 위젯 꾸미기(2026-10-18). 작은 배열이라 통째로 쓴다(저장 · 지우기 때만 쓰기 1). 화면에 먼저 반영한다
  // 계정 모드 전용(iOS 앱에서만 보이는 화면). 빈 배열이면 필드를 지운다
  const updateWidgetStyles = async (next: WidgetStyle[]) => {
    if (!user || isOfflineMode) return;
    const clean = next.map((s) => stripUndefined(s) as WidgetStyle);
    setRawProfile((prev) => (prev ? { ...prev, widgetStyles: clean } : prev));
    await writeUser({ widgetStyles: clean.length ? clean : REMOVE_FIELD });
  };

  const resendVerificationEmail = async () => {
    if (!user) return;
    try {
      await sendVerificationEmailWithFallback(user);
    } catch (err) {
      console.error("[팩인백] 인증 메일 재발송 실패(Resend/Firebase 둘 다):", err);
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
          await sendVerificationEmailWithFallback(cred.user);
        }
      } finally {
        await signOut(auth);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  // 비밀번호 재설정 메일도 Resend(브랜드 도메인)로 먼저 보낸다(2026-10-15, auth.md 확인 필요 7).
  // 서버가 못 보내면(sent:false · 연결 실패) Firebase 기본 발송으로 대신한다. 60초 안에 다시 누르면 "잠시 후"
  const sendPasswordReset = async (email: string) => {
    try {
      const res = await fetch(getApiUrl("/api/send-password-reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { sent?: boolean; code?: string };
      if (res.status === 429 && data.code === "COOLDOWN") throw new Error("잠시 후 다시 시도해주세요");
      if (data.sent) return;
    } catch (err) {
      if (err instanceof Error && err.message === "잠시 후 다시 시도해주세요") throw err;
      console.warn("[팩인백] Resend 재설정 메일 실패, Firebase로 대신:", err);
    }
    await sendPasswordResetEmail(auth, email);
  };

  // 비밀번호 변경은 보안상 최근 로그인이 필요해서, 현재 비밀번호로 재인증한 뒤 바꾼다.
  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user || !user.email || isOfflineMode) return;
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  };

  // 탈퇴처럼 되돌릴 수 없는 작업 전에 본인 확인(재인증). 데이터를 지우기 "전에" 해야 한다 - 예전에는
  // 데이터부터 지운 뒤 deleteUser가 requires-recent-login으로 막혀 계정만 남는 일이 있었다.
  // 이메일 계정: 지금 비밀번호로 확인. Google·Apple: 4분 안에 로그인했으면 건너뛰고, 아니면 로그인 창을 한 번 더 띄운다
  const reauthenticateForDelete = async (password?: string) => {
    if (!user) return;
    const providers = (user.providerData ?? []).map((p) => p.providerId);
    if (providers.includes("password") && user.email) {
      if (!password) throw new Error("auth/missing-password");
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      return;
    }
    const lastSignIn = Date.parse(user.metadata?.lastSignInTime ?? "");
    if (Number.isFinite(lastSignIn) && Date.now() - lastSignIn < 4 * 60 * 1000) return;
    if (providers.includes("google.com")) {
      if (isNativePlatform()) {
        const idToken = await nativeGoogleIdToken();
        await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
      } else {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await reauthenticateWithPopup(user, provider);
      }
      return;
    }
    if (providers.includes("apple.com")) {
      if (isNativePlatform()) {
        const { idToken, rawNonce } = await nativeAppleIdToken();
        await reauthenticateWithCredential(user, new OAuthProvider("apple.com").credential({ idToken, rawNonce }));
      } else {
        const provider = new OAuthProvider("apple.com");
        provider.addScope("email");
        await reauthenticateWithPopup(user, provider);
      }
    }
  };

  // signOut 후 IndexedDB 캐시를 지운다(best-effort) - 같은 기기를 다른 계정이 바로 이어서
  // 쓸 때 이전 계정의 캐시된 화면이 잠깐 보이는 걸 줄이기 위한 처리. 아직 리스너가 다 정리되기
  // 전이라 실패할 수 있는데, 실패해도 치명적이지 않다(다음 로그인 시 캐시가 새 값으로 덮어써짐).
  const logout = async () => {
    if (isOfflineMode) {
      exitOfflineMode();
      return;
    }
    // 게스트(익명 계정)는 다시 로그인할 길이 없어 끝낼 때 탈퇴처럼 모두 지운다(2026-10-15, auth.md 확인 필요 3).
    // 예전에는 가방 · 팩 · 첨부가 주인 없이 서버에 계속 남았다. 지우다 실패해도 로그아웃은 한다
    const current = auth.currentUser;
    if (current?.isAnonymous) {
      try {
        await deleteAllUserData(current.uid);
        await deleteAccountServerSide();
      } catch (err) {
        console.error("[팩인백] 게스트 데이터 정리 실패:", err);
      }
    }
    await signOut(auth).catch(() => {});
    try {
      await clearIndexedDbPersistence(db);
    } catch {
      // 무시
    }
  };

  const deleteAccount = async (password?: string) => {
    if (!user || isOfflineMode) return;
    // 본인 확인을 먼저 끝낸 뒤에만 데이터를 지운다(확인 실패 시 아무것도 안 지워짐).
    await reauthenticateForDelete(password);
    // Firestore/Storage 데이터를 먼저 정리하고, 마지막에 Auth 계정을 지운다.
    // (순서를 반대로 하면 로그인 정보가 먼저 사라져서 이후 Firestore 규칙상 접근이 막힘)
    // 중간에 실패하면(네트워크 등) 일부만 지워진 채 계정이 남는다. 다시 하면 남은 것만 지워지니 그렇게 안내한다(2026-10-17, auth.md 확인 필요 5)
    try {
      await deleteAllUserData(user.uid);
    } catch (err) {
      console.error("[팩인백] 탈퇴 데이터 정리 중 실패:", err);
      throw new Error(PARTIAL_DELETE_MESSAGE);
    }
    // 앱이 못 지우는 것(짧은 URL · 공유 링크 · 알림 · 기기 토큰 · 문의 · 사용 기록)과 로그인 계정을 서버가 지운다(2026-10-15, auth.md 확인 필요 2).
    // 서버가 계정까지 지웠으면 로그아웃만 하고 끝, 실패하면 예전처럼 앱에서 계정을 지운다
    if (await deleteAccountServerSide()) {
      await signOut(auth).catch(() => {});
      try {
        await clearIndexedDbPersistence(db);
      } catch {}
      return;
    }
    try {
      await deleteUser(user);
      try {
        await clearIndexedDbPersistence(db);
      } catch {
        // 무시 - logout()의 캐시 정리와 동일한 best-effort 처리
      }
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
      console.error("[팩인백] 탈퇴 계정 삭제 실패:", err);
      throw new Error(PARTIAL_DELETE_MESSAGE);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isGuest: isOfflineMode || !!user?.isAnonymous,
        isOfflineMode,
        startOfflineMode,
        exitOfflineMode,
        switchToOnlineMode,
        authBusy,
        profileUnconfirmed,
        retryProfileLoad,
        // 마스터 이메일 목록은 서버 전용(MASTER_EMAILS)이라 화면에서는 보지 않는다(2026-10-09). 서버 판정(master-status)·토큰·role·masters 문서로 충분하다
        // 오프라인 모드는 가짜 프로필이 role: master라 빼고 본다(2026-10-15, auth.md 확인 필요 6)
        isMaster:
          !isOfflineMode &&
          (isMasterApi ||
            isMasterToken ||
            profile?.role === "master" ||
            isMasterDoc),
        signInAsGuest,
        linkAccountWithGoogle,
        linkAccountWithApple,
        linkAccountWithEmail,
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
        updateStartPage,
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
        flattenBagFolders,
        moveBagToFolder,
        moveBagsToFolder,
        updateBagOrderByParent,
        updateExpandedBagFolderIds,
        updateBagSettings,
        updatePackSettings,
        updateQuickPackCollapsed,
        updateBagPhoneColumns,
        updateSidebarWidth,
        updateSidebarCollapsed,
        updateShortUrlEnabled,
        updateRegionRecommendEnabled,
        updatePackDisplayState,
        updateAllPackDisplayStates,
        updateBagViewMode,
        updateDefaultBagViewMode,
        updateBagReminder,
        updatePushPref,
        setBagPushMuted,
        setBagPushOff,
        updatePrivateLock,
        updateWidgetStyles,
        reauthenticate: reauthenticateForDelete,
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

// 탈퇴가 데이터를 지우는 도중 멈춘 경우(auth.md AUTH-DEL-05)
const PARTIAL_DELETE_MESSAGE = "일부만 지워졌어요. 다시 탈퇴하면 남은 것을 마저 지워요";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
