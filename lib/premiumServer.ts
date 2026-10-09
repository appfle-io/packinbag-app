// API 라우트에서 "이 사람이 지금 로그인된 진짜 본인인가" + "프리미엄인가"를 서버에서
// 직접 검증할 때 쓰는 공용 헬퍼. lib/aiQuotaServer.ts의 verifyAndCheckAiQuota와 같은
// 이용권 코드 재검증 로직을 쓰지만, AI 일일 사용량 카운트는 다루지 않는다(팩/가방 생성
// 제한에는 무관).
//
// 클라이언트가 users/{uid} 문서의 unlockCode 필드를 devtools로 마음대로 써넣는 것까지는
// firestore.rules로 못 막기 때문에, 여기서 그 코드가 실제로 unlockCodes 컬렉션에
// 존재하고 지금도 유효한지(무효화/만료 안 됐는지)까지 다시 확인해야 우회가 의미없어진다.

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { checkIsMaster } from "@/lib/adminApiAuth";
import { isUnlockCodeValidFor } from "@/lib/unlockCodeCheck";
import { FREE_LAUNCH } from "@/lib/freeLaunch";

export class ServerAuthError extends Error {}

export interface VerifiedUser {
  uid: string;
  email: string | null;
  // 게스트(익명 로그인). 계정 기준 하루 한도가 있는 기능(짧은 URL 등)은 게스트를 막는다 - 게스트를 새로 만들면 한도가 초기화되기 때문(2026-10-09)
  isAnonymous: boolean;
}

// "Authorization: Bearer <idToken>" 헤더를 검증해서 uid/email을 돌려준다.
// 실패하면 ServerAuthError를 던진다(호출하는 라우트에서 401로 매핑).
export async function verifyRequestUser(req: Request): Promise<VerifiedUser> {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    throw new ServerAuthError("로그인이 필요해요");
  }
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    // 인증하지 않은 이메일은 넘기지 않는다(2026-10-09). 마스터 판정이 이메일을 보기 때문에, 마스터 이메일로
    // 가입만 하고 인증하지 않은 계정이 관리자가 될 수 있었다. Google·Apple 로그인은 항상 인증된 이메일이다.
    return {
      uid: decoded.uid,
      email: decoded.email_verified ? decoded.email ?? null : null,
      isAnonymous: decoded.firebase?.sign_in_provider === "anonymous",
    };
  } catch (err) {
    console.error("[팩인백] 로그인 토큰 검증 실패:", err);
    throw new ServerAuthError("로그인 정보를 확인할 수 없어요. 다시 로그인해주세요");
  }
}

// 마스터 계정이거나, users/{uid}에 적힌 이용권 코드가 실제로 존재하고 아직 무효화/만료
// 되지 않았으면 프리미엄으로 판정한다 (lib/aiQuotaServer.ts의 재검증 로직과 동일한 기준).
export async function isPremiumServer(uid: string, email: string | null): Promise<boolean> {
  // 출시 기념 전원 무료(lib/freeLaunch.ts)
  if (FREE_LAUNCH) return true;
  const isMaster = await checkIsMaster(uid, email);
  if (isMaster) return true;

  const db = adminDb();
  const userSnap = await db.collection("users").doc(uid).get();

  // 인앱결제(RevenueCat 웹훅이 기록한 영구구매)로 프리미엄이면 이용권 코드와 무관하게 항상 프리미엄.
  const premiumPurchase = userSnap.data()?.premiumPurchase as { purchased?: boolean } | undefined;
  if (premiumPurchase?.purchased) return true;

  const claimedCode = userSnap.data()?.unlockCode as string | undefined;
  if (!claimedCode) return false;

  const codeSnap = await db.collection("unlockCodes").doc(claimedCode).get();
  // 내가 등록(claimed)한 코드인지까지 본다(lib/unlockCodeCheck.ts)
  return isUnlockCodeValidFor(codeSnap.data(), uid);
}
