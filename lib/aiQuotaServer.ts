// AI 기능 API 라우트(import-note, generate-sample, organize-bag)가 실제 Gemini 호출
// "직전에" 반드시 거쳐야 하는 서버 측 검증.

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { isMasterEmail } from "@/lib/masterEmails";
import { AI_FREE_DAILY_LIMIT, todayKstKey } from "@/lib/aiUsageConfig";

export class AiAuthError extends Error {}

export interface AiQuotaCheckResult {
  allowed: boolean;
  unlimited: boolean;
  usedCount: number;
  limit: number;
  uid: string;
}

// req.headers의 "Authorization: Bearer <idToken>"을 검증하고, 오늘 AI 사용량이 한도 안인지 확인
export async function verifyAndCheckAiQuota(req: Request): Promise<AiQuotaCheckResult> {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  const auth = adminAuth();
  // Firebase Admin SDK 키가 설정되어 있지 않은 경우 (로컬 개발 환경), 500에러 대신 바로 통과
  if (!auth) {
    return { allowed: true, unlimited: true, usedCount: 0, limit: AI_FREE_DAILY_LIMIT, uid: "dev-user" };
  }

  if (!idToken) {
    throw new AiAuthError("로그인이 필요해요");
  }

  let uid: string;
  let email: string | null;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    uid = decoded.uid;
    email = decoded.email ?? null;
  } catch (err) {
    console.error("[팩인백] AI 로그인 토큰 검증 실패:", err);
    throw new AiAuthError("로그인 정보를 확인할 수 없어요. 다시 로그인해주세요");
  }

  try {
    const db = adminDb();
    if (!db) {
      return { allowed: true, unlimited: true, usedCount: 0, limit: AI_FREE_DAILY_LIMIT, uid };
    }

    const ref = db.collection("users").doc(uid);

    if (isMasterEmail(email)) {
      return { allowed: true, unlimited: true, usedCount: 0, limit: AI_FREE_DAILY_LIMIT, uid };
    }

    const userSnap = await ref.get();
    const claimedCode = userSnap.data()?.unlockCode as string | undefined;

    if (claimedCode) {
      const codeSnap = await db.collection("unlockCodes").doc(claimedCode).get();
      if (codeSnap.exists) {
        const codeData = codeSnap.data();
        const active = codeData?.active ?? true;
        const validUntil = codeData?.validUntil?.toDate?.() as Date | undefined;
        const notExpired = !validUntil || validUntil.getTime() > Date.now();
        if (active && notExpired) {
          return { allowed: true, unlimited: true, usedCount: 0, limit: AI_FREE_DAILY_LIMIT, uid };
        }
      }
    }

    const dateKey = todayKstKey();
    const usageSnap = await db.collection("aiUsage").doc(`${uid}_${dateKey}`).get();
    const usedCount = (usageSnap.data()?.count as number | undefined) ?? 0;

    const allowed = usedCount < AI_FREE_DAILY_LIMIT;
    return {
      allowed,
      unlimited: false,
      usedCount,
      limit: AI_FREE_DAILY_LIMIT,
      uid,
    };
  } catch (err) {
    console.error("[팩인백] Firestore AI 사용량 DB 검증 예외:", err);
    return { allowed: true, unlimited: false, usedCount: 0, limit: AI_FREE_DAILY_LIMIT, uid };
  }
}

// Gemini 호출이 성공했을 때만 사용량을 1 증가시킨다.
export async function consumeAiQuota(uid: string): Promise<void> {
  try {
    const db = adminDb();
    if (!db || uid === "dev-user") return;

    const dateKey = todayKstKey();
    const ref = db.collection("aiUsage").doc(`${uid}_${dateKey}`);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ count: 1, uid, dateKey, updatedAt: new Date() });
    } else {
      const current = (snap.data()?.count as number | undefined) ?? 0;
      await ref.set({ count: current + 1, uid, dateKey, updatedAt: new Date() }, { merge: true });
    }
  } catch (err) {
    console.error("[팩인백] consumeAiQuota 실패:", err);
  }
}
