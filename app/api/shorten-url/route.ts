import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { checkShortLinkQuota, consumeShortLinkQuota, SHORT_LINK_LIMIT_MESSAGE } from "@/lib/shortLinkRateLimit";

// 짐/메모 텍스트에 붙여넣은 긴 URL을 짧은 링크(/s/{code})로 바꿔주는 라우트.
// shortLinks 컬렉션은 firestore.rules에서 client read/write를 전부 막아뒀다(코드 추측으로
// 다른 사람의 링크를 조회하거나, 아무나 링크를 마음대로 등록/변조하지 못하게 하기 위함) -
// 그래서 생성은 여기(Admin SDK), 조회(리다이렉트)는 app/s/[code]/route.ts에서만 한다.
export const runtime = "nodejs";

const CODE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 7;

function generateShortCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

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
  if (!longUrl || typeof longUrl !== "string" || !isHttpUrl(longUrl)) {
    return NextResponse.json({ error: "올바른 URL이 아니에요" }, { status: 400 });
  }
  // 표시 이름(label)은 선택 입력 - 비어있으면 null로 저장해서, 화면에서는 링크 그대로
  // (shortUrl 텍스트)를 보여주게 한다(lib/linkLabelCache.ts). 60자를 넘으면 자른다(모달
  // 쪽에서 이미 lib/shortLinkService.ts의 validateLinkLabel로 막지만, 여기서도 한번 더 방어).
  const rawLabel = (body as { label?: string })?.label;
  const label = typeof rawLabel === "string" && rawLabel.trim() ? rawLabel.trim().slice(0, 60) : null;
  // 우리 서비스의 숏 URL을 또 축약하려는 경우 무한 리다이렉트로 이어질 수 있어 막는다.
  if (/\/s\/[a-zA-Z0-9]+\/?$/.test(longUrl)) {
    return NextResponse.json({ error: "이미 축약된 링크예요" }, { status: 400 });
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
  const col = db.collection("shortLinks");

  // 같은 코드가 이미 존재할 극히 드문 충돌 상황을 대비해 몇 번 재시도한다.
  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateShortCode();
    const existing = await col.doc(candidate).get();
    if (!existing.exists) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    return NextResponse.json(
      { error: "링크 생성에 실패했어요. 다시 시도해주세요" },
      { status: 500 }
    );
  }

  try {
    await col.doc(code).set({
      longUrl,
      label,
      createdBy: uid,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[팩인백] 숏 URL 생성 실패(서버):", err);
    return NextResponse.json({ error: "링크 생성에 실패했어요" }, { status: 500 });
  }

  await consumeShortLinkQuota(uid);

  // 짧은 URL은 기본 도메인(packinbag.seeuson.com)보다 더 짧은 전용 도메인(short.seeuson.com 등)을
  // 쓰고 싶을 수 있어서, 환경변수 SHORT_URL_BASE_URL(Vercel 환경변수)이 있으면 그것을, 없으면
  // 요청이 들어온 도메인(req.nextUrl.origin)을 쓴다. Vercel 프로젝트에 그 도메인을 별도 도메인으로
  // 추가해두면 이 값을 그대로 따라간다.
  const configuredBase = process.env.SHORT_URL_BASE_URL?.trim().replace(/\/+$/, "");
  const origin = configuredBase || req.nextUrl.origin;
  return NextResponse.json({ code, shortUrl: `${origin}/s/${code}`, label });
}
