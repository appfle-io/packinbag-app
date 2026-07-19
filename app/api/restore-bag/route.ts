import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, isPremiumServer, ServerAuthError } from "@/lib/premiumServer";
import { FREE_MAX_ACTIVE_BAGS } from "@/lib/premiumLimits";
import { Bag } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

// 휴지통에 있는 가방을 복구(trashedByOwnerAt 제거)하는 라우트.
//
// 왜 서버가 필요한가: 복구는 "무료는 동시에 가방 3개까지"라는 제한을 다시 통과해야 하는데,
// 클라이언트에서만 검사하면 devtools로 우회해서 무제한 복구할 수 있다. 그래서
// firestore.rules에서 trashedByOwnerAt을 값 -> null로 되돌리는 것 자체를 클라이언트가
// 못 하게 막아두고, 복구는 이 라우트(Admin SDK)에서만 가능하게 한다.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const bagId = (body as { bagId?: string })?.bagId;
  if (!bagId || typeof bagId !== "string") {
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
  const bagRef = db.collection("bags").doc(bagId);
  const snap = await bagRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "가방을 찾을 수 없어요" }, { status: 404 });
  }

  const bag = snap.data() as Bag;
  if (bag.ownerId !== uid) {
    return NextResponse.json({ error: "이 가방을 복구할 권한이 없어요" }, { status: 403 });
  }
  if (!bag.trashedByOwnerAt) {
    return NextResponse.json({ error: "이미 복구된 가방이에요" }, { status: 400 });
  }

  const premium = await isPremiumServer(uid, email);
  if (!premium) {
    // count()는 "휴지통이 아닌 것만" 조건을 쿼리로 걸기 어려워서(예전 데이터는 trashedByOwnerAt
    // 필드 자체가 없을 수 있음), 소유한 가방 전체를 가져와 코드에서 걸러 센다 - 소유 가방
    // 개수는 많아야 몇 개 수준이라 성능에 문제되지 않는다.
    const ownedSnap = await db.collection("bags").where("ownerId", "==", uid).get();
    const activeCount = ownedSnap.docs.filter((d) => !(d.data() as Bag).trashedByOwnerAt).length;
    if (activeCount >= FREE_MAX_ACTIVE_BAGS) {
      return NextResponse.json(
        {
          error: `무료로는 가방을 동시에 ${FREE_MAX_ACTIVE_BAGS}개까지만 진행할 수 있어요. 더 복구하려면 이용권 코드를 등록해주세요.`,
          code: "BAG_LIMIT_REACHED",
        },
        { status: 403 }
      );
    }
  }

  try {
    await bagRef.update({
      trashedByOwnerAt: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[팩인백] 가방 복구 실패(서버):", err);
    return NextResponse.json({ error: "가방 복구에 실패했어요" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
