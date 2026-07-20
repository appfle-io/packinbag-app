import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireMasterUser, AdminForbiddenError, ServerAuthError } from "@/lib/adminApiAuth";

export const runtime = "nodejs";

// 마스터(운영자) 전용. 대시보드의 "총 가입자"/"최근 7일 신규 가입" 카드를 눌렀을 때 뜨는
// 페이징 모달용 유저 목록 API. createdAt 내림차순으로 페이징하고(cursor = 마지막으로 받은
// createdAt의 ISO 문자열), newOnly=1이면 최근 7일 이내 가입자만 필터링한다.
const PAGE_SIZE = 20;

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

  const newOnly = req.nextUrl.searchParams.get("newOnly") === "1";
  const cursor = req.nextUrl.searchParams.get("cursor");

  try {
    const db = adminDb();
    let query = db.collection("users").orderBy("createdAt", "desc").limit(PAGE_SIZE + 1);

    if (newOnly) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      query = db
        .collection("users")
        .where("createdAt", ">=", sevenDaysAgo)
        .orderBy("createdAt", "desc")
        .limit(PAGE_SIZE + 1);
    }

    if (cursor) {
      query = query.startAfter(new Date(cursor));
    }

    const snap = await query.get();
    const docs = snap.docs.slice(0, PAGE_SIZE);
    const hasMore = snap.docs.length > PAGE_SIZE;

    const users = docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt as { toDate?: () => Date } | null | undefined;
      const createdAtIso =
        createdAt && typeof createdAt.toDate === "function" ? createdAt.toDate().toISOString() : null;
      return {
        uid: doc.id,
        email: (data.email as string | null) ?? null,
        nickname: (data.nickname as string | null) ?? null,
        createdAt: createdAtIso,
      };
    });

    const nextCursor = hasMore ? users[users.length - 1]?.createdAt : null;

    return NextResponse.json({ users, nextCursor });
  } catch (err) {
    console.error("[팩인백] 유저 목록 조회 실패:", err);
    return NextResponse.json({ error: "유저 목록을 불러오지 못했어요" }, { status: 500 });
  }
}
