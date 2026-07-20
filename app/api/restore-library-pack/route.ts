import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { recordAuditLog } from "@/lib/auditLog";
import { Pack } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

// 휴지통에 있는 라이브러리 팩/폴더를 복구(trashedAt 제거)하는 라우트.
//
// 왜 서버가 필요한가: firestore.rules에서 trashedAt을 값 -> null로 되돌리는 것 자체를
// 클라이언트가 못 하게 막아둬서(개수 제한 검증 목적으로 만들어졌던 제약이지만, 팩 개수
// 제한이 폐지된 v68 이후에도 규칙 구조를 그대로 유지하고 있어 이 라우트를 계속 거친다),
// 복구는 이 라우트(Admin SDK)에서만 가능하다.
//
// 폴더를 복구할 때는 클라이언트(lib/packsService.ts의 restoreLibraryEntryRecursive)가
// 하위 팩/폴더 id를 전부 모아서 이 라우트를 여러 번(각 id마다 한 번씩) 호출한다.
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
  const packRef = packsCol.doc(packId);
  const snap = await packRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "팩을 찾을 수 없어요" }, { status: 404 });
  }

  const pack = snap.data() as Pack;
  if (!pack.trashedAt) {
    return NextResponse.json({ error: "이미 복구된 팩이에요" }, { status: 400 });
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

  await recordAuditLog({
    uid,
    action: "library_pack_restore",
    targetType: "libraryPack",
    targetId: packId,
    meta: { packName: pack.name },
  });

  return NextResponse.json({ ok: true });
}
