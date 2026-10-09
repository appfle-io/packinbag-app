import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { todayKstKey } from "@/lib/aiUsageConfig";

// 짧은 URL(app/api/shorten-url)과 커스텀 URL(app/api/custom-shorten-url) 생성 둘 다
// 이 하나의 카운터를 공유한다 - 링크 생성 자체(오픈 리다이렉터 악용, 커스텀 코드 선점 등)를
// 막는 게 목적이라 종류를 나눌 이유가 없다. lib/aiQuotaServer.ts와 동일한 패턴
// (하루 단위 카운터 문서, KST 자정 기준)이지만 AI 사용량과는 별개의 컬렉션을 쓴다.
//
// 2026-10-09: "읽기 → 생성 → +1" 순서라 요청을 동시에 여러 개 보내면 한도를 넘길 수 있었고,
// 조회가 실패하면 통과시켰다. 이제 시작할 때 트랜잭션으로 1회를 먼저 예약하고(읽기와 +1을 한 번에),
// 생성이 실패하면 되돌린다. 조회가 실패하면 막는다.
const SHORT_LINK_DAILY_LIMIT = 10;

export const SHORT_LINK_LIMIT_MESSAGE = `악용 방지를 위해 하루에 최대 ${SHORT_LINK_DAILY_LIMIT}개까지만 짧은/커스텀 URL을 만들 수 있어요. 내일 다시 시도해주세요`;

function usageDocId(uid: string): string {
  return `${uid}_${todayKstKey()}`;
}

// 생성 라우트에서 실제로 만들기 직전에 호출 - 한도 안이면 1회를 예약(+1)하고 true.
export async function reserveShortLinkQuota(uid: string): Promise<boolean> {
  try {
    const db = adminDb();
    const ref = db.collection("shortLinkUsage").doc(usageDocId(uid));
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const used = (snap.data()?.count as number | undefined) ?? 0;
      if (used >= SHORT_LINK_DAILY_LIMIT) return false;
      tx.set(ref, { count: used + 1, uid, dateKey: todayKstKey(), updatedAt: new Date() }, { merge: true });
      return true;
    });
  } catch (err) {
    console.error("[팩인백] 숏/커스텀 URL 사용량 예약 실패:", err);
    return false;
  }
}

// 예약한 뒤 생성이 실패했을 때 되돌린다(-1).
export async function refundShortLinkQuota(uid: string): Promise<void> {
  try {
    await adminDb()
      .collection("shortLinkUsage")
      .doc(usageDocId(uid))
      .set({ count: FieldValue.increment(-1), updatedAt: new Date() }, { merge: true });
  } catch (err) {
    console.error("[팩인백] 숏/커스텀 URL 사용량 되돌리기 실패:", err);
  }
}
