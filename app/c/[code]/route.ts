import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// 커스텀 URL(/c/{code})로 들어오면 customShortLinks/{code} 문서를 조회해 원본 링크로
// 리다이렉트한다. app/s/[code]/route.ts(랜덤 코드 숏 URL)와 동일한 구조이고, 컬렉션만 다르다.
// 클라이언트는 customShortLinks 컬렉션을 직접 읽을 수 없으므로(firestore.rules) 이 라우트를
// 거쳐야만 원본 주소를 알 수 있다.
export const runtime = "nodejs";

// 2026-10-12 보안 점검: /s와 같은 이유로 코드 길이 검사, http(s)만 따라가기, 캐시 5분
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
  const snap = await db.collection("customShortLinks").doc(code).get();

  const longUrl = snap.exists ? (snap.data()?.longUrl as string | undefined) : undefined;
  if (!longUrl || !isHttpUrl(longUrl)) return notFound(req);

  return NextResponse.redirect(longUrl, {
    headers: { "Cache-Control": REDIRECT_CACHE },
  });
}
