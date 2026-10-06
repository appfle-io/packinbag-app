// AI 기능 API 라우트(import-note, generate-sample, organize-bag 등)가 실제 Gemini 호출
// "직전에" 반드시 거쳐야 하는 서버 측 검증.
//
// 2026-10-06 하루 횟수 동시 요청 우회 막기:
// 예전에는 "횟수 읽기 → Gemini 호출 → 성공하면 +1" 순서라, 요청을 동시에 여러 개 보내면 전부 읽기 단계를
// 통과해 한도(AI_FREE_DAILY_LIMIT)를 넘겨 Gemini를 부를 수 있었다.
// 지금은 라우트를 withAiQuotaSettlement로 감싸면, verifyAndCheckAiQuota가 트랜잭션으로 1회를 "먼저 예약"한다
// (읽기와 +1을 한 번에 → 동시 요청도 한도 안에서만 통과). Gemini가 성공해 consumeAiQuota를 부르면 예약이 확정되고,
// 그러지 않고 응답이 끝나면(실패·잘못된 요청·프리미엄 전용 거절 등) 예약을 되돌린다(-1). 그래서 실패해도 횟수는 그대로다.
// 감싸지 않은 라우트에서는 예전처럼 읽기만 하고, consumeAiQuota가 원자적으로 +1 한다.

import { AsyncLocalStorage } from "node:async_hooks";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { checkIsMaster } from "@/lib/adminApiAuth";
import { AI_FREE_DAILY_LIMIT, todayKstKey } from "@/lib/aiUsageConfig";

export class AiAuthError extends Error {}

export interface AiQuotaCheckResult {
  allowed: boolean;
  unlimited: boolean;
  usedCount: number;
  limit: number;
  uid: string;
}

// 이번 요청에서 예약한 횟수(aiUsage 문서 id). committed가 false로 남으면 응답이 끝날 때 되돌린다
interface Reservation {
  uid: string;
  docId: string;
  committed: boolean;
}

const reservations = new AsyncLocalStorage<Reservation[]>();

function usageDocId(uid: string, dateKey = todayKstKey()) {
  return `${uid}_${dateKey}`;
}

// AI 라우트의 POST를 감싼다: export const POST = withAiQuotaSettlement(handlePOST)
// 응답이 끝난 뒤 확정되지 않은 예약(Gemini 실패 등)을 되돌린다.
export function withAiQuotaSettlement<R extends Request>(
  handler: (req: R) => Promise<Response>
): (req: R) => Promise<Response> {
  return (req: R) => {
    const pending: Reservation[] = [];
    return reservations.run(pending, async () => {
      try {
        return await handler(req);
      } finally {
        const open = pending.filter((r) => !r.committed);
        if (open.length > 0) await Promise.all(open.map(refundReservation));
      }
    });
  };
}

async function refundReservation(r: Reservation) {
  try {
    const db = adminDb();
    if (!db) return;
    await db
      .collection("aiUsage")
      .doc(r.docId)
      .set({ count: FieldValue.increment(-1), updatedAt: new Date() }, { merge: true });
  } catch (err) {
    console.error("[팩인백] AI 사용량 예약 되돌리기 실패:", err);
  }
}

// req.headers의 "Authorization: Bearer <idToken>"을 검증하고, 오늘 AI 사용량이 한도 안인지 확인
// (withAiQuotaSettlement 안이면 한도 안일 때 1회를 바로 예약한다)
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

    const isMaster = await checkIsMaster(uid, email);
    if (isMaster) {
      return { allowed: true, unlimited: true, usedCount: 0, limit: AI_FREE_DAILY_LIMIT, uid };
    }

    const userSnap = await db.collection("users").doc(uid).get();
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
    const usageRef = db.collection("aiUsage").doc(usageDocId(uid, dateKey));
    const pending = reservations.getStore();

    // 감싸지 않은 라우트: 읽기만(예전 동작)
    if (!pending) {
      const usageSnap = await usageRef.get();
      const usedCount = (usageSnap.data()?.count as number | undefined) ?? 0;
      return { allowed: usedCount < AI_FREE_DAILY_LIMIT, unlimited: false, usedCount, limit: AI_FREE_DAILY_LIMIT, uid };
    }

    // 감싼 라우트: 한도 안이면 트랜잭션으로 1회 예약(읽기 + 쓰기 한 번에)
    const { count, reserved } = await db.runTransaction(async (tx) => {
      const snap = await tx.get(usageRef);
      const current = (snap.data()?.count as number | undefined) ?? 0;
      if (current >= AI_FREE_DAILY_LIMIT) return { count: current, reserved: false };
      tx.set(usageRef, { count: current + 1, uid, dateKey, updatedAt: new Date() }, { merge: true });
      return { count: current, reserved: true };
    });
    if (reserved) pending.push({ uid, docId: usageRef.id, committed: false });

    // usedCount는 이번 요청 전 횟수(라우트가 성공 후 +1 해서 응답에 싣는다)
    return { allowed: reserved, unlimited: false, usedCount: count, limit: AI_FREE_DAILY_LIMIT, uid };
  } catch (err) {
    console.error("[팩인백] Firestore AI 사용량 DB 검증 예외:", err);
    return { allowed: true, unlimited: false, usedCount: 0, limit: AI_FREE_DAILY_LIMIT, uid };
  }
}

// Gemini 호출이 성공했을 때만 부른다. 예약해 둔 1회가 있으면 확정만 하고, 없으면(감싸지 않은 라우트) 원자적으로 +1.
export async function consumeAiQuota(uid: string): Promise<void> {
  const pending = reservations.getStore();
  const reservation = pending?.find((r) => r.uid === uid && !r.committed);
  if (reservation) {
    reservation.committed = true;
    return;
  }
  try {
    const db = adminDb();
    if (!db || uid === "dev-user") return;

    const dateKey = todayKstKey();
    await db
      .collection("aiUsage")
      .doc(usageDocId(uid, dateKey))
      .set({ count: FieldValue.increment(1), uid, dateKey, updatedAt: new Date() }, { merge: true });
  } catch (err) {
    console.error("[팩인백] consumeAiQuota 실패:", err);
  }
}
