import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, isPremiumServer, ServerAuthError } from "@/lib/premiumServer";
import { FREE_MAX_LIBRARY_PACKS, QUICK_PACK_ID } from "@/lib/premiumLimits";
import { Pack } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";
import { serializePack } from "@/lib/editorDocSerialize";

// 팩 보관함에 "새 팩/폴더"를 만드는 것을 서버에서 처리하고 무료 한도(10개)를 검증하는 라우트.
// (하단 "+" 빠른입력 시스템 팩은 한도와 무관하게 항상 생성 허용)
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const rawDraft = (body as { pack?: Pack })?.pack;
  if (!rawDraft?.id || typeof rawDraft.name !== "string") {
    return NextResponse.json({ error: "요청 데이터가 올바르지 않아요" }, { status: 400 });
  }

  const draft: Pack = {
    ...rawDraft,
    type: rawDraft.type || "pack",
    items: Array.isArray(rawDraft.items) ? rawDraft.items : [],
  };

  let uid: string;
  let email: string | null;
  try {
    const verified = await verifyRequestUser(req);
    uid = verified.uid;
    email = verified.email;
  } catch (err) {
    if (err instanceof ServerAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "로그인 정보를 확인할 수 없어요" }, { status: 401 });
  }

  const db = adminDb();
  const packsCol = db.collection("users").doc(uid).collection("libraryPacks");

  // 빠른팩은 무료 한도 대상에서 제외
  const isQuick = draft.id === QUICK_PACK_ID || draft.isQuickPack;

  if (!isQuick) {
    const premium = await isPremiumServer(uid, email);
    if (!premium) {
      const snap = await packsCol.get();
      const activeCount = snap.docs.filter((doc) => {
        const d = doc.data();
        return !d.trashedAt && doc.id !== QUICK_PACK_ID && !d.isQuickPack;
      }).length;

      if (activeCount >= FREE_MAX_LIBRARY_PACKS) {
        return NextResponse.json(
          {
            code: "PACK_LIMIT_REACHED",
            error: `무료로는 팩/폴더를 최대 ${FREE_MAX_LIBRARY_PACKS}개까지만 보관할 수 있어요. 더 만들려면 이용권 코드를 등록해주세요.`,
          },
          { status: 403 }
        );
      }
    }
  }

  const now = draft.updatedAt ?? new Date().toISOString();
  const finalPack: Pack = { ...draft, createdAt: draft.createdAt ?? now, updatedAt: now };

  try {
    await packsCol.doc(draft.id).set(stripUndefined(serializePack(finalPack)));
  } catch (err) {
    console.error("[팩인백] 보관함 팩 생성 실패(서버):", err);
    return NextResponse.json({ error: "팩 저장에 실패했어요" }, { status: 500 });
  }

  return NextResponse.json({ pack: finalPack });
}
