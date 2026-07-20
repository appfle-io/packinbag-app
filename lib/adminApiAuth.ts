// app/api/admin/* 라우트 전용 공통 인증 헬퍼. "로그인된 진짜 본인"인지(verifyRequestUser)
// 뿐 아니라 "마스터(운영자) 계정인지"까지 함께 확인해서, 아니면 에러를 던진다.
// 개별 admin 라우트마다 이 두 단계를 반복 작성하지 않기 위한 목적.

import { verifyRequestUser, ServerAuthError, VerifiedUser } from "@/lib/premiumServer";
import { isMasterEmail } from "@/lib/masterEmails";

export { ServerAuthError };

// 로그인은 됐지만 마스터(운영자) 계정이 아닐 때 - 401(비로그인)과 구분해서 403으로 매핑한다.
export class AdminForbiddenError extends Error {}

export async function requireMasterUser(req: Request): Promise<VerifiedUser> {
  const verified = await verifyRequestUser(req);
  if (!isMasterEmail(verified.email)) {
    throw new AdminForbiddenError("관리자 권한이 없어요");
  }
  return verified;
}
