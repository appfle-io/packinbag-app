import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireMasterUser, AdminForbiddenError, ServerAuthError } from "@/lib/adminApiAuth";
import type { Query } from "firebase-admin/firestore";

export const runtime = "nodejs";

// 마스터(운영자) 전용. CS 문의 대응 시 "이 유저가 최근에 뭘 했는지" 확인하는 화면에서 쓴다.
// ?uid=로 특정 유저만 필터할 수 있고, 없으면 전체 최신순으로 반환한다.
export async function GET(req: NextRequest) {
  try {
    await requireMasterUser(req);
  } catch (err) {
    if (err instanceof AdminForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ServerAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "로그인 정보를 확인할 수 없어요" }, { status: 401 });
  }

  const uid = req.nextUrl.searchParams.get("uid")?.trim() || null;
  const limitParam = parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(200, Math.max(1, isNaN(limitParam) ? 50 : limitParam));

  try {
    const db = adminDb();
    let query: Query = db.collection("auditLogs").orderBy("createdAt", "desc").limit(limit);
    if (uid) {
      query = db
        .collection("auditLogs")
        .where("uid", "==", uid)
        .orderBy("createdAt", "desc")
        .limit(limit);
    }
    const snap = await query.get();
    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ logs });
  } catch (err) {
    console.error("[팩인백] 감사 로그 조회 실패:", err);
    return NextResponse.json({ error: "로그를 불러오지 못했어요" }, { status: 500 });
  }
}
