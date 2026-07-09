// AI 기능 API 라우트(import-note, generate-sample, organize-bag)가 실제 Gemini 호출
// "직전에" 반드시 거쳐야 하는 서버 측 검증. 클라이언트가 devtools로 무엇을 하든
// 우회할 수 없다 - 로그인 토큰을 서버(Admin SDK)가 직접 검증하고, 사용량 확인+증가도
// 클라이언트 SDK가 아니라 서버가 직접 Firestore에 쓰기 때문이다.

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { isMasterEmail } from "@/lib/masterEmails";
import { AI_FREE_DAILY_LIMIT, todayKstKey } from "@/lib/aiUsageConfig";

export class AiAuthError extends Error {}

export interface ServerAiQuotaResult {
  allowed: boolean;
  unlimited: boolean;
  usedCount: number; // 무료 사용자의 경우, 이번 호출을 포함해 오늘 사용한 횟수
  limit: number;
}

// req.headers의 "Authorization: Bearer <idToken>"을 검증하고, 오늘 AI 사용량을
// 원자적으로 확인+증가한다(무제한 사용자는 증가 없이 바로 통과).
export async function verifyAndConsumeAiQuota(req: Request): Promise<ServerAiQuotaResult> {
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
    return { allowed: true, unlimited: true, usedCount: 0, limit: AI_FREE_DAILY_LIMIT };
  }

  // 이용권 코드는 "필드가 있으면 무조건 통과"가 아니라, 그 코드가 실제로
  // unlockCodes 컬렉션에 존재하는지까지 서버에서 다시 확인한다. (클라이언트가
  // 자기 users/{uid} 문서의 unlockCode 필드를 devtools로 임의의 값으로 직접 써넣는
  // 것까지는 firestore.rules로 못 막기 때문에, 여기서 진짜 코드인지 재검증해야
  // 그 우회가 의미 없어진다.)
  const userSnap = await ref.get();
  const claimedCode = userSnap.data()?.unlockCode as string | undefined;
  if (claimedCode) {
    const codeSnap = await db.collection("unlockCodes").doc(claimedCode).get();
    // status가 'invalidated'면 마스터가 무효화한 코드다 - 즉시 무제한 자격을 잃고
    // 일반 무료 사용자와 동일하게 취급한다 (기존에 status 필드가 없던 구버전 코드는
    // 무효화된 적이 없다는 뜻이므로 그대로 통과시킨다).
    if (codeSnap.exists && codeSnap.data()?.status !== "invalidated") {
      return { allowed: true, unlimited: true, usedCount: 0, limit: AI_FREE_DAILY_LIMIT };
    }
    // 존재하지 않거나 무효화된 코드면 그냥 무료 한도로 계속 진행한다 (여기서 막지 않음 -
    // 정상적인 무료 사용자와 동일하게 취급).
  }

  const today = todayKstKey();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const usage = snap.data()?.aiUsage as { date?: string; count?: number } | undefined;
    const currentCount = usage?.date === today ? usage.count ?? 0 : 0;

    if (currentCount >= AI_FREE_DAILY_LIMIT) {
      return { allowed: false, usedCount: currentCount };
    }

    const nextCount = currentCount + 1;
    tx.set(ref, { aiUsage: { date: today, count: nextCount } }, { merge: true });
    return { allowed: true, usedCount: nextCount };
  });

  return {
    allowed: result.allowed,
    unlimited: false,
    usedCount: result.usedCount,
    limit: AI_FREE_DAILY_LIMIT,
  };
}
