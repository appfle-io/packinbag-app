import { adminDb } from "@/lib/firebaseAdmin";
import { todayKstKey } from "@/lib/aiUsageConfig";

// 짧은 URL(app/api/shorten-url)과 커스텀 URL(app/api/custom-shorten-url) 생성 둘 다
// 이 하나의 카운터를 공유한다 - 링크 생성 자체(오픈 리다이렉터 악용, 커스텀 코드 선점 등)를
// 막는 게 목적이라 종류를 나눌 이유가 없다. lib/aiQuotaServer.ts와 동일한 패턴
// (하루 단위 카운터 문서, KST 자정 기준)이지만 AI 사용량과는 별개의 컬렉션을 쓴다.
export const SHORT_LINK_DAILY_LIMIT = 10;

export const SHORT_LINK_LIMIT_MESSAGE = `악용 방지를 위해 하루에 최대 ${SHORT_LINK_DAILY_LIMIT}개까지만 짧은/커스텀 URL을 만들 수 있어요. 내일 다시 시도해주세요`;

function usageDocId(uid: string): string {
  return `${uid}_${todayKstKey()}`;
}

// 생성 라우트 맨 앞에서 호출 - 오늘 이미 한도를 채웠으면 여기서 막는다(아직 카운트를
// 증가시키지 않음, 실제 증가는 생성 성공 후 consumeShortLinkQuota에서).
export async function checkShortLinkQuota(uid: string): Promise<{ allowed: boolean; usedCount: number }> {
  const db = adminDb();
  if (!db) return { allowed: true, usedCount: 0 };
  try {
    const snap = await db.collection("shortLinkUsage").doc(usageDocId(uid)).get();
    const usedCount = (snap.data()?.count as number | undefined) ?? 0;
    return { allowed: usedCount < SHORT_LINK_DAILY_LIMIT, usedCount };
  } catch (err) {
    console.error("[팩인백] 숏/커스텀 URL 사용량 조회 실패:", err);
    return { allowed: true, usedCount: 0 };
  }
}

// 링크 생성이 실제로 성공했을 때만 호출해서 카운트를 1 증가시킨다.
export async function consumeShortLinkQuota(uid: string): Promise<void> {
  try {
    const db = adminDb();
    if (!db) return;
    const ref = db.collection("shortLinkUsage").doc(usageDocId(uid));
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ count: 1, uid, dateKey: todayKstKey(), updatedAt: new Date() });
    } else {
      const current = (snap.data()?.count as number | undefined) ?? 0;
      await ref.set({ count: current + 1, uid, dateKey: todayKstKey(), updatedAt: new Date() }, { merge: true });
    }
  } catch (err) {
    console.error("[팩인백] 숏/커스텀 URL 사용량 증가 실패:", err);
  }
}
