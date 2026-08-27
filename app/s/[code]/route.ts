import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// 숏 URL(/s/{code})로 들어오면 shortLinks/{code} 문서를 조회해 원본 링크로 리다이렉트한다.
// 클라이언트는 shortLinks 컬렉션을 직접 읽을 수 없으므로(firestore.rules) 이 라우트를
// 거쳐야만 원본 주소를 알 수 있다.
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const db = adminDb();
  const snap = await db.collection("shortLinks").doc(code).get();

  const longUrl = snap.exists ? (snap.data()?.longUrl as string | undefined) : undefined;
  if (!longUrl) {
    // 존재하지 않거나 삭제된 링크는 홈으로 보내고 쿼리로 표시만 남긴다.
    return NextResponse.redirect(new URL("/?shortlink=notfound", req.url));
  }

  return NextResponse.redirect(longUrl, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
