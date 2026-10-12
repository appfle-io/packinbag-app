import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// 숏 URL(/s/{code})로 들어오면 shortLinks/{code} 문서를 조회해 원본 링크로 리다이렉트한다.
// 클라이언트는 shortLinks 컬렉션을 직접 읽을 수 없으므로(firestore.rules) 이 라우트를
// 거쳐야만 원본 주소를 알 수 있다.
export const runtime = "nodejs";

// 2026-10-12 보안 점검
// - 문서 id로 쓸 수 없는 값(너무 긴 값)은 Firestore가 예외를 던져 500이 났다 → 바로 홈으로
// - 저장된 주소가 http(s)가 아니면(예전 데이터 등) 따라가지 않는다(javascript: 등 차단)
// - 캐시를 하루 → 5분으로. 주소를 고치거나 링크를 지워도 하루 동안 옛 주소로 가던 문제
const MAX_CODE_LENGTH = 40;
const REDIRECT_CACHE = "public, s-maxage=300, stale-while-revalidate=60";

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function notFound(req: NextRequest) {
  // 존재하지 않거나 삭제된 링크는 홈으로 보내고 쿼리로 표시만 남긴다.
  return NextResponse.redirect(new URL("/?shortlink=notfound", req.url), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!code || code.length > MAX_CODE_LENGTH || code.includes("/")) return notFound(req);

  const db = adminDb();
  const snap = await db.collection("shortLinks").doc(code).get();

  const longUrl = snap.exists ? (snap.data()?.longUrl as string | undefined) : undefined;
  if (!longUrl || !isHttpUrl(longUrl)) return notFound(req);

  return NextResponse.redirect(longUrl, {
    headers: { "Cache-Control": REDIRECT_CACHE },
  });
}
