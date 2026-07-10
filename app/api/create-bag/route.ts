import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, isPremiumServer, ServerAuthError } from "@/lib/premiumServer";
import { FREE_MAX_ACTIVE_BAGS } from "@/lib/premiumLimits";
import { Bag, BagMemberProfile } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";

// 가방 생성을 서버에서만 처리하도록 만든 라우트.
//
// 왜 서버가 필요한가: "무료는 내가 소유한 가방 3개까지" 제한을 클라이언트에서만 검사하면,
// devtools로 직접 Firestore에 write하거나 검사 코드를 건너뛰어 무제한으로 만들 수 있다.
// 그래서 firestore.rules에서 bags 컬렉션의 client-side create를 막아두고(allow create:
// if false), 실제 생성은 이 라우트(Admin SDK, 클라이언트가 우회 불가)만 할 수 있게 한다.
// 가방 수정(updateDoc)/삭제는 기존처럼 클라이언트가 직접 해도 되므로 그대로 둔다.
//
// 카운트 기준: ownerId(내가 만든 가방)만 센다 - lib/premiumLimits.ts의 computeLockedBagIds
// (무료 전환 후 초과분 잠금 로직)와 동일한 기준으로 맞춰뒀다. 예전엔 memberIds
// array-contains로 "내가 속한 모든 가방"(친구가 초대해준 공유 가방 포함)을 셌었는데,
// 그러면 남의 가방에 여러 개 참여만 해도 내가 만든 가방이 0개여도 새 가방을 못 만드는
// 버그가 있었다.
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

  const draft = (body as { bag?: Bag })?.bag;
  const ownerProfile = (body as { ownerProfile?: { nickname?: string; avatarId?: string } })
    ?.ownerProfile;
  if (
    !draft?.id ||
    typeof draft.name !== "string" ||
    !Array.isArray(draft.packs) ||
    !ownerProfile?.nickname ||
    !ownerProfile?.avatarId
  ) {
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

  const premium = await isPremiumServer(uid, email);
  if (!premium) {
    const existing = await db
      .collection("bags")
      .where("ownerId", "==", uid)
      .count()
      .get();
    if (existing.data().count >= FREE_MAX_ACTIVE_BAGS) {
      return NextResponse.json(
        {
          error: `무료로는 가방을 동시에 ${FREE_MAX_ACTIVE_BAGS}개까지만 진행할 수 있어요. 더 만들려면 이용권 코드를 등록해주세요.`,
          code: "BAG_LIMIT_REACHED",
        },
        { status: 403 }
      );
    }
  }

  const inviteCode = generateInviteCode();
  const now = new Date().toISOString();
  const joinedAt: BagMemberProfile = {
    nickname: ownerProfile.nickname,
    avatarId: ownerProfile.avatarId,
    joinedAt: now,
  };

  const finalBag: Bag = {
    ...draft,
    ownerId: uid,
    memberIds: [uid],
    memberProfiles: { [uid]: joinedAt },
    inviteCode,
    updatedAt: now,
  };

  try {
    const batch = db.batch();
    batch.set(db.collection("bags").doc(draft.id), stripUndefined(finalBag));
    batch.set(db.collection("inviteCodes").doc(inviteCode), { bagId: draft.id });
    await batch.commit();
  } catch (err) {
    console.error("[팩인백] 가방 생성 실패(서버):", err);
    return NextResponse.json({ error: "가방 생성에 실패했어요" }, { status: 500 });
  }

  return NextResponse.json({ bag: finalBag });
}
