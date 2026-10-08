import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, isPremiumServer, ServerAuthError } from "@/lib/premiumServer";
import { FREE_MAX_ACTIVE_BAGS } from "@/lib/premiumLimits";
import { Bag, BagMemberProfile } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";
import { serializeBag } from "@/lib/editorDocSerialize";
import { NOTES_VERSION, splitPacksPlain } from "@/lib/bagNotesCore";
import crypto from "crypto";

function generateShareToken(): string {
  return crypto.randomBytes(8).toString("hex"); // 16-char hex token
}

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
// 버그가 있었다. 휴지통으로 보낸(trashedByOwnerAt) 가방도 "동시 진행" 개수에서 제외한다 -
// 휴지통에 있는 가방은 실제로 진행 중인 게 아니기 때문.
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
    // count()로 바로 세지 않고 문서를 가져와서 거르는 이유: 휴지통으로 보낸(trashedByOwnerAt)
    // 가방은 "동시 진행" 개수에 포함되면 안 되는데, count()는 "그 필드가 없는" 문서까지
    // 정확하게 걸러내기 어렵다(예전 데이터는 이 필드 자체가 없을 수 있음). 소유 가방 개수는
    // 많아야 몇 개 수준이라 전체를 가져와도 성능에 문제되지 않는다.
    const existing = await db.collection("bags").where("ownerId", "==", uid).get();
    // 만들기 대기 재시도: 지난번에 이미 만들어졌는데 응답만 못 받은 경우 개수 초과로 거절하지 않고 그대로 돌려준다
    const already = existing.docs.find((d) => d.id === draft.id);
    if (already) {
      return NextResponse.json({ bag: { ...(already.data() as Bag), id: already.id } });
    }
    const activeCount = existing.docs.filter((d) => !(d.data() as Bag).trashedByOwnerAt).length;
    if (activeCount >= FREE_MAX_ACTIVE_BAGS) {
      return NextResponse.json(
        {
          error: `무료로는 가방을 동시에 ${FREE_MAX_ACTIVE_BAGS}개까지만 진행할 수 있어요. 더 만들려면 이용권 코드를 등록해주세요.`,
          code: "BAG_LIMIT_REACHED",
        },
        { status: 403 }
      );
    }
  }

  const now = new Date().toISOString();
  const joinedAt: BagMemberProfile = {
    nickname: ownerProfile.nickname,
    avatarId: ownerProfile.avatarId,
    joinedAt: now,
  };

  const bagRef = db.collection("bags").doc(draft.id);

  try {
    // 트랜잭션 + create로 묶는 이유:
    // 1. draft.id는 클라이언트가 정한다. 예전 batch.set은 같은 id의 가방이 있으면 통째 덮어써서,
    //    남의 bagId만 알면 그 가방을 지우고 자기 것으로 만들 수 있었다.
    //    같은 id가 이미 있고 내 가방이면(만들기 대기 재시도 등) 그대로 돌려주고, 남의 것이면 거부한다.
    // 2. 초대코드가 기존 코드와 겹치면 다른 가방의 코드를 가로채던 것을 막는다.
    const result = await db.runTransaction(async (tx) => {
      const existing = await tx.get(bagRef);
      if (existing.exists) {
        const data = existing.data() as Bag;
        if (data.ownerId === uid) return { kind: "exists" as const, bag: { ...data, id: existing.id } };
        return { kind: "conflict" as const };
      }

      let inviteCode = "";
      for (let i = 0; i < 5; i++) {
        const candidate = generateInviteCode();
        const codeSnap = await tx.get(db.collection("inviteCodes").doc(candidate));
        if (!codeSnap.exists) {
          inviteCode = candidate;
          break;
        }
      }
      if (!inviteCode) throw new Error("초대코드를 만들지 못했어요");

      const finalBag: Bag = {
        ...draft,
        ownerId: uid,
        memberIds: [uid],
        memberProfiles: { [uid]: joinedAt },
        inviteCode,
        publicShareToken: generateShareToken(),
        updatedAt: now,
      };
      // 메모 본문은 가방 문서가 아니라 bags/{id}/notes/{packId}에 따로 쓴다(lib/bagNotesService, 2026-10-08).
      // 샘플·메모로 가방 만들기·오프라인 옮기기·만들기 대기로 들어오는 메모가 여기를 거친다
      const split = splitPacksPlain(finalBag.packs);
      tx.create(
        bagRef,
        stripUndefined(serializeBag({ ...finalBag, packs: split.packs, notesV: NOTES_VERSION, packsRev: 1 })),
      );
      split.notes.forEach((n) =>
        tx.create(bagRef.collection("notes").doc(n.packId), { doc: n.raw, rev: 1, updatedAt: now, updatedBy: uid }),
      );
      tx.create(db.collection("inviteCodes").doc(inviteCode), { bagId: draft.id });
      // 화면에는 본문이 붙은 그대로 돌려준다(열자마자 메모가 보이게)
      return { kind: "created" as const, bag: { ...finalBag, notesV: NOTES_VERSION, packsRev: 1 } };
    });

    if (result.kind === "conflict") {
      return NextResponse.json({ error: "가방 생성에 실패했어요" }, { status: 409 });
    }
    return NextResponse.json({ bag: result.bag });
  } catch (err) {
    console.error("[팩인백] 가방 생성 실패(서버):", err);
    return NextResponse.json({ error: "가방 생성에 실패했어요" }, { status: 500 });
  }
}
