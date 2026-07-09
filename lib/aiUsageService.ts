// AI 기능(메모/샘플 가져오기, 해시태그 생성, 가방 속 AI 정리) 관련 클라이언트 측 유틸.
//
// 중요: 여기 있는 isUnlimitedAiUser/currentAiUsageCount는 "표시(UI)용"이다.
// 실제 하루 10회 제한 검증은 이제 서버(Admin SDK)가 한다 - lib/aiQuotaServer.ts 참고.
// 클라이언트가 이 파일의 함수 결과를 마음대로 조작해도(devtools) 서버가 다시 검증하기
// 때문에 실제 우회는 안 된다. 이 파일은 오직 "지금 몇 번 썼는지 화면에 보여주기"와
// "이용권 코드 입력/생성" UI 동작만 담당한다.

import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isMasterEmail } from "@/lib/masterEmails";
import { UserProfile } from "@/lib/types";
import {
  AI_FREE_DAILY_LIMIT,
  UNLOCK_CODE_LENGTH,
  todayKstKey,
  generateRandomCode,
} from "@/lib/aiUsageConfig";

export { AI_FREE_DAILY_LIMIT, UNLOCK_CODE_LENGTH, generateRandomCode };

// 표시용: 마스터 계정이거나 이용권 코드 필드가 있으면 "무제한"이라고 화면에 보여준다.
// (진짜 코드인지 서버가 다시 검증하므로, 여기서는 UI 뱃지 표시 목적일 뿐이다)
export function isUnlimitedAiUser(
  email: string | null | undefined,
  profile: UserProfile | null
): boolean {
  if (isMasterEmail(email)) return true;
  if (profile?.unlockCode) return true;
  return false;
}

// 오늘 이미 몇 번 썼는지 표시용 (서버가 증가시킨 값이 onSnapshot으로 실시간 반영됨)
export function currentAiUsageCount(profile: UserProfile | null): number {
  const usage = profile?.aiUsage;
  if (!usage || usage.date !== todayKstKey()) return 0;
  return usage.count ?? 0;
}

// ---- 이용권 코드 ----

// 마스터 계정만 호출 가능 (firestore.rules에서 마스터 이메일인지 다시 검증됨).
// count개를 한 번에 생성하고, 모두 같은 공통 메모(note)를 붙인다.
// (최대 200개로 제한 - 실수로 너무 많이 만드는 것을 방지)
export async function createUnlockCodesBulk(count: number, note?: string): Promise<string[]> {
  const n = Math.max(1, Math.min(200, Math.floor(count)));
  const { writeBatch } = await import("firebase/firestore");

  const codes = new Set<string>();
  while (codes.size < n) {
    codes.add(generateRandomCode());
  }
  const codeList = Array.from(codes);

  const batch = writeBatch(db);
  for (const code of codeList) {
    batch.set(doc(db, "unlockCodes", code), {
      createdAt: serverTimestamp(),
      note: note?.trim() || "",
      status: "unused",
    });
  }
  await batch.commit();

  return codeList;
}

// 마스터 전용: 이미 발급된 코드를 무효화한다. (누가 썼는지 기록은 남기고, 앞으로는
// 그 코드로 AI 기능 무제한 자격을 얻을 수 없게 서버 쪽 검증에서 걸러진다 - lib/aiQuotaServer.ts)
export async function invalidateUnlockCode(code: string): Promise<void> {
  await setDoc(
    doc(db, "unlockCodes", code),
    { status: "invalidated", invalidatedAt: serverTimestamp() },
    { merge: true }
  );
}

// 마스터 전용 관리 화면에서 지금까지 발급한 코드 목록을 보여줄 때 사용.
export type UnlockCodeStatus = "unused" | "claimed" | "invalidated";

export interface UnlockCodeEntry {
  code: string;
  note: string;
  status: UnlockCodeStatus;
  createdAt: string | null; // ISO, serverTimestamp가 아직 반영 전이면 null
  claimedByEmail: string | null;
  claimedByUid: string | null;
  claimedAt: string | null;
  invalidatedAt: string | null;
}

export async function listUnlockCodes(): Promise<UnlockCodeEntry[]> {
  const { collection, getDocs, query, orderBy } = await import("firebase/firestore");
  const snap = await getDocs(query(collection(db, "unlockCodes"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => {
    const data = d.data();
    const toIso = (v: unknown) =>
      v && typeof v === "object" && "toDate" in v ? (v as { toDate: () => Date }).toDate().toISOString() : null;
    const claimedBy = data.claimedBy as { uid?: string; email?: string; claimedAt?: unknown } | undefined;
    return {
      code: d.id,
      note: (data.note as string) ?? "",
      // 구버전 코드(status 필드가 생기기 전에 만든 코드)는 아직 아무도 안 쓴 것으로 취급.
      status: (data.status as UnlockCodeStatus) ?? "unused",
      createdAt: toIso(data.createdAt),
      claimedByEmail: claimedBy?.email ?? null,
      claimedByUid: claimedBy?.uid ?? null,
      claimedAt: toIso(claimedBy?.claimedAt),
      invalidatedAt: toIso(data.invalidatedAt),
    };
  });
}
