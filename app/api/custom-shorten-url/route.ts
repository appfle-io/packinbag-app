import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { checkShortLinkQuota, consumeShortLinkQuota, SHORT_LINK_LIMIT_MESSAGE } from "@/lib/shortLinkRateLimit";

// 짐/메모 텍스트에 붙여넣은 긴 URL을 사용자가 직접 고른 코드로 커스텀 링크(/c/{code})로
// 바꿔주는 라우트. app/api/shorten-url(랜덤 코드 자동생성)과 같은 패턴이지만, 코드를
// 클라이언트가 지정하고 서버에서 형식/중복을 검증한다는 점만 다르다.
// customShortLinks 컬렉션도 shortLinks와 동일하게 firestore.rules에서 client read/write를
// 전부 막아뒀다 - 생성은 여기(Admin SDK), 조회(리다이렉트)는 app/c/[code]/route.ts에서만 한다.
export const runtime = "nodejs";

// lib/shortLinkService.ts의 CUSTOM_CODE_REGEX/RESERVED_CUSTOM_CODES와 반드시 동일하게 유지할 것
// (클라이언트 lib를 그대로 import하지 않는 이유: 이 파일은 서버 전용 런타임이라 별도 상수로
// 복제해두는 편이 lib 쪽에 클라이언트 전용 코드가 섞이는 것을 막는다).
const CUSTOM_CODE_REGEX = /^[a-zA-Z0-9_\-\uAC00-\uD7A3]{2,20}$/;
const RESERVED_CUSTOM_CODES = new Set([
  "s",
  "c",
  "api",
  "admin",
  "privacy",
  "support",
  "favicon.ico",
  "manifest",
]);

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const longUrl = (body as { longUrl?: string })?.longUrl;
  const rawCode = (body as { code?: string })?.code;

  if (!longUrl || typeof longUrl !== "string" || !isHttpUrl(longUrl)) {
    return NextResponse.json({ error: "올바른 URL이 아니에요" }, { status: 400 });
  }
  // 우리 서비스의 숏/커스텀 URL을 또 축약하려는 경우 무한 리다이렉트로 이어질 수 있어 막는다.
  if (/\/(s|c)\/[^/\s]+\/?$/.test(longUrl)) {
    return NextResponse.json({ error: "이미 축약된 링크예요" }, { status: 400 });
  }

  // 표시 이름(label)은 선택 입력 - 비어있으면 null로 저장해서, 화면에서는 링크 그대로
  // (shortUrl 텍스트)를 보여주게 한다(lib/linkLabelCache.ts). 60자를 넘으면 자른다(모달
  // 쪽에서 이미 lib/shortLinkService.ts의 validateLinkLabel로 막지만, 여기서도 한번 더 방어).
  const rawLabel = (body as { label?: string })?.label;
  const label = typeof rawLabel === "string" && rawLabel.trim() ? rawLabel.trim().slice(0, 60) : null;

  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!CUSTOM_CODE_REGEX.test(code)) {
    return NextResponse.json(
      { error: "한글/영문/숫자/하이픈(-)/밑줄(_)만 사용하고, 2~20자로 입력해주세요" },
      { status: 400 }
    );
  }
  if (RESERVED_CUSTOM_CODES.has(code.toLowerCase())) {
    return NextResponse.json({ error: "사용할 수 없는 URL이에요" }, { status: 400 });
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

  const quota = await checkShortLinkQuota(uid);
  if (!quota.allowed) {
    return NextResponse.json({ error: SHORT_LINK_LIMIT_MESSAGE }, { status: 429 });
  }

  const db = adminDb();
  const col = db.collection("customShortLinks");

  const existing = await col.doc(code).get();
  if (existing.exists) {
    return NextResponse.json({ error: "이미 사용 중인 URL이에요" }, { status: 409 });
  }

  try {
    await col.doc(code).set({
      longUrl,
      label,
      createdBy: uid,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[팩인백] 커스텀 URL 생성 실패(서버):", err);
    return NextResponse.json({ error: "링크 생성에 실패했어요" }, { status: 500 });
  }

  await consumeShortLinkQuota(uid);

  // 짧은 URL과 동일하게 SHORT_URL_BASE_URL 환경변수가 있으면 그걸, 없으면 요청 도메인을 쓴다.
  const configuredBase = process.env.SHORT_URL_BASE_URL?.trim().replace(/\/+$/, "");
  const origin = configuredBase || req.nextUrl.origin;
  // 한글 코드를 encodeURIComponent하면 %EB%B0%B1... 식으로 보기 싫어지는 URL이 되니(복사/공유용으로 쓰기 불편),
  // 한글을 그대로 넣은다 - 현대 브라우저는 이런 IRI(유니코드 경로)를 그대로 널리링/네비게이션할 수 있고,
  // 실제 발송 시에만 자동으로 퍼센트 인코딩되므로 app/c/[code]/route.ts에서는 그대로 디코딩되어 도착한다.
  return NextResponse.json({ code, shortUrl: `${origin}/c/${code}`, label });
}
