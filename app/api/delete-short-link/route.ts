import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";

// "내가 만든 URL 관리" 모달의 삭제 버튼에서 쓰는 라우트. app/api/update-short-link와 동일한
// 패턴 - shortLinks/customShortLinks는 client read/write가 전부 막혀있어(firestore.rules)
// Admin SDK에서만 지울 수 있고, 생성 시 저장해둔 createdBy와 요청자 uid가 같아야만 통과시켜서
// "만든 사람 본인만 삭제 가능"을 강제한다. DELETE 메서드 대신 POST를 쓰는 이유는 이 프로젝트의
// 다른 변경성 라우트(trash-bag-pack 등)와 규칙을 맞추기 위함.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const kind = (body as { kind?: string })?.kind;
  const code = (body as { code?: string })?.code;
  if ((kind !== "s" && kind !== "c") || !code || typeof code !== "string") {
    return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }

  let uid: string;
  try {
    const verified = await verifyRequestUser(req);
    uid = verified.uid;
  } catch (err) {
    if (err instanceof ServerAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "로그인 정보를 확인할 수 없어요" }, { status: 401 });
  }

  const db = adminDb();
  const col = db.collection(kind === "s" ? "shortLinks" : "customShortLinks");
  const ref = col.doc(code);
  const snap = await ref.get();
  if (!snap.exists) {
    // 이미 지워져 있으면 성공으로 취급 (목록 새로고침 타이밍 경합 등으로 두 번 눌려도 안전하게).
    return NextResponse.json({ ok: true });
  }
  const data = snap.data() ?? {};
  if (data.createdBy !== uid) {
    return NextResponse.json({ error: "본인이 만든 링크만 삭제할 수 있어요" }, { status: 403 });
  }

  try {
    await ref.delete();
  } catch (err) {
    console.error("[팩인백] 짧은/커스텀 URL 삭제 실패:", err);
    return NextResponse.json({ error: "링크 삭제에 실패했어요" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
