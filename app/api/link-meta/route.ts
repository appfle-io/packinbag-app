import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// 짧은/커스텀 URL의 표시 이름(label)·원본 주소(longUrl)를 조회하는 공개 라우트. 링크를
// 렌더링하는 곳(components/LinkifiedText.tsx, components/screens/PackNoteEditorScreen.tsx)이
// 화면에 어떤 이름으로 보여줄지 결정하려고 부른다. 리다이렉트(app/s,c/[code]/route.ts)가 이미
// longUrl을 인증 없이 공개로 알려주고 있으므로 여기서 longUrl을 공개하는 것 자체는 새로운
// 노출이 아니다 - 다만 "이 링크가 내가 만든 게 맞는지"(canEdit)는 Authorization 헤더가 있고
// 검증에 성공했을 때만 계산한다.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind");
  const code = req.nextUrl.searchParams.get("code");
  if ((kind !== "s" && kind !== "c") || !code) {
    return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }

  const db = adminDb();
  const col = db.collection(kind === "s" ? "shortLinks" : "customShortLinks");
  const snap = await col.doc(code).get();
  const data = snap.exists ? snap.data() ?? {} : {};
  const longUrl = data.longUrl as string | undefined;
  if (!longUrl) {
    return NextResponse.json({ error: "존재하지 않는 링크예요" }, { status: 404 });
  }

  // Authorization 헤더가 있으면 검증해서 canEdit을 계산한다. 없거나 검증에 실패해도(예:
  // 로그아웃 상태, 만료된 토큰) 이 라우트 자체는 공개 조회라 에러 없이 canEdit: false로
  // 내려준다.
  let canEdit = false;
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (idToken) {
    try {
      const decoded = await adminAuth().verifyIdToken(idToken);
      canEdit = decoded.uid === data.createdBy;
    } catch {
      canEdit = false;
    }
  }

  return NextResponse.json({
    label: (data.label as string | null | undefined) ?? null,
    longUrl,
    canEdit,
  });
}
