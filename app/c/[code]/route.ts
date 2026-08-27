import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// 커스텀 URL(/c/{code})로 들어오면 customShortLinks/{code} 문서를 조회해 원본 링크로
// 리다이렉트한다. app/s/[code]/route.ts(랜덤 코드 숏 URL)와 동일한 구조이고, 컬렉션만 다르다.
// 클라이언트는 customShortLinks 컬렉션을 직접 읽을 수 없으므로(firestore.rules) 이 라우트를
// 거쳐야만 원본 주소를 알 수 있다.
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const db = adminDb();
  const snap = await db.collection("customShortLinks").doc(code).get();

  const longUrl = snap.exists ? (snap.data()?.longUrl as string | undefined) : undefined;
  if (!longUrl) {
    return NextResponse.redirect(new URL("/?shortlink=notfound", req.url));
  }

  return NextResponse.redirect(longUrl, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
