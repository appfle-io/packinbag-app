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

// 서버(API route)가 무료 제한(팩/가방 개수)에 걸려 403으로 막았을 때 던지는 에러.
// 일반 에러와 구분해서 catch하면, 실패 토스트 대신 PremiumLimitModal을 띄울 수 있다.
export class PremiumLimitError extends Error {}

export function isPremiumUser(
  email: string | null | undefined,
  profile: UserProfile | null
): boolean {
  if (profile?.role === "master") return true;
  // 인앱결제(RevenueCat 웹훅이 기록한 영구구매)로 프리미엄이면 이용권 코드와 무관하게
  // 언제나 프리미엄이다(lib/types.ts UserProfile.premiumPurchase 주석 참고).
  if (profile?.premiumPurchase?.purchased) return true;
  return isUnlimitedAiUser(email, profile);
}

// 설정 > AI 기능 하위 "지역 추천" 토글 + 프리미엄 여부를 함께 판정한다. 둘 다 충족해야만
// 가방 제목을 바꿀 때 지역명을 인식해 날씨/맛집/관광지를 추천해준다(BagEditorScreen).
export function isRegionRecommendFeatureEnabled(
  email: string | null | undefined,
  profile: UserProfile | null
): boolean {
  return isPremiumUser(email, profile) && !!profile?.regionRecommendEnabled;
}

// 무료 사용자가 동시에 가질 수 있는 내가 만든 가방(소유 가방) 최대 개수 (프리미엄은 무제한)
export const FREE_MAX_ACTIVE_BAGS = 3;

// 무료 사용자가 동시에 참여할 수 있는 초대받은 가방(참여 가방) 최대 개수 (프리미엄은 무제한)
export const FREE_MAX_JOINED_BAGS = 3;

// 무료 사용자가 팩 보관함에 보관할 수 있는 팩 & 폴더 총합 최대 개수 (프리미엄은 무제한)
// (하단 "+" 빠른입력 시스템 팩은 이 카운트에서 제외되어 항상 무료 생성/저장 허용)
export const FREE_MAX_LIBRARY_PACKS = 10;

// 무료 사용자가 가방 1개에 직접 업로드할 수 있는 대표 사진 최대 장수
// (친구가 올린 사진은 제외하고 본인 업로드 기준 1장)
export const FREE_MAX_USER_BAG_IMAGES = 1;

// 가방당 전체 사진 첨부 최대 장수 - 무료/유료 공통 상한 (멤버 혼재 정책 충돌 방지용)
export const MAX_BAG_IMAGES = 5;

// 메모(에디터) 팩당 사진/PDF 첨부 최대 개수 - 프리미엄 전용 (무료는 첨부 불가)
export const MAX_PACK_IMAGES = 3;

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
 * 1. 내가 소유한 가방(ownerId === currentUid): 최신 3개 제외 나머지 잠금
 * 2. 내가 참여한 가방(memberIds 포함 & ownerId !== currentUid): 최신 3개 제외 나머지 내 화면에서 잠금
 * (휴지통에 들어간 가방은 제외)
 */
export function computeLockedBagIds(bags: Bag[], currentUid: string): Set<string> {
  const activeBags = bags.filter((b) => !b.trashedByOwnerAt);

  // 1. 내가 만든 소유 가방
  const owned = sortByCreatedAtDesc(
    activeBags.filter((b) => b.ownerId === currentUid)
  );
  const lockedOwned = owned.slice(FREE_MAX_ACTIVE_BAGS).map((b) => b.id);

  // 2. 친구에게 초대받은 참여 가방
  const joined = sortByCreatedAtDesc(
    activeBags.filter((b) => b.ownerId !== currentUid && b.memberIds.includes(currentUid))
  );
  const lockedJoined = joined.slice(FREE_MAX_JOINED_BAGS).map((b) => b.id);

  return new Set([...lockedOwned, ...lockedJoined]);
}

/**
 * 무료 회원이 팩/폴더 보관함 한도(10개)를 초과했을 때 잠금(읽기 전용) 처리할 팩/폴더 ID 목록을 계산한다.
 * (빠른팩 및 휴지통에 있는 항목은 계산에서 제외)
 */
export function computeLockedPackIds(libraryPacks: Pack[]): Set<string> {
  const active = sortByCreatedAtDesc(
    libraryPacks.filter((p) => !p.trashedAt && p.id !== QUICK_PACK_ID && !p.isQuickPack)
  );
  return new Set(active.slice(FREE_MAX_LIBRARY_PACKS).map((p) => p.id));
}

// AI 추천이 만든 전용 팩(Pack.aiRecommendSource, 보통 이름은 "AI추천")은 무료회원 화면에서는
// 안 보이게 걸러준다 - 같은 가방을 같이 쓰는 다른 멤버가 무료회원이어도 프리미엄 회원의 AI 추천
// 결과물을 그대로 얻어가면 안 되기 때문. premium이면 그대로 전부 반환한다(만든 사람 포함 프리미엄
// 회원에게는 항상 보인다). 가방/팩 화면(BagEditorScreen, BagCard, DesktopSidebar 등)에서 bag.packs를
// 그릴 때는 항상 이 함수를 거친 결과를 써야 한다 - 저장/수정 로직(updatePacks 등)은 원본 bag.packs를
// 그대로 써야 하므로 이 함수와 섞으면 안 된다(이건 순수하게 "화면에 보여줄 목록"만 계산한다).
export function getViewablePacks<T extends Pack>(packs: T[], premium: boolean): T[] {
  return premium ? packs : packs.filter((p) => !p.aiRecommendSource);
}
