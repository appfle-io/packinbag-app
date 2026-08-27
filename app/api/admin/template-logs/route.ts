import { NextRequest, NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireMasterUser, AdminForbiddenError, ServerAuthError } from "@/lib/adminApiAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireMasterUser(req);

    const snapshot = await adminDb()
      .collection("templateInspectLogs")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const logs = snapshot.docs.map((d: QueryDocumentSnapshot) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ logs });
  } catch (err) {
    if (err instanceof ServerAuthError) {
      return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
    }
    if (err instanceof AdminForbiddenError) {
      return NextResponse.json({ error: "관리자 권한이 없어요" }, { status: 403 });
    }
    console.error("[팩인백] 어드민 템플릿 로그 조회 실패:", err);
    return NextResponse.json({ error: "조회에 실패했어요" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireMasterUser(req);

    const { searchParams } = new URL(req.url);
    const logId = searchParams.get("id");
    if (!logId) {
      return NextResponse.json({ error: "삭제할 아이디가 필요해요" }, { status: 400 });
    }

    await adminDb().collection("templateInspectLogs").doc(logId).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ServerAuthError) {
      return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
    }
    if (err instanceof AdminForbiddenError) {
      return NextResponse.json({ error: "관리자 권한이 없어요" }, { status: 403 });
    }
    console.error("[팩인백] 어드민 템플릿 로그 삭제 실패:", err);
    return NextResponse.json({ error: "삭제에 실패했어요" }, { status: 500 });
  }
}
