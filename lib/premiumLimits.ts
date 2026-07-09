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
// 주의: 여기 있는 판정은 전부 "클라이언트 UI용"이다. 팩 라이브러리/가방 개수 제한은
// 지금은 클라이언트에서만 막고 있어서, 이론적으로는 devtools로 우회해서 4개 이상
// 만들 수 있다(악용 위험은 낮지만 0은 아님). 실제 악용이 문제가 되면 firestore.rules에
// 카운터 문서를 두고 서버 쪽에서도 검증하는 방식을 추가로 고려해야 한다.

import { isUnlimitedAiUser } from "@/lib/aiUsageService";
import { UserProfile } from "@/lib/types";

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
