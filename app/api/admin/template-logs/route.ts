import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { isMasterEmail } from "@/lib/masterEmails";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (!isMasterEmail(decoded.email)) {
      return NextResponse.json({ error: "관리자 권한이 없어요" }, { status: 403 });
    }

    const snapshot = await adminDb()
      .collection("templateInspectLogs")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const logs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ logs });
  } catch (err) {
    console.error("[팩인백] 어드민 템플릿 로그 조회 실패:", err);
    return NextResponse.json({ error: "조회에 실패했어요" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (!isMasterEmail(decoded.email)) {
      return NextResponse.json({ error: "관리자 권한이 없어요" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const logId = searchParams.get("id");
    if (!logId) {
      return NextResponse.json({ error: "삭제할 아이디가 필요해요" }, { status: 400 });
    }

    await adminDb().collection("templateInspectLogs").doc(logId).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[팩인백] 어드민 템플릿 로그 삭제 실패:", err);
    return NextResponse.json({ error: "삭제에 실패했어요" }, { status: 500 });
  }
}
