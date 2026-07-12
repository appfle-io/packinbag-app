import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, isPremiumServer, ServerAuthError } from "@/lib/premiumServer";
import { FREE_MAX_LIBRARY_PACKS } from "@/lib/premiumLimits";
import { Pack } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";

// 팩 라이브러리에 "새 팩"을 만드는 것만 서버에서 처리하도록 만든 라우트 (이미 있는 팩을
// 고치는 건 여전히 클라이언트가 직접 한다 - lib/packsService.ts의 자동저장 참고).
//
// 왜 새 팩만 서버로 옮겼나: 기존 팩 수정은 0.5초 디바운스 자동저장이라, 만약 저장마다
// 서버 검증을 거치면 무료 제한에 걸린 사람이 아니어도 매 타이핑마다 왕복이 생긴다.
// "새로 만들 때 개수 제한을 넘는지"만 확인하면 되므로, 생성 시점 1회만 이 라우트를 타고
// 이후 수정은 계속 클라이언트가 처리한다. firestore.rules에서 libraryPacks의
// client-side create는 막아뒀다(allow create: if false).
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

  const premium = await isPremiumServer(uid, email);
  // 빠른팩(isQuickPack)은 무료 라이브러리 개수 제한과 무관하게 항상 생성을 허용한다 -
  // 사용자당 최대 1개뿐이고, 하단 "+" 빠른입력에서 최초 1회 만들어지는 시스템 팩이다.
  if (!premium && !draft.isQuickPack) {
    // 휴지통으로 보낸(trashedAt) 팩은 라이브러리 개수 제한에 포함시키지 않는다 - 실제로
    // 보관 중인 게 아니기 때문. count()로는 이 조건을 정확히 걸러내기 어려워서(예전 데이터는
    // 필드 자체가 없을 수 있음) 문서를 가져와 코드에서 거른다.
    const allSnap = await packsCol.get();
    const nonQuickCount = allSnap.docs.filter((d) => {
      const data = d.data() as Pack;
      return !data.isQuickPack && !data.trashedAt;
    }).length;
    if (nonQuickCount >= FREE_MAX_LIBRARY_PACKS) {
      return NextResponse.json(
        {
          error: `무료로는 팩 라이브러리에 ${FREE_MAX_LIBRARY_PACKS}개까지만 저장할 수 있어요. 더 저장하려면 이용권 코드를 등록해주세요.`,
          code: "PACK_LIMIT_REACHED",
        },
        { status: 403 }
      );
    }
  }

  const now = draft.updatedAt ?? new Date().toISOString();
  const finalPack: Pack = { ...draft, createdAt: draft.createdAt ?? now, updatedAt: now };

  try {
    await packsCol.doc(draft.id).set(stripUndefined(finalPack));
  } catch (err) {
    console.error("[팩인백] 라이브러리 팩 생성 실패(서버):", err);
    return NextResponse.json({ error: "팩 저장에 실패했어요" }, { status: 500 });
  }

  return NextResponse.json({ pack: finalPack });
}
