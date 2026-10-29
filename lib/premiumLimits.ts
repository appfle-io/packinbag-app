// 무료/프리미엄 기능 차등에 쓰이는 제한값과 "지금 이 사용자가 프리미엄인가?" 판별을
// 한 곳에 모아둔다.
//
// 지금(앱 배포 전) 단계에서는 "이용권 코드를 등록해서 아직 만료 안 된 사람"만 프리미엄으로
// 취급한다 - 이건 lib/aiUsageService.ts의 isUnlimitedAiUser와 완전히 같은 판정 기준이라
// 그 함수를 그대로 재사용한다(로직이 두 곳에서 따로 놀며 어긋나는 걸 방지).
//
// 나중에 앱스토어/플레이스토어에 인앱결제(1회성 구매)가 추가되면, 이 파일의
// isPremiumUser 안에 "구매 여부" 조건만 추가하면 된다 - 이 함수를 쓰는 모든 화면
// (팩 보관함 개수 제한, 동시 진행 가방 개수 제한, 커스텀 색상 등)이 자동으로
// 같은 기준을 따르게 된다.
//
// 주의: 개수 제한 자체(새로 만들 때 막는 것)는 app/api/create-bag, app/api/create-library-pack이
// 서버에서 검증한다. 반면 "이미 만들어둔 것 중 초과분을 잠그는" computeLockedBagIds/
// computeLockedPackIds는 화면에 즉시 반영하기 위한 클라이언트용 계산이고, 실제 서버 강제는
// app/api/sync-lock-status가 Bag.locked/Pack.locked 필드에 기록하고 firestore.rules/
// storage.rules가 그 필드를 검사하는 쪽에서 이뤄진다.

import { isUnlimitedAiUser } from "@/lib/aiUsageService";
import { Bag, Pack, UserProfile } from "@/lib/types";
import { OFFLINE_USER_UID } from "@/lib/localBagsService";
import { auth } from "@/lib/firebase";
import { FREE_LAUNCH } from "@/lib/freeLaunch";
import { isDemoMode } from "@/lib/demoMode";

// 서버(API route)가 무료 제한(팩/가방 개수)에 걸려 403으로 막았을 때 던지는 에러.
// 일반 에러와 구분해서 catch하면, 실패 토스트 대신 PremiumLimitModal을 띄울 수 있다.
export class PremiumLimitError extends Error {}

export function isOfflineEnvironment(): boolean {
  if (typeof window === "undefined") return false;

  // 0. 체험 모드는 로그인 세션이 있어도 항상 이 탭 저장(서버 쓰기 없음, OFF-DEMO-03 · 2026-10-18)
  if (isDemoMode()) return true;

  // 1. 실제 Firebase 온라인 계정으로 로그인되어 있는 경우 어떤 플랫폼이든 무조건 원격 Firestore 파이프라인 사용
  if (auth.currentUser && auth.currentUser.uid !== OFFLINE_USER_UID) {
    return false;
  }

  // 2. 오프라인 로컬 사용자 UID인 경우
  if (auth.currentUser?.uid === OFFLINE_USER_UID) {
    return true;
  }

  // 3. 데스크톱 포터블(Electron) 환경 확인
  const isElectron =
    Boolean((window as unknown as { electronAPI?: unknown }).electronAPI) ||
    navigator.userAgent.toLowerCase().includes("electron");

  // 4. 명시적 오프라인 모드 표시 또는 URL 파라미터 검사.
  // 로그인 세션이 없는데 표시가 있으면 인터넷이 돼도 오프라인 모드다(2026-10-15, offline.md 확인 필요 11).
  // 예전에는 웹에서 navigator.onLine이면 "예전 표시"로 보고 지웠는데, 로그인 화면에서 오프라인 모드로 시작한 뒤 인터넷이 돌아오면
  // 가방 자동저장이 Firestore로 가려다 실패하고 다음 실행 때 오프라인 모드가 풀렸다. 표시는 AuthProvider만 지운다(세션이 생기면 지움)
  if (
    localStorage.getItem("pib_offline_mode") === "true" ||
    new URLSearchParams(window.location.search).get("offline") === "true"
  ) {
    return true;
  }

  // 5. 데스크톱 포터블(Electron) 환경에서 비로그인 상태이면서 네트워크가 단절된 경우
  if (isElectron && typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }

  return false;
}

export function isPremiumUser(
  email: string | null | undefined,
  profile: UserProfile | null
): boolean {
  // 출시 기념 전원 무료(lib/freeLaunch.ts)
  if (FREE_LAUNCH) return true;
  // 오프라인 모드에서는 모든 기능 무제한
  if (isOfflineEnvironment()) return true;
  if (profile?.uid === "local-offline-user" || email === "offline@local") return true;
  if (profile?.role === "master") return true;
  // 인앱결제(RevenueCat 웹훅이 기록한 영구구매)로 프리미엄이면 이용권 코드와 무관하게
  // 언제나 프리미엄이다(lib/types.ts UserProfile.premiumPurchase 주석 참고).
  if (profile?.premiumPurchase?.purchased) return true;
  return isUnlimitedAiUser(email, profile);
}

// 무료 사용자가 동시에 가질 수 있는 내가 만든 가방(소유 가방) 최대 개수 (프리미엄은 무제한)
export const FREE_MAX_ACTIVE_BAGS = 3;

// 무료 사용자가 동시에 참여할 수 있는 초대받은 가방(참여 가방) 최대 개수 (프리미엄은 무제한)
export const FREE_MAX_JOINED_BAGS = 3;

// 가방 하나를 함께 쓸 수 있는 최대 인원(만든 사람 포함). 기준은 "참여하는 사람"이 아니라 "가방을 만든 사람(ownerId)"의
// 프리미엄 여부다. 무료 가방은 나+1명, 프리미엄 가방은 10명. 이미 인원을 넘긴 가방은 멤버를 그대로 두고 새 참여만 막는다
// (app/api/join-bag).
export const FREE_MAX_BAG_MEMBERS = 2;
export const MAX_BAG_MEMBERS = 10;

export function bagMemberLimit(ownerPremium: boolean): number {
  return ownerPremium ? MAX_BAG_MEMBERS : FREE_MAX_BAG_MEMBERS;
}

// 가방 하나에 넣을 수 있는 팩 개수(체크 팩 + 메모 + 미분류 + AI 추천 팩 모두). 2026-10-20 전에는 모두 10개.
// 기준은 "지금 팩을 넣는 사람"의 프리미엄 여부(가방 화면 · 단축어). 이미 더 많이 든 가방은 그대로 두고 새로 만드는 것만 막는다
export const FREE_MAX_PACKS_PER_BAG = 5;
const MAX_PACKS_PER_BAG = 30;

export function bagPackLimit(premium: boolean): number {
  return premium ? MAX_PACKS_PER_BAG : FREE_MAX_PACKS_PER_BAG;
}

/** 가방 팩이 가득 찼을 때 안내(무료면 프리미엄 개수도) */
export function bagPackLimitMessage(premium: boolean): string {
  return premium
    ? `가방 하나에는 팩을 최대 ${MAX_PACKS_PER_BAG}개까지 넣을 수 있어요`
    : `무료는 가방 하나에 팩을 ${FREE_MAX_PACKS_PER_BAG}개까지 넣을 수 있어요. 프리미엄은 ${MAX_PACKS_PER_BAG}개까지예요`;
}

// 무료 사용자가 팩 보관함에 보관할 수 있는 팩 & 폴더 총합 최대 개수 (프리미엄은 무제한)
// (하단 "+" 빠른입력 시스템 팩은 이 카운트에서 제외되어 항상 무료 생성/저장 허용)
export const FREE_MAX_LIBRARY_PACKS = 10;

// 첨부 제한 문구. 2026-10-21: 무료는 가방 · 메모 사진 · 파일 첨부를 못 한다(예전 1장, 10/14). 남이 올린 것은 보기만 되고 저장 · 파일 열기는 안 된다
// (화면에서만 막는다 — Storage 내려받기 주소는 규칙을 거치지 않아서. 업로드는 storage.rules가 다시 막는다)
export const ATTACH_PREMIUM_MESSAGE = "사진 · 파일 첨부는 프리미엄 기능이에요.";
export const MEDIA_SAVE_PREMIUM_MESSAGE = "사진 저장 · 파일 열기는 프리미엄 기능이에요. 사진은 여기서 볼 수 있어요.";
export const OFFLINE_IMPORT_PREMIUM_MESSAGE =
  "이 기기에 있는 가방 · 팩을 계정으로 옮기는 건 프리미엄 기능이에요. 데이터는 이 기기에 그대로 있어요.";
export const BACKUP_IMPORT_PREMIUM_MESSAGE = "백업 파일을 계정으로 불러오는 건 프리미엄 기능이에요.";
export const PORTABLE_ACCOUNT_PREMIUM_MESSAGE =
  "PC 포터블에서 계정으로 쓰는 건 프리미엄 기능이에요. 이용권 코드를 넣거나, 로그아웃하고 오프라인 모드로 쓸 수 있어요.";

// 가방당 전체 사진 첨부 최대 장수 - 무료/유료 공통 상한 (멤버 혼재 정책 충돌 방지용)
export const MAX_BAG_IMAGES = 5;

// 휴지통(설정 > 휴지통)에 넣은 가방/팩을 며칠간 보관할지. 이 기간이 지나면 클라이언트가
// 다음에 열릴 때(로그인한 앱 세션에서) 자동으로 영구삭제한다 - 별도 서버 배치/크론 없이,
// 삭제 권한을 가진 그 계정의 클라이언트가 다음에 접속했을 때 조용히 정리하는 방식이다.
// (참고: firestore.rules상 가방은 소유자, 팩은 본인만 삭제 권한이 있어서, 정리도 항상
// 그 소유자/본인의 클라이언트에서만 실제로 수행된다.)
export const TRASH_RETENTION_DAYS = 30;

// trashedAt/trashedByOwnerAt(ISO 문자열)이 보관기간을 넘겼는지 확인한다.
export function isTrashExpired(trashedAtIso: string | undefined | null): boolean {
  if (!trashedAtIso) return false;
  const trashedAt = new Date(trashedAtIso).getTime();
  if (Number.isNaN(trashedAt)) return false;
  const purgeAt = trashedAt + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() >= purgeAt;
}

// 휴지통 화면에 "N일 후 자동삭제" 배지를 보여주기 위한 남은 일수 (최소 0).
export function daysUntilPurge(trashedAtIso: string | undefined | null): number {
  if (!trashedAtIso) return TRASH_RETENTION_DAYS;
  const trashedAt = new Date(trashedAtIso).getTime();
  if (Number.isNaN(trashedAt)) return TRASH_RETENTION_DAYS;
  const purgeAt = trashedAt + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

// 하단 "+"(빠른입력) 버튼으로 만들어지는 시스템 팩("빠른팩")의 고정 문서 id.
// 사용자당 항상 이 id 하나만 존재하고(Pack.isQuickPack도 함께 true로 저장),
// 무료 라이브러리 개수 제한/잠금 대상에서 항상 제외된다.
export const QUICK_PACK_ID = "quick-pack";

// createdAt(ISO 문자열) 기준 내림순(최신을 앞으로) 정렬. ISO 8601 문자열은 문자열
// 대소 비교(localeCompare)만으로도 실제 시간 순서와 일치한다. createdAt이 없는
// 항목(드물지만 방어적으로)은 맨 뒤로 밀려서 잠금 대상이 되기 쉽게 둔다.
function sortByCreatedAtDesc<T extends { createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/**
 * 무료 회원이 슬롯 한도를 초과했을 때 잠금(읽기 전용) 처리할 가방 ID 목록을 계산한다.
 * 내가 소유한 가방(ownerId === currentUid)만: 최신 3개 제외 나머지 잠금 (휴지통에 들어간 가방은 제외)
 * 참여 가방이 3개를 넘으면 잠그지 않고 서버(sync-lock-status)가 오래된 것부터 나간다(2026-10-15, premium.md 확인 필요 2).
 * 예전에는 화면에서만 잠가 다른 화면 · 오래된 앱에서는 고쳐졌다
 */
export function computeLockedBagIds(bags: Bag[], currentUid: string): Set<string> {
  const owned = sortByCreatedAtDesc(
    bags.filter((b) => !b.trashedByOwnerAt && b.ownerId === currentUid)
  );
  return new Set(owned.slice(FREE_MAX_ACTIVE_BAGS).map((b) => b.id));
}

/** 무료 회원의 참여 가방(남이 만든 것, 휴지통 제외)이 한도를 넘는지 */
export function countJoinedBags(bags: Bag[], currentUid: string): number {
  return bags.filter((b) => !b.trashedByOwnerAt && b.ownerId !== currentUid && b.memberIds.includes(currentUid)).length;
}

/**
 * 무료 회원이 팩/폴더 보관함 한도(10개)를 초과했을 때 잠금(읽기 전용) 처리할 팩/폴더 ID 목록을 계산한다.
 * (빠른팩 및 휴지통에 있는 항목은 계산에서 제외)
 */
export function computeLockedPackIds(libraryPacks: Pack[]): Set<string> {
  const active = sortByCreatedAtDesc(
    // 빠른팩은 문서 id로만(서버 lib/bagLockSync.ts syncLibraryPackLocks와 같은 기준, 2026-10-09)
    libraryPacks.filter((p) => !p.trashedAt && p.id !== QUICK_PACK_ID)
  );
  return new Set(active.slice(FREE_MAX_LIBRARY_PACKS).map((p) => p.id));
}

// AI 추천이 만든 전용 팩(Pack.aiRecommendSource, 보통 이름은 "AI추천")은 무료회원 화면에서는
// 안 보이게 걸러준다 - 같은 가방을 같이 쓰는 다른 멤버가 무료회원이어도 프리미엄 회원의 AI 추천
// 결과물을 그대로 얻어가면 안 되기 때문. premium이면 그대로 전부 반환한다(만든 사람 포함 프리미엄
// 회원에게는 항상 보인다). 가방/팩 화면(BagEditorScreen, BagCard, DesktopSidebar 등)에서 bag.packs를
// 그릴 때는 항상 이 함수를 거친 결과를 써야 한다 - 저장/수정 로직(updatePacks 등)은 원본 bag.packs를
// 그대로 써야 하므로 이 함수와 섞으면 안 된다(이건 순수하게 "화면에 보여줄 목록"만 계산한다).
// 날씨 · 명소 추천(2026-10-20)의 "날씨 추천" · "가볼 곳" 팩도 이 플래그로 같이 숨는다(aiRecommendKind로 구분)
export function getViewablePacks<T extends Pack>(packs: T[], premium: boolean): T[] {
  return premium ? packs : packs.filter((p) => !p.aiRecommendSource);
}
