import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { todayKstKey } from "@/lib/aiUsageConfig";

// 계정마다 KST 하루 횟수를 세는 서버 전용 카운터(2026-10-16, api.md 확인 필요 1 · 2 · 10).
// 문서 id `{uid}_{KST날짜}`, 필드 count · uid · dateKey. 컬렉션은 firestore.rules에 규칙이 없어(기본 거부) 클라이언트는 못 읽고 못 쓴다.
// 탈퇴 때 app/api/delete-account-data가 uid로 찾아 지운다(DAILY_COUNTER_COLLECTIONS).
//
// - 초대 코드 틀린 횟수(joinFailUsage): 하루 20번
// - 공유 스냅샷 새로 만들기(sharePackUsage): 하루 50개
// - 지명 찾기 외부 조회(geocodeUsage): 하루 100번(캐시에 있는 단어는 안 셈)
export const JOIN_FAIL_COLLECTION = "joinFailUsage";
export const SHARE_PACK_COLLECTION = "sharePackUsage";
export const GEOCODE_COLLECTION = "geocodeUsage";
export const DAILY_COUNTER_COLLECTIONS = [JOIN_FAIL_COLLECTION, SHARE_PACK_COLLECTION, GEOCODE_COLLECTION];

function counterRef(collection: string, uid: string) {
  return adminDb().collection(collection).doc(`${uid}_${todayKstKey()}`);
}

// 오늘 횟수. 조회가 실패하면 예외를 던진다(호출하는 쪽이 막을지 정한다)
export async function readDailyCount(collection: string, uid: string): Promise<number> {
  const snap = await counterRef(collection, uid).get();
  return (snap.data()?.count as number | undefined) ?? 0;
}

// +1(결과와 상관없이 셀 때 — 틀린 코드 등). 실패해도 요청은 그대로 둔다
export async function bumpDailyCount(collection: string, uid: string): Promise<void> {
  try {
    await counterRef(collection, uid).set(
      { count: FieldValue.increment(1), uid, dateKey: todayKstKey(), updatedAt: new Date() },
      { merge: true },
    );
  } catch (err) {
    console.error(`[팩인백] ${collection} 횟수 기록 실패:`, err);
  }
}

// 한도 안이면 1회를 먼저 예약(+1)하고 true. 동시 요청도 한도 안에서만 통과(트랜잭션). 조회가 실패하면 false(막는다)
export async function reserveDailyQuota(collection: string, uid: string, limit: number): Promise<boolean> {
  try {
    const db = adminDb();
    const ref = counterRef(collection, uid);
    return await db.runTransaction(async (tx) => {
      const used = ((await tx.get(ref)).data()?.count as number | undefined) ?? 0;
      if (used >= limit) return false;
      tx.set(ref, { count: used + 1, uid, dateKey: todayKstKey(), updatedAt: new Date() }, { merge: true });
      return true;
    });
  } catch (err) {
    console.error(`[팩인백] ${collection} 횟수 예약 실패:`, err);
    return false;
  }
}

// 예약한 뒤 일이 실패했을 때 되돌린다(-1)
export async function refundDailyQuota(collection: string, uid: string): Promise<void> {
  try {
    await counterRef(collection, uid).set({ count: FieldValue.increment(-1), updatedAt: new Date() }, { merge: true });
  } catch (err) {
    console.error(`[팩인백] ${collection} 횟수 되돌리기 실패:`, err);
  }
}
