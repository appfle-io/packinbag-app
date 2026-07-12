import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { Bag } from "@/lib/types";

// 초대코드 재발급을 서버에서만 처리하도록 만든 라우트.
//
// 왜 서버가 필요한가: firestore.rules의 inviteCodes 컬렉션은 `allow update, delete: if false`
// 라서 클라이언트가 옛 코드 문서를 직접 지울 방법이 없다(예전엔 lib/bagsService.ts가 클라이언트
// deleteDoc을 시도했는데, 이게 항상 permission-denied로 실패하고 try/catch가 조용히 삼켜서
// "재발급했는데도 옛 코드로 계속 참여가 되는" 버그가 있었다). 새 코드 생성 + 가방 문서의
// inviteCode 갱신 + 옛 코드 문서 삭제를 한 번에(Admin SDK로) 처리해야 실제로 무효화된다.
export const runtime = "nodejs";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/O, 1/I 제외
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

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
  const bagRef = db.collection("bags").doc(bagId);
  const snap = await bagRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "가방을 찾을 수 없어요" }, { status: 404 });
  }

  const bag = snap.data() as Bag;
  // 소유자만 재발급 가능 - 다른 그룹원이 함부로 초대코드를 바꿔서 다른 멤버의 초대
  // 링크를 무력화시키는 것을 막는다.
  if (bag.ownerId !== uid) {
    return NextResponse.json(
      { error: "이 가방의 초대코드를 재발급할 권한이 없어요" },
      { status: 403 }
    );
  }

  const oldCode = bag.inviteCode;
  const newCode = generateInviteCode();

  try {
    const batch = db.batch();
    batch.set(db.collection("inviteCodes").doc(newCode), { bagId });
    batch.update(bagRef, { inviteCode: newCode, updatedAt: new Date().toISOString() });
    await batch.commit();

    // 옛 코드는 여기(Admin SDK)에서만 실제로 지울 수 있다 - 실패해도(이미 없는 등) 재발급
    // 자체는 이미 끝났으니 전체 요청을 실패시키지 않는다.
    if (oldCode) {
      await db
        .collection("inviteCodes")
        .doc(oldCode)
        .delete()
        .catch((err) => {
          console.error("[팩인백] 옛 초대코드 삭제 실패:", err);
        });
    }
  } catch (err) {
    console.error("[팩인백] 초대코드 재발급 실패(서버):", err);
    return NextResponse.json({ error: "초대코드 재발급에 실패했어요" }, { status: 500 });
  }

  return NextResponse.json({ inviteCode: newCode });
}
