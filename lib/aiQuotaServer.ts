// AI 기능 API 라우트(import-note, generate-sample, organize-bag)가 실제 Gemini 호출
// "직전에" 반드시 거쳐야 하는 서버 측 검증. 클라이언트가 devtools로 무엇을 하든
// 우회할 수 없다 - 로그인 토큰을 서버(Admin SDK)가 직접 검증하고, 사용량 확인+증가도
// 클라이언트 SDK가 아니라 서버가 직접 Firestore에 쓰기 때문이다.
//
// 사용량 차감은 두 단계로 나뉜다:
// 1) verifyAndCheckAiQuota - Gemini 호출 "전"에 오늘 한도를 넘지 않았는지만 확인한다
//    (증가시키지 않음). 한도를 넘었으면 여기서 바로 막아 Gemini 호출 자체를 아낀다.
// 2) consumeAiQuota - Gemini 호출이 "성공"해서 실제로 쓸만한 응답을 받았을 때만
//    라우트가 직접 호출해서 오늘 사용량을 1 증가시킨다. 503/429/파싱 실패 등으로
//    실패한 시도는 이 함수가 호출되지 않으므로 무료 횟수가 차감되지 않는다.

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { isMasterEmail } from "@/lib/masterEmails";
import { AI_FREE_DAILY_LIMIT, todayKstKey } from "@/lib/aiUsageConfig";

export class AiAuthError extends Error {}

export interface AiQuotaCheckResult {
  allowed: boolean;
  unlimited: boolean;
  usedCount: number; // 무료 사용자의 경우, 오늘 지금까지 사용한 횟수 (이번 호출 미포함)
  limit: number;
  uid: string; // 성공 시 consumeAiQuota(uid)를 호출하기 위해 필요
}

// req.headers의 "Authorization: Bearer <idToken>"을 검증하고, 오늘 AI 사용량이
// 한도 안인지 확인만 한다 (증가는 하지 않음).
export async function verifyAndCheckAiQuota(req: Request): Promise<AiQuotaCheckResult> {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    throw new AiAuthError("로그인이 필요해요");
  }

  let uid: string;
  let email: string | null;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
    email = decoded.email ?? null;
  } catch (err) {
    console.error("[팩인백] AI 로그인 토큰 검증 실패:", err);
    throw new AiAuthError("로그인 정보를 확인할 수 없어요. 다시 로그인해주세요");
  }

  const db = adminDb();
  const ref = db.collection("users").doc(uid);

  if (isMasterEmail(email)) {
    return { allowed: true, unlimited: true, usedCount: 0, limit: AI_FREE_DAILY_LIMIT, uid };
  }

  // 이용권 코드는 "필드가 있으면 무조건 통과"가 아니라, 그 코드가 실제로
  // unlockCodes 컬렉션에 존재하는지 + 무효화/만료되지 않았는지까지 서버에서 다시
  // 확인한다. (클라이언트가 자기 users/{uid} 문서의 unlockCode 필드를 devtools로
  // 임의의 값으로 직접 써넣는 것까지는 firestore.rules로 못 막기 때문에, 여기서
  // 진짜 코드이고 지금도 유효한지 재검증해야 그 우회가 의미 없어진다.)
  const userSnap = await ref.get();
  const claimedCode = userSnap.data()?.unlockCode as string | undefined;
  if (claimedCode) {
    const codeSnap = await db.collection("unlockCodes").doc(claimedCode).get();
    if (codeSnap.exists) {
      const codeData = codeSnap.data();
      const status = codeData?.status as string | undefined;
      const expiresAt = codeData?.expiresAt as { toDate?: () => Date } | null | undefined;
      const isExpired =
        !!expiresAt && typeof expiresAt.toDate === "function" && expiresAt.toDate().getTime() < Date.now();
      // status가 'invalidated'면 마스터가 무효화한 코드다. expiresAt이 과거면 기간제
      // 이용권이 만료된 것이다. 둘 다 아니면(또는 기존 구버전 코드처럼 필드가 없으면
      // = 무제한) 무제한 자격을 그대로 인정한다.
      if (status !== "invalidated" && !isExpired) {
        return { allowed: true, unlimited: true, usedCount: 0, limit: AI_FREE_DAILY_LIMIT, uid };
      }
    }
    // 존재하지 않거나 무효화/만료된 코드면 그냥 무료 한도로 계속 진행한다 (여기서
    // 막지 않음 - 정상적인 무료 사용자와 동일하게 취급).
  }

  const today = todayKstKey();
  const usage = userSnap.data()?.aiUsage as { date?: string; count?: number } | undefined;
  const currentCount = usage?.date === today ? usage.count ?? 0 : 0;

  return {
    allowed: currentCount < AI_FREE_DAILY_LIMIT,
    unlimited: false,
    usedCount: currentCount,
    limit: AI_FREE_DAILY_LIMIT,
    uid,
  };
}

// Gemini 호출이 성공적으로 끝나 실제로 쓸만한 응답을 받은 뒤에만 라우트가 호출한다.
// 오늘 사용량을 원자적으로 1 증가시키고 증가된 값을 반환한다. (무제한 사용자에
// 대해서는 라우트에서 이 함수 자체를 호출하지 않는다.)
export async function consumeAiQuota(uid: string): Promise<{ usedCount: number; limit: number }> {
  const db = adminDb();
  const ref = db.collection("users").doc(uid);
  const today = todayKstKey();

  const nextCount = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const usage = snap.data()?.aiUsage as { date?: string; count?: number } | undefined;
    const currentCount = usage?.date === today ? usage.count ?? 0 : 0;
    const next = currentCount + 1;
    tx.set(ref, { aiUsage: { date: today, count: next } }, { merge: true });
    return next;
  });

  return { usedCount: nextCount, limit: AI_FREE_DAILY_LIMIT };
}
