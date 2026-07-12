import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, isPremiumServer, ServerAuthError } from "@/lib/premiumServer";
import { FREE_MAX_LIBRARY_PACKS } from "@/lib/premiumLimits";
import { Pack } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

// 휴지통에 있는 라이브러리 팩을 복구(trashedAt 제거)하는 라우트.
//
// 왜 서버가 필요한가: 복구는 "무료는 라이브러리에 팩 3개까지"라는 제한을 다시 통과해야
// 하는데, 클라이언트에서만 검사하면 devtools로 우회해서 무제한 복구할 수 있다. 그래서
// firestore.rules에서 trashedAt을 값 -> null로 되돌리는 것 자체를 클라이언트가 못 하게
// 막아두고, 복구는 이 라우트(Admin SDK)에서만 가능하게 한다.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const packId = (body as { packId?: string })?.packId;
  if (!packId || typeof packId !== "string") {
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
  const packRef = packsCol.doc(packId);
  const snap = await packRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "팩을 찾을 수 없어요" }, { status: 404 });
  }

  const pack = snap.data() as Pack;
  if (!pack.trashedAt) {
    return NextResponse.json({ error: "이미 복구된 팩이에요" }, { status: 400 });
  }

  const premium = await isPremiumServer(uid, email);
  // 빠른팩(isQuickPack)은 애초에 휴지통으로 보내지 않지만, 방어적으로 여기서도 개수 제한과
  // 무관하게 항상 복구를 허용한다.
  if (!premium && !pack.isQuickPack) {
    const allSnap = await packsCol.get();
    const activeNonQuickCount = allSnap.docs.filter((d) => {
      const data = d.data() as Pack;
      return !data.isQuickPack && !data.trashedAt;
    }).length;
    if (activeNonQuickCount >= FREE_MAX_LIBRARY_PACKS) {
      return NextResponse.json(
        {
          error: `무료로는 팩 라이브러리에 ${FREE_MAX_LIBRARY_PACKS}개까지만 저장할 수 있어요. 더 복구하려면 이용권 코드를 등록해주세요.`,
          code: "PACK_LIMIT_REACHED",
        },
        { status: 403 }
      );
    }
  }

  try {
    await packRef.update({
      trashedAt: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[팩인백] 팩 복구 실패(서버):", err);
    return NextResponse.json({ error: "팩 복구에 실패했어요" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
