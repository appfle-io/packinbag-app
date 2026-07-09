// API 라우트에서 "이 사람이 지금 로그인된 진짜 본인인가" + "프리미엄인가"를 서버에서
// 직접 검증할 때 쓰는 공용 헬퍼. lib/aiQuotaServer.ts의 verifyAndCheckAiQuota와 같은
// 이용권 코드 재검증 로직을 쓰지만, AI 일일 사용량 카운트는 다루지 않는다(팩/가방 생성
// 제한에는 무관).
//
// 클라이언트가 users/{uid} 문서의 unlockCode 필드를 devtools로 마음대로 써넣는 것까지는
// firestore.rules로 못 막기 때문에, 여기서 그 코드가 실제로 unlockCodes 컬렉션에
// 존재하고 지금도 유효한지(무효화/만료 안 됐는지)까지 다시 확인해야 우회가 의미없어진다.

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { isMasterEmail } from "@/lib/masterEmails";

export class ServerAuthError extends Error {}

export interface VerifiedUser {
  uid: string;
  email: string | null;
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
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch (err) {
    console.error("[팩인백] 로그인 토큰 검증 실패:", err);
    throw new ServerAuthError("로그인 정보를 확인할 수 없어요. 다시 로그인해주세요");
  }
}

// 마스터 계정이거나, users/{uid}에 적힌 이용권 코드가 실제로 존재하고 아직 무효화/만료
// 되지 않았으면 프리미엄으로 판정한다 (lib/aiQuotaServer.ts의 재검증 로직과 동일한 기준).
export async function isPremiumServer(uid: string, email: string | null): Promise<boolean> {
  if (isMasterEmail(email)) return true;

  const db = adminDb();
  const userSnap = await db.collection("users").doc(uid).get();
  const claimedCode = userSnap.data()?.unlockCode as string | undefined;
  if (!claimedCode) return false;

  const codeSnap = await db.collection("unlockCodes").doc(claimedCode).get();
  if (!codeSnap.exists) return false;

  const codeData = codeSnap.data();
  const status = codeData?.status as string | undefined;
  const expiresAt = codeData?.expiresAt as { toDate?: () => Date } | null | undefined;
  const isExpired =
    !!expiresAt && typeof expiresAt.toDate === "function" && expiresAt.toDate().getTime() < Date.now();

  return status !== "invalidated" && !isExpired;
}
