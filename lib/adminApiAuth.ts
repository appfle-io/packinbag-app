import { verifyRequestUser, ServerAuthError, VerifiedUser } from "@/lib/premiumServer";
import { isMasterEmail } from "@/lib/masterEmails";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export { ServerAuthError };

// 로그인은 됐지만 마스터(운영자) 계정이 아닐 때 - 401(비로그인)과 구분해서 403으로 매핑한다.
export class AdminForbiddenError extends Error {}

export async function requireMasterUser(req: Request): Promise<VerifiedUser> {
  const verified = await verifyRequestUser(req);
  if (!isMasterEmail(verified.email)) {
    throw new AdminForbiddenError("관리자 권한이 없어요");
  }

  // Security Rules 검증용 masters/{uid} 문서를 자동 유지 (백그라운드)
  adminDb()
    .collection("masters")
    .doc(verified.uid)
    .set({ email: verified.email, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    .catch(() => {});

  return verified;
}
