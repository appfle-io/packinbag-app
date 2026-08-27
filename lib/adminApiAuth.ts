import { verifyRequestUser, ServerAuthError, VerifiedUser } from "@/lib/premiumServer";
import { isMasterEmail } from "@/lib/masterEmails";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export { ServerAuthError };

// 로그인은 됐지만 마스터(운영자) 계정이 아닐 때 - 401(비로그인)과 구분해서 403으로 매핑한다.
export class AdminForbiddenError extends Error {}

/**
 * 마스터 사용자 여부를 판정하고, 마스터라면 Firestore/Auth 상태를 자동 동기화한다.
 * 판정 우선순위:
 * 1. 환경변수(NEXT_PUBLIC_MASTER_EMAILS / MASTER_EMAILS)에 이메일 존재
 * 2. Firestore masters/{uid} 문서 존재
 * 3. Firestore masters 컬렉션 내 이메일 일치 문서 존재
 * 4. Firestore users/{uid} 문서의 role === 'master'
 */
export async function checkIsMaster(uid: string, email: string | null): Promise<boolean> {
  // 1. 환경변수 검사
  if (isMasterEmail(email)) return true;

  const db = adminDb();

  // 2. masters/{uid} 문서 존재 확인
  try {
    const masterDoc = await db.collection("masters").doc(uid).get();
    if (masterDoc.exists) return true;
  } catch (err) {
    console.error("[팩인백] masters doc 확인 실패:", err);
  }

  // 3. masters 컬렉션 이메일 매칭 확인
  if (email) {
    try {
      const emailSnap = await db
        .collection("masters")
        .where("email", "==", email.trim().toLowerCase())
        .limit(1)
        .get();
      if (!emailSnap.empty) return true;
    } catch (err) {
      console.error("[팩인백] masters email 쿼리 실패:", err);
    }
  }

  // 4. users/{uid} 문서 role 필드 확인
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists && userDoc.data()?.role === "master") return true;
  } catch (err) {
    console.error("[팩인백] users role 확인 실패:", err);
  }

  return false;
}

/**
 * 마스터 계정의 상태(masters 컬렉션, users role, Custom Claims)를 백그라운드에서 동기화한다.
 */
export function syncMasterStateBackground(uid: string, email: string | null) {
  const db = adminDb();
  const auth = adminAuth();

  // masters/{uid}
  db.collection("masters")
    .doc(uid)
    .set(
      {
        email: email ? email.toLowerCase() : null,
        role: "master",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    .catch(() => {});

  // users/{uid} role: 'master'
  db.collection("users")
    .doc(uid)
    .set(
      {
        role: "master",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    .catch(() => {});

  // Auth Custom Claims
  auth
    .setCustomUserClaims(uid, { role: "master", admin: true })
    .catch(() => {});
}

export async function requireMasterUser(req: Request): Promise<VerifiedUser> {
  const verified = await verifyRequestUser(req);
  const isMaster = await checkIsMaster(verified.uid, verified.email);

  if (!isMaster) {
    throw new AdminForbiddenError("관리자 권한이 없어요");
  }

  // 마스터 상태 자동 동기화 (백그라운드)
  syncMasterStateBackground(verified.uid, verified.email);

  return verified;
}

