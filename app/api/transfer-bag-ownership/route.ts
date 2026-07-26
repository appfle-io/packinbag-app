import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { syncOwnedBagLocks } from "@/lib/bagLockSync";

// 그룹장(소유자) 위임 전용 라우트. ownerId를 바꾸는 것 자체는 firestore.rules로만 안전하게
// 막기가 까다로워서(누가 "지금 소유자"인지 규칙 안에서 검증하려면 이전 값 대비 필드 하나만
// 바뀌는지 등 여러 조건이 겹쳐야 함) 반드시 이 서버 라우트(Admin SDK)를 통해서만 가능하게
// 한다. firestore.rules의 일반 update 규칙은 여전히 클라이언트가 ownerId를 직접 못 건드리게
// 별도로 막혀 있다(방어 목적) - 실제 위임은 항상 이 라우트를 거친다.
//
// 위임 시 이전 소유자/새 소유자 양쪽 다 "내가 소유한 가방 개수"가 바뀌므로, 두 사람 모두의
// 잠금 상태(locked)를 여기서 함께 재계산한다(app/api/sync-lock-status와 동일한 로직을
// lib/bagLockSync.ts로 공유해서 재사용).
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const bagId = (body as { bagId?: unknown })?.bagId;
  const targetUid = (body as { targetUid?: unknown })?.targetUid;
  if (typeof bagId !== "string" || !bagId || typeof targetUid !== "string" || !targetUid) {
    return NextResponse.json({ error: "가방/대상을 확인할 수 없어요" }, { status: 400 });
  }

  const db = adminDb();

  try {
    const bagRef = db.collection("bags").doc(bagId);
    const bagSnap = await bagRef.get();
    if (!bagSnap.exists) {
      return NextResponse.json({ error: "가방을 찾을 수 없어요" }, { status: 404 });
    }
    const bagData = bagSnap.data() ?? {};
    const currentOwnerId = bagData.ownerId as string | undefined;
    const memberIds = (bagData.memberIds as string[] | undefined) ?? [];

    if (currentOwnerId !== uid) {
      return NextResponse.json({ error: "그룹장만 위임할 수 있어요" }, { status: 403 });
    }
    if (targetUid === uid) {
      return NextResponse.json({ error: "이미 그룹장이에요" }, { status: 400 });
    }
    if (!memberIds.includes(targetUid)) {
      return NextResponse.json({ error: "이 가방의 그룹원에게만 위임할 수 있어요" }, { status: 400 });
    }

    await bagRef.update({ ownerId: targetUid, updatedAt: new Date().toISOString() });

    // 이전 소유자/새 소유자 둘 다 소유 가방 개수가 바뀌었으니 각자의 잠금 상태를 다시 계산한다.
    // 한쪽이 실패해도(예: 탈퇴한 계정 등) 위임 자체는 이미 반영됐으므로 전체 요청은 성공으로
    // 응답하고, 재계산 실패만 로그로 남긴다.
    await Promise.all([
      syncOwnedBagLocks(uid).catch((err) => {
        console.warn("[팩인백] 위임 후 이전 소유자 잠금 재계산 실패:", err);
      }),
      syncOwnedBagLocks(targetUid).catch((err) => {
        console.warn("[팩인백] 위임 후 새 소유자 잠금 재계산 실패:", err);
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[팩인백] 그룹장 위임 실패:", err);
    return NextResponse.json({ error: "그룹장 위임에 실패했어요" }, { status: 500 });
  }
}
