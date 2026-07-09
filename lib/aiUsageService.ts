// AI 기능(메모/샘플 가져오기, 해시태그 생성, 가방 속 AI 정리) 관련 클라이언트 측 유틸.
//
// 중요: 여기 있는 isUnlimitedAiUser/currentAiUsageCount는 "표시(UI)용"이다.
// 실제 하루 10회 제한 검증은 이제 서버(Admin SDK)가 한다 - lib/aiQuotaServer.ts 참고.
// 클라이언트가 이 파일의 함수 결과를 마음대로 조작해도(devtools) 서버가 다시 검증하기
// 때문에 실제 우회는 안 된다. 이 파일은 오직 "지금 몇 번 썼는지 화면에 보여주기"와
// "이용권 코드 입력/생성" UI 동작만 담당한다.

import {
  doc,
  getDoc,
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
export async function createUnlockCode(note?: string): Promise<string> {
  const code = generateRandomCode();
  await setDoc(doc(db, "unlockCodes", code), {
    createdAt: serverTimestamp(),
    note: note?.trim() || "",
  });
  return code;
}

// 사용자가 이용권 코드를 입력했을 때: 코드가 실제 존재하면 내 계정에 저장.
// (실제 무제한 인증 여부는 서버가 다시 검증하지만, 애초에 존재하지 않는 코드를
// 입력해봤자 소용없다는 걸 여기서 바로 알려주기 위해 클라이언트에서도 한 번 확인한다)
// 반환값 true = 성공, false = 존재하지 않는 코드
export async function redeemUnlockCode(uid: string, rawCode: string): Promise<boolean> {
  const code = rawCode.trim().toUpperCase();
  if (code.length !== UNLOCK_CODE_LENGTH) return false;

  const snap = await getDoc(doc(db, "unlockCodes", code));
  if (!snap.exists()) return false;

  await setDoc(doc(db, "users", uid), { unlockCode: code }, { merge: true });
  return true;
}

// 마스터 전용 관리 화면에서 지금까지 발급한 코드 목록을 보여줄 때 사용.
export interface UnlockCodeEntry {
  code: string;
  note: string;
  createdAt: string | null; // ISO, serverTimestamp가 아직 반영 전이면 null
}

export async function listUnlockCodes(): Promise<UnlockCodeEntry[]> {
  const { collection, getDocs, query, orderBy } = await import("firebase/firestore");
  const snap = await getDocs(query(collection(db, "unlockCodes"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null;
    return { code: d.id, note: (data.note as string) ?? "", createdAt };
  });
}
