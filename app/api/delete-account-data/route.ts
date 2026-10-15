import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";

// 탈퇴 · 게스트 모드 끝내기의 마지막 단계(2026-10-15, auth.md 확인 필요 2 · 3).
// 가방 · 팩 · 첨부 · 함께 쓰는 가방 넘기기는 앱(lib/accountService deleteAllUserData)이 먼저 끝낸다.
// 여기서는 앱이 규칙상 지울 수 없거나 찾을 수 없는 것을 Admin SDK로 지우고, 마지막에 로그인 계정까지 지운다.
// - 짧은 URL · 커스텀 URL(createdBy), 팩 · 폴더 · 메모 공유 스냅샷(ownerUid), 알림함(users/{uid}/notifications),
//   위젯 · 푸시 기기 토큰(deviceTokens), 문의(inquiries), 사용 기록(emailVerifyUsage · unlockRedeemUsage), users/{uid}
// - 하나가 실패해도 나머지는 계속 지운다. 계정 삭제가 실패하면 500(앱이 기존 방식 deleteUser로 한 번 더 시도)
export const runtime = "nodejs";

async function deleteQuery(q: FirebaseFirestore.Query, label: string): Promise<number> {
  try {
    const snap = await q.get();
    const db = adminDb();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return snap.size;
  } catch (err) {
    console.error(`[팩인백] 탈퇴 정리 실패(${label}):`, err);
    return 0;
  }
}

export async function POST(req: NextRequest) {
  let uid: string;
  try {
    uid = (await verifyRequestUser(req)).uid;
  } catch (err) {
    const message = err instanceof ServerAuthError ? err.message : "로그인이 필요해요";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const db = adminDb();
  const removed: Record<string, number> = {};
  removed.shortLinks = await deleteQuery(db.collection("shortLinks").where("createdBy", "==", uid), "shortLinks");
  removed.customShortLinks = await deleteQuery(db.collection("customShortLinks").where("createdBy", "==", uid), "customShortLinks");
  removed.sharedPacks = await deleteQuery(db.collection("sharedPacks").where("ownerUid", "==", uid), "sharedPacks");
  removed.notifications = await deleteQuery(db.collection("users").doc(uid).collection("notifications"), "notifications");
  removed.deviceTokens = await deleteQuery(db.collection("deviceTokens").where("uid", "==", uid), "deviceTokens");
  // 문의는 예전 문서가 userId를 쓸 수도 있어 둘 다 본다
  removed.inquiries =
    (await deleteQuery(db.collection("inquiries").where("uid", "==", uid), "inquiries.uid")) +
    (await deleteQuery(db.collection("inquiries").where("userId", "==", uid), "inquiries.userId"));
  removed.unlockRedeemUsage = await deleteQuery(db.collection("unlockRedeemUsage").where("uid", "==", uid), "unlockRedeemUsage");
  await db.collection("emailVerifyUsage").doc(uid).delete().catch(() => {});
  await db.collection("users").doc(uid).delete().catch(() => {});

  try {
    await adminAuth().deleteUser(uid);
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (code !== "auth/user-not-found") {
      console.error("[팩인백] 로그인 계정 삭제 실패:", err);
      return NextResponse.json({ ok: false, removed, error: "계정을 지우지 못했어요" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, removed });
}
