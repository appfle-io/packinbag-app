// 무료/프리미엄 기능 차등에 쓰이는 제한값과 "지금 이 사용자가 프리미엄인가?" 판별을
// 한 곳에 모아둔다.
//
// 지금(앱 배포 전) 단계에서는 "이용권 코드를 등록해서 아직 만료 안 된 사람"만 프리미엄으로
// 취급한다 - 이건 lib/aiUsageService.ts의 isUnlimitedAiUser와 완전히 같은 판정 기준이라
// 그 함수를 그대로 재사용한다(로직이 두 곳에서 따로 놀며 어긋나는 걸 방지).
//
// 나중에 앱스토어/플레이스토어에 인앱결제(1회성 구매)가 추가되면, 이 파일의
// isPremiumUser 안에 "구매 여부" 조건만 추가하면 된다 - 이 함수를 쓰는 모든 화면
// (팩 라이브러리 개수 제한, 동시 진행 가방 개수 제한, 커스텀 색상 등)이 자동으로
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

// 무료 사용자가 만들 수 있는 팩 라이브러리 최대 개수 (프리미엄은 무제한)
export const FREE_MAX_LIBRARY_PACKS = 3;

// 무료 사용자가 동시에 가질 수 있는(진행 중인) 가방 최대 개수 (프리미엄은 무제한)
export const FREE_MAX_ACTIVE_BAGS = 3;

// 가방당 사진 첨부 최대 장수 - 무료/유료 공통 제한 (멤버 혼재 정책 충돌 방지용)
export const MAX_BAG_IMAGES = 5;

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
// createdAt 내림순(최신순)으로 정렬해서 상위 N개만 잠금 해제, 나머지는 잠금 대상.
export function computeLockedBagIds(bags: Bag[], ownerUid: string): Set<string> {
  const owned = sortByCreatedAtDesc(bags.filter((b) => b.ownerId === ownerUid));
  return new Set(owned.slice(FREE_MAX_ACTIVE_BAGS).map((b) => b.id));
}

// 무료인데 라이브러리 개수 제한(FREE_MAX_LIBRARY_PACKS)을 넘는 팩을 갖고 있을 때,
// 최신 N개만 잠금 해제하고 나머지를 잠금 대상으로 계산한다. 팩 라이브러리
// (users/{uid}/libraryPacks)는 원래부터 개인 전용 공간이라 소유자 구분이 필요 없다.
export function computeLockedPackIds(packs: Pack[]): Set<string> {
  const sorted = sortByCreatedAtDesc(packs);
  return new Set(sorted.slice(FREE_MAX_LIBRARY_PACKS).map((p) => p.id));
}
