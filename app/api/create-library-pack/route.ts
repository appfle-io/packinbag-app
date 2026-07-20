import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { Pack } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";

// 팩 보관함에 "새 팩/폴더"를 만드는 것만 서버에서 처리하도록 만든 라우트 (이미 있는 팩을
// 고치는 건 여전히 클라이언트가 직접 한다 - lib/packsService.ts의 자동저장 참고).
//
// v68 이후: 팩 개수 제한(FREE_MAX_LIBRARY_PACKS)은 폐지되었지만, firestore.rules에서
// libraryPacks의 client-side create는 여전히 막아뒀어서(allow create: if false) 새 팩/폴더
// 생성은 계속 이 라우트(Admin SDK)를 거쳐야 한다.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const draft = (body as { pack?: Pack })?.pack;
  if (!draft?.id || typeof draft.name !== "string" || !Array.isArray(draft.items)) {
    return NextResponse.json({ error: "요청 데이터가 올바르지 않아요" }, { status: 400 });
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
  const packsCol = db.collection("users").doc(uid).collection("libraryPacks");

  const now = draft.updatedAt ?? new Date().toISOString();
  const finalPack: Pack = { ...draft, createdAt: draft.createdAt ?? now, updatedAt: now };

  try {
    await packsCol.doc(draft.id).set(stripUndefined(finalPack));
  } catch (err) {
    console.error("[팩인백] 보관함 팩 생성 실패(서버):", err);
    return NextResponse.json({ error: "팩 저장에 실패했어요" }, { status: 500 });
  }

  return NextResponse.json({ pack: finalPack });
}
