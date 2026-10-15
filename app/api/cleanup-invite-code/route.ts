import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";

// 가방을 완전히 지운 뒤 남은 초대코드 문서(inviteCodes/{code}) 정리(2026-10-15, share.md 확인 필요 4).
// inviteCodes는 규칙상 클라이언트가 지울 수 없어(delete false) 예전에는 주인 없는 문서가 쌓였다.
// 가리키는 가방이 **이미 없을 때만** 지운다 - 가방이 남아 있으면(다른 멤버가 쓰는 중 등) 아무것도 하지 않는다.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await verifyRequestUser(req);
  } catch (err) {
    const message = err instanceof ServerAuthError ? err.message : "로그인이 필요해요";
    return NextResponse.json({ error: message }, { status: 401 });
  }
  let code = "";
  try {
    const body = (await req.json()) as { code?: unknown };
    code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  } catch {}
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return NextResponse.json({ removed: false });

  const db = adminDb();
  try {
    const ref = db.collection("inviteCodes").doc(code);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ removed: false });
    const bagId = snap.data()?.bagId as string | undefined;
    if (bagId) {
      const bag = await db.collection("bags").doc(bagId).get();
      // 가방이 남아 있고 지금도 이 코드를 쓰면 지우지 않는다
      if (bag.exists && (bag.data()?.inviteCode as string | undefined)?.toUpperCase() === code) {
        return NextResponse.json({ removed: false });
      }
    }
    await ref.delete();
    return NextResponse.json({ removed: true });
  } catch (err) {
    console.error("[팩인백] 초대코드 정리 실패:", err);
    return NextResponse.json({ removed: false }, { status: 500 });
  }
}
