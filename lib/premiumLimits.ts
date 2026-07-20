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
  return isUnlimitedAiUser(email, profile);
}

// 무료 사용자가 동시에 가질 수 있는(진행 중인) 가방 최대 개수 (프리미엄은 무제한)
export const FREE_MAX_ACTIVE_BAGS = 3;

// 가방당 사진 첨부 최대 장수 - 무료/유료 공통 제한 (멤버 혼재 정책 충돌 방지용)
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

// 무료인데 동시 진행 개수 제한(FREE_MAX_ACTIVE_BAGS)을 넘는 가방을 갖고 있을 때, 그 중
// 몇 개를 "잠금"으로 표시할지 계산한다. 대상은 내(ownerUid)가 직접 소유(ownerId)한
// 가방만 - 다른 사람이 만들어서 나를 초대한 공유 가방은 이 제한과 무관하므로 대상에서
// 제외된다(소유자 화면에서만 잠기고 다른 그룹원은 그대로 쓰는 것과 동일한 원칙).
// 휴지통으로 보낸(trashedByOwnerAt) 가방은 이미 목록에서 숨겨져 있어 잠금 계산 자체에서
// 제외한다 - 안 그러면 휴지통에 있는 가방이 "슬롯"을 차지해서 정상 가방이 잘못 잠기게 된다.
// createdAt 내림순(최신순)으로 정렬해서 상위 N개만 잠금 해제, 나머지는 잠금 대상.
export function computeLockedBagIds(bags: Bag[], ownerUid: string): Set<string> {
  const owned = sortByCreatedAtDesc(
    bags.filter((b) => b.ownerId === ownerUid && !b.trashedByOwnerAt)
  );
  return new Set(owned.slice(FREE_MAX_ACTIVE_BAGS).map((b) => b.id));
}

// v68: 팩 보관함 개수 제한은 폐지됨(폴더 기능 도입과 함께 무제한으로 변경).
// 가방 동시 진행 개수 제한(FREE_MAX_ACTIVE_BAGS)은 기존 정책 그대로 유지된다.
