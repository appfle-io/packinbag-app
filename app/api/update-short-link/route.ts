import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";

// 본인이 만든 짧은/커스텀 URL의 표시 이름(label)·원본 주소(longUrl)를 수정하는 라우트.
// shortLinks/customShortLinks 둘 다 firestore.rules에서 client read/write를 전부 막아뒀으므로
// (app/api/shorten-url 등과 동일한 이유) 수정도 여기(Admin SDK)에서만 가능하다. 생성 시
// 저장해둔 createdBy와 요청자 uid가 같아야만 통과시켜서 "만든 사람 본인만 수정 가능"을
// 강제한다. 코드(주소 뒷부분) 자체는 이 라우트로 바꿀 수 없다 - 이미 공유된 링크가 깨지지
// 않아야 하므로, longUrl/label만 독립적으로 수정 가능하다.
export const runtime = "nodejs";

const LABEL_MAX_LENGTH = 60;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const kind = (body as { kind?: string })?.kind;
  const code = (body as { code?: string })?.code;
  const rawLabel = (body as { label?: string })?.label;
  const rawLongUrl = (body as { longUrl?: string })?.longUrl;

  if ((kind !== "s" && kind !== "c") || !code || typeof code !== "string") {
    return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof rawLabel === "string") {
    const trimmed = rawLabel.trim();
    if (trimmed.length > LABEL_MAX_LENGTH) {
      return NextResponse.json(
        { error: `표시 이름은 ${LABEL_MAX_LENGTH}자 이하로 입력해주세요` },
        { status: 400 }
      );
    }
    updates.label = trimmed || null;
  }
  if (typeof rawLongUrl === "string") {
    if (!isHttpUrl(rawLongUrl)) {
      return NextResponse.json({ error: "올바른 URL이 아니에요" }, { status: 400 });
    }
    if (/\/(s|c)\/[^/\s]+\/?$/.test(rawLongUrl)) {
      return NextResponse.json({ error: "이미 축약된 링크예요" }, { status: 400 });
    }
    updates.longUrl = rawLongUrl;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "수정할 내용이 없어요" }, { status: 400 });
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
    return NextResponse.json({ error: "존재하지 않는 링크예요" }, { status: 404 });
  }
  const data = snap.data() ?? {};
  if (data.createdBy !== uid) {
    return NextResponse.json({ error: "본인이 만든 링크만 수정할 수 있어요" }, { status: 403 });
  }

  updates.updatedAt = new Date().toISOString();
  try {
    await ref.set(updates, { merge: true });
  } catch (err) {
    console.error("[팩인백] 짧은/커스텀 URL 수정 실패:", err);
    return NextResponse.json({ error: "링크 수정에 실패했어요" }, { status: 500 });
  }

  return NextResponse.json({
    label:
      "label" in updates ? (updates.label as string | null) : (data.label as string | null | undefined) ?? null,
    longUrl: (updates.longUrl as string | undefined) ?? (data.longUrl as string),
  });
}
