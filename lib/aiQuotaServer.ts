// AI 기능 API 라우트(import-note, organize-bag 등)가 실제 Gemini 호출
// "직전에" 반드시 거쳐야 하는 서버 측 검증.
//
// 2026-10-06 하루 횟수 동시 요청 우회 막기:
// 예전에는 "횟수 읽기 → Gemini 호출 → 성공하면 +1" 순서라, 요청을 동시에 여러 개 보내면 전부 읽기 단계를
// 통과해 한도(AI_FREE_DAILY_LIMIT)를 넘겨 Gemini를 부를 수 있었다.
// 지금은 라우트를 withAiQuotaSettlement로 감싸면, verifyAndCheckAiQuota가 트랜잭션으로 1회를 "먼저 예약"한다
// (읽기와 +1을 한 번에 → 동시 요청도 한도 안에서만 통과). Gemini가 성공해 consumeAiQuota를 부르면 예약이 확정되고,
// 그러지 않고 응답이 끝나면(실패·잘못된 요청·프리미엄 전용 거절 등) 예약을 되돌린다(-1). 그래서 실패해도 횟수는 그대로다.
// 감싸지 않은 라우트에서는 예전처럼 읽기만 하고, consumeAiQuota가 원자적으로 +1 한다.
//
// 2026-10-09:
// - 게스트(익명 로그인)는 AI를 쓸 수 없다. 하루 횟수가 계정(uid) 기준이라, 게스트를 새로 만들 때마다 횟수가 초기화됐다.
// - 프리미엄(이용권·인앱결제)도 하루 AI_PREMIUM_DAILY_CAP회까지(코드 유출·자동 호출로 비용이 튀는 것 방지).
//   무료 횟수(count)와 따로 aiUsage 문서의 premiumCount에 센다. 마스터는 제한 없음.
//   라우트는 성공하면 무료·프리미엄 상관없이 consumeAiQuota를 부른다(예약이 없으면 아무것도 안 함).

import { AsyncLocalStorage } from "node:async_hooks";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { checkIsMaster } from "@/lib/adminApiAuth";
import { AI_FREE_DAILY_LIMIT, todayKstKey } from "@/lib/aiUsageConfig";
import { isUnlockCodeValidFor } from "@/lib/unlockCodeCheck";

export class AiAuthError extends Error {}

export const AI_PREMIUM_DAILY_CAP = 50;
export const AI_PREMIUM_CAP_MESSAGE = `AI 기능은 하루 ${AI_PREMIUM_DAILY_CAP}회까지 쓸 수 있어요. 내일 다시 시도해주세요`;
const AI_GUEST_MESSAGE = "AI 기능은 로그인하면 쓸 수 있어요. 설정에서 계정을 만들어 주세요";

export interface AiQuotaCheckResult {
  allowed: boolean;
  unlimited: boolean;
  usedCount: number;
  limit: number;
  uid: string;
  // 프리미엄인데 오늘 AI_PREMIUM_DAILY_CAP회를 다 쓴 경우(allowed도 false). 라우트는 이걸 먼저 보고 AI_PREMIUM_CAP_MESSAGE로 답한다
  capReached?: boolean;
}

type UsageField = "count" | "premiumCount";

// 이번 요청에서 예약한 횟수(aiUsage 문서 id·필드). committed가 false로 남으면 응답이 끝날 때 되돌린다
interface Reservation {
  uid: string;
  docId: string;
  field: UsageField;
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
      .set({ [r.field]: FieldValue.increment(-1), updatedAt: new Date() }, { merge: true });
  } catch (err) {
    console.error("[팩인백] AI 사용량 예약 되돌리기 실패:", err);
  }
}

// 감싼 라우트에서 limit 안이면 트랜잭션으로 1회 예약한다(읽기 + 쓰기 한 번에)
async function reserve(
  uid: string,
  dateKey: string,
  field: UsageField,
  limit: number,
  pending: Reservation[]
): Promise<{ count: number; reserved: boolean }> {
  const db = adminDb();
  const usageRef = db.collection("aiUsage").doc(usageDocId(uid, dateKey));
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const current = (snap.data()?.[field] as number | undefined) ?? 0;
    if (current >= limit) return { count: current, reserved: false };
    tx.set(usageRef, { [field]: current + 1, uid, dateKey, updatedAt: new Date() }, { merge: true });
    return { count: current, reserved: true };
  });
  if (result.reserved) pending.push({ uid, docId: usageRef.id, field, committed: false });
  return result;
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
  let isAnonymous: boolean;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    uid = decoded.uid;
    // 인증한 이메일만(마스터 판정용, lib/premiumServer.ts verifyRequestUser와 같은 기준)
    email = decoded.email_verified ? decoded.email ?? null : null;
    isAnonymous = decoded.firebase?.sign_in_provider === "anonymous";
  } catch (err) {
    console.error("[팩인백] AI 로그인 토큰 검증 실패:", err);
    throw new AiAuthError("로그인 정보를 확인할 수 없어요. 다시 로그인해주세요");
  }

  if (isAnonymous) {
    throw new AiAuthError(AI_GUEST_MESSAGE);
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

    // 인앱결제(RevenueCat 웹훅이 기록한 영구구매)도 프리미엄(lib/premiumServer.ts isPremiumServer와 같은 기준).
    // 예전에는 여기서 빠져 있어, 구매자가 AI로 정리하기·AI 클립보드에서 "프리미엄 전용"으로 막히고
    // 다른 AI 기능도 하루 3회로 제한됐다(2026-10-09).
    const premiumPurchase = userSnap.data()?.premiumPurchase as { purchased?: boolean } | undefined;
    let premium = !!premiumPurchase?.purchased;

    if (!premium) {
      const claimedCode = userSnap.data()?.unlockCode as string | undefined;
      if (claimedCode) {
        const codeSnap = await db.collection("unlockCodes").doc(claimedCode).get();
        // 내가 등록한 코드이고 무효화·만료가 아니어야 프리미엄(lib/unlockCodeCheck.ts). 예전에는 지금 쓰지 않는 필드
        // (active·validUntil)를 봐서 무효화·만료된 코드나 남의 코드를 써넣어도 무제한이었다(2026-10-07)
        premium = isUnlockCodeValidFor(codeSnap.data(), uid);
      }
    }

    const dateKey = todayKstKey();
    const pending = reservations.getStore();

    if (premium) {
      // 감싸지 않은 라우트는 상한 없이 통과(지금 AI 라우트는 전부 감싸져 있다)
      if (!pending) {
        return { allowed: true, unlimited: true, usedCount: 0, limit: AI_FREE_DAILY_LIMIT, uid };
      }
      const { reserved } = await reserve(uid, dateKey, "premiumCount", AI_PREMIUM_DAILY_CAP, pending);
      return {
        allowed: reserved,
        unlimited: true,
        usedCount: 0,
        limit: AI_FREE_DAILY_LIMIT,
        uid,
        capReached: !reserved,
      };
    }

    // 감싸지 않은 라우트: 읽기만(예전 동작)
    if (!pending) {
      const usageSnap = await db.collection("aiUsage").doc(usageDocId(uid, dateKey)).get();
      const usedCount = (usageSnap.data()?.count as number | undefined) ?? 0;
      return { allowed: usedCount < AI_FREE_DAILY_LIMIT, unlimited: false, usedCount, limit: AI_FREE_DAILY_LIMIT, uid };
    }

    // 감싼 라우트: 한도 안이면 1회 예약
    const { count, reserved } = await reserve(uid, dateKey, "count", AI_FREE_DAILY_LIMIT, pending);

    // usedCount는 이번 요청 전 횟수(라우트가 성공 후 +1 해서 응답에 싣는다)
    return { allowed: reserved, unlimited: false, usedCount: count, limit: AI_FREE_DAILY_LIMIT, uid };
  } catch (err) {
    // 검사가 실패하면 막는다(예전에는 허용해서, 요청을 많이 보내 오류를 유도하면 한도를 넘길 수 있었다)
    console.error("[팩인백] Firestore AI 사용량 DB 검증 예외:", err);
    return { allowed: false, unlimited: false, usedCount: 0, limit: AI_FREE_DAILY_LIMIT, uid };
  }
}

// Gemini 호출이 성공했을 때 부른다(무료·프리미엄 모두). 예약해 둔 1회가 있으면 확정만 한다.
// 감싼 라우트인데 예약이 없으면(마스터 등) 아무것도 하지 않는다. 감싸지 않은 라우트에서만 원자적으로 +1.
export async function consumeAiQuota(uid: string): Promise<void> {
  const pending = reservations.getStore();
  if (pending) {
    const reservation = pending.find((r) => r.uid === uid && !r.committed);
    if (reservation) reservation.committed = true;
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
