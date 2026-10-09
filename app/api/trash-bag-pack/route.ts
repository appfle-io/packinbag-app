import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { recordAuditLog } from "@/lib/auditLog";
import { Pack } from "@/lib/types";
import { stripUndefined, stripServerOnlyPackFields, isSafeDocId } from "@/lib/firestoreSanitize";

// 가방 "안"에서 팩을 삭제했을 때, 그 팩을 완전히 없애버리는 대신 팩 보관함의
// 휴지통(trashedAt)으로 복사해 넣는 라우트. firestore.rules에서 libraryPacks의
// client-side create를 막아뒀기 때문에(allow create: if false), 새 문서 생성은
// app/api/create-library-pack과 마찬가지로 이 라우트(Admin SDK)를 거쳐야 한다.
//
// 원본 가방 쪽 팩 배열에서 지우는 것 자체는 여전히 클라이언트(BagEditorScreen의
// updatePacks)가 직접 처리하고, 이 라우트는 그 "복구용 사본"만 만들어준다 - 그래서
// 이 요청이 실패해도(네트워크 등) 가방에서의 삭제 자체는 이미 끝난 상태로 남는다
// (실패 시 토스트로만 안내, BagEditorScreen 참고).
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const { pack, sourceBagId, sourceBagName } = (body as {
    pack?: Pack;
    sourceBagId?: string;
    sourceBagName?: string;
  }) ?? {};

  if (!pack || !isSafeDocId(pack.id) || typeof pack.name !== "string" || !Array.isArray(pack.items)) {
    return NextResponse.json({ error: "요청 데이터가 올바르지 않아요" }, { status: 400 });
  }
  if (typeof sourceBagId !== "string" || typeof sourceBagName !== "string") {
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

  // 보관함에 같은 id가 이미 있으면(가방에 불러온 보관함 팩 등) 새 id로 사본을 만든다. 예전에는 그 팩을
  // 통째 덮어서, 잠긴 팩을 풀거나(휴지통 → 복구) 다른 팩을 지울 수 있었다(2026-10-09).
  const existing = await packsCol.doc(pack.id).get();
  const targetId = existing.exists ? `${pack.id}-trash-${Date.now()}` : pack.id;

  const now = new Date().toISOString();
  const trashedPack: Pack = {
    ...stripServerOnlyPackFields(pack),
    id: targetId,
    // 가방 안에서 쓰던 라이브러리 연동 필드는 휴지통 사본에는 의미가 없으니 지운다 -
    // 복구되면 그냥 새 라이브러리 팩 하나로 취급된다.
    savedAsLibraryPack: undefined,
    linkedLibraryPackId: undefined,
    linkedLibraryUpdatedAt: undefined,
    createdAt: pack.createdAt ?? now,
    updatedAt: now,
    trashedAt: now,
    trashSourceBagId: sourceBagId.slice(0, 128),
    trashSourceBagName: sourceBagName.slice(0, 60),
  };

  try {
    await packsCol.doc(targetId).set(stripUndefined(trashedPack));
  } catch (err) {
    console.error("[팩인백] 가방 팩 휴지통 이동 실패(서버):", err);
    return NextResponse.json({ error: "휴지통으로 옮기지 못했어요" }, { status: 500 });
  }

  await recordAuditLog({
    uid,
    action: "bag_trash",
    targetType: "bag",
    targetId: sourceBagId,
    meta: { bagName: sourceBagName, packName: pack.name, packId: pack.id },
  });

  return NextResponse.json({ pack: trashedPack });
}
