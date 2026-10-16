import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
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

    // 보여 주는 이메일 · 가입 시각은 Auth 계정 값(2026-10-16, admin.md 확인 필요 1).
    // users 문서의 email · createdAt은 본인이 바꿀 수 있어 믿지 않는다. 단, 순서 · 페이지 나누기는 여전히 문서 createdAt(색인)
    const authByUid = new Map<string, { email: string | null; createdAt: string | null }>();
    let authFailed = false;
    if (docs.length > 0) {
      try {
        const result = await adminAuth().getUsers(docs.map((d) => ({ uid: d.id })));
        result.users.forEach((u) => {
          const created = u.metadata.creationTime ? new Date(u.metadata.creationTime) : null;
          authByUid.set(u.uid, {
            email: u.email ?? null,
            createdAt: created && !Number.isNaN(created.getTime()) ? created.toISOString() : null,
          });
        });
      } catch (err) {
        console.error("[팩인백] 유저 목록 Auth 조회 실패:", err);
        authFailed = true;
      }
    }

    const users = docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt as { toDate?: () => Date } | null | undefined;
      const docCreatedIso =
        createdAt && typeof createdAt.toDate === "function" ? createdAt.toDate().toISOString() : null;
      const auth = authByUid.get(doc.id);
      return {
        uid: doc.id,
        // Auth에 없는 계정(탈퇴 중 남은 문서 등)은 이메일을 비운다. Auth 조회 자체가 실패하면 문서 값으로(목록이 통째로 비지 않게)
        email: auth ? auth.email : authFailed ? ((data.email as string | null) ?? null) : null,
        nickname: (data.nickname as string | null) ?? null,
        createdAt: auth?.createdAt ?? docCreatedIso,
      };
    });

    // 다음 페이지 기준은 문서 createdAt
    const lastDocCreated = docs[docs.length - 1]?.data().createdAt as { toDate?: () => Date } | null | undefined;
    const nextCursor =
      hasMore && lastDocCreated && typeof lastDocCreated.toDate === "function" ? lastDocCreated.toDate().toISOString() : null;

    return NextResponse.json({ users, nextCursor });
  } catch (err) {
    console.error("[팩인백] 유저 목록 조회 실패:", err);
    return NextResponse.json({ error: "유저 목록을 불러오지 못했어요" }, { status: 500 });
  }
}
