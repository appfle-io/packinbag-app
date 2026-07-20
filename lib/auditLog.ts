// CS(고객지원) 대응을 위한 감사 로그. 삭제/복구/이용권 사용 등 주요 이벤트를
// auditLogs 컬렉션은 클라이언트가 직접 쓸 수 없고(firestore.rules에서 allow write: if false),
// 이 파일을 통해 API 라우트(Admin SDK)에서만 기록된다. 읽기는 관리자(app/admin)에서만
// app/api/admin/audit-logs 라우트(Admin SDK)를 통해 조회한다.
//
// 기록 실패가 원래 동작(가방 복구 등)을 막으면 안 되므로, 호출하는 쪽에서 항상
// try/catch로 감싸서 "베스트 에포트"로만 남긴다 - 이 파일 자체는 에러를 던지지 않고
// 콘솔에만 남긴다.

import { adminDb } from "@/lib/firebaseAdmin";

export type AuditAction =
  | "bag_restore"
  | "bag_trash"
  | "library_pack_restore"
  | "library_pack_trash"
  | "unlock_code_redeem"
  | "unlock_code_invalidate"
  | "invite_code_regenerate";

export interface AuditLogEntry {
  uid: string; // 이 액션을 수행한(또는 대상이 된) 사용자
  email?: string | null;
  action: AuditAction;
  targetType: "bag" | "libraryPack" | "unlockCode" | "inviteCode";
  targetId: string;
  meta?: Record<string, unknown>;
}

export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const db = adminDb();
    await db.collection("auditLogs").add({
      ...entry,
      email: entry.email ?? null,
      meta: entry.meta ?? {},
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // 감사 로그 기록 실패는 원래 요청을 실패시키면 안 된다 - 콘솔에만 남긴다.
    console.error("[팩인백] audit log 기록 실패:", err);
  }
}
