// 이용권 코드가 "이 사람에게" 지금 유효한지. 서버(isPremiumServer · AI 하루 횟수)가 함께 쓴다(2026-10-07).
//
// users/{uid}.unlockCode는 클라이언트가 직접 쓸 수 있는 필드라서 그 값만 믿으면 안 된다.
// 예전 검사는 "코드가 존재하고 무효화 안 됨"만 봐서, 남이 등록한 코드나 아직 아무도 안 쓴 코드를
// devtools로 써넣기만 해도 프리미엄이 됐다(AI 쪽은 옛 필드 active·validUntil을 봐서 무효화·만료 코드도 통과).
// 이제는 서버(app/api/redeem-unlock-code)가 기록한 claimedBy.uid가 본인이어야 인정한다.
// storage.rules의 isPremium()도 같은 기준이다 - 바꾸면 함께 바꿀 것.

type Timestampish = { toDate?: () => Date } | null | undefined;

export function isUnlockCodeValidFor(codeData: Record<string, unknown> | undefined, uid: string): boolean {
  if (!codeData) return false;
  if (codeData.status !== "claimed") return false;
  const claimedBy = codeData.claimedBy as { uid?: string } | undefined;
  if (claimedBy?.uid !== uid) return false;
  const expiresAt = codeData.expiresAt as Timestampish;
  if (expiresAt && typeof expiresAt.toDate === "function" && expiresAt.toDate().getTime() < Date.now()) return false;
  return true;
}
