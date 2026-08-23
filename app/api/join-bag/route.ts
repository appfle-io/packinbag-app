import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, isPremiumServer, ServerAuthError } from "@/lib/premiumServer";
import { FREE_MAX_JOINED_BAGS } from "@/lib/premiumLimits";
import { BagMemberProfile } from "@/lib/types";

export const runtime = "nodejs";

/**
 * 초대 코드로 가방에 참여하는 서버 API 라우트.
 *
 * 왜 서버에서 처리하는가:
 * 1. 무료 회원의 "초대받은 가방 최대 3개" 제한을 클라이언트가 devtools로 우회하여
 *    무제한으로 참여하는 것을 원천 차단하기 위함.
 * 2. 가방 최대 인원(10명) 및 초대 코드 유효성을 서버 트랜잭션/Admin SDK로 안전하게 검증.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const { inviteCode, joinerProfile } = (body as {
    inviteCode?: string;
    joinerProfile?: { nickname?: string; avatarId?: string };
  }) ?? {};

  const cleanCode = (inviteCode ?? "").trim().toUpperCase();
  if (!cleanCode) {
    return NextResponse.json({ error: "초대 코드를 입력해주세요" }, { status: 400 });
  }

  if (!joinerProfile?.nickname || !joinerProfile?.avatarId) {
    return NextResponse.json({ error: "프로필 정보가 올바르지 않아요" }, { status: 400 });
  }

  let uid: string;
  let email: string | null;
  try {
    const verified = await verifyRequestUser(req);
    uid = verified.uid;
    email = verified.email;
  } catch (err) {
    const message = err instanceof ServerAuthError ? err.message : "로그인이 필요해요";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const db = adminDb();
  if (!db) {
    return NextResponse.json({ error: "데이터베이스 연결에 실패했어요" }, { status: 500 });
  }

  try {
    // 1. 초대코드 문서 조회
    const codeDoc = await db.collection("inviteCodes").doc(cleanCode).get();
    if (!codeDoc.exists) {
      return NextResponse.json({ error: "해당 초대코드의 가방을 찾을 수 없어요" }, { status: 404 });
    }

    const bagId = codeDoc.data()?.bagId as string | undefined;
    if (!bagId) {
      return NextResponse.json({ error: "초대코드 정보가 올바르지 않아요" }, { status: 404 });
    }

    // 2. 가방 문서 조회
    const bagRef = db.collection("bags").doc(bagId);
    const bagSnap = await bagRef.get();
    if (!bagSnap.exists) {
      return NextResponse.json({ error: "가방이 삭제되었거나 존재하지 않아요" }, { status: 404 });
    }

    const bagData = bagSnap.data();
    const memberIds = (bagData?.memberIds as string[] | undefined) ?? [];
    const isAlreadyMember = memberIds.includes(uid);

    // 3. 프리미엄 검증 및 무료 참여 슬롯(최대 3개) 검증
    const premium = await isPremiumServer(uid, email);

    if (!premium && !isAlreadyMember) {
      // 내가 속한 모든 가방 조회
      const myBagsSnap = await db
        .collection("bags")
        .where("memberIds", "array-contains", uid)
        .get();

      // 내가 만든 가방이 아닌, "초대받아 참여 중인 활성 가방"만 카운트
      const joinedCount = myBagsSnap.docs.filter((doc) => {
        const data = doc.data();
        const isOwner = data.ownerId === uid;
        const isTrashed = !!data.trashedByOwnerAt;
        return !isOwner && !isTrashed;
      }).length;

      if (joinedCount >= FREE_MAX_JOINED_BAGS) {
        return NextResponse.json(
          {
            code: "JOIN_LIMIT_REACHED",
            error: `무료로는 초대받은 가방을 최대 ${FREE_MAX_JOINED_BAGS}개까지만 참여할 수 있어요. 더 참여하려면 이용권 코드를 등록해주세요.`,
          },
          { status: 403 }
        );
      }
    }

    // 4. 가방 정원(최대 10명) 검사
    if (!isAlreadyMember && memberIds.length >= 10) {
      return NextResponse.json(
        { error: "가방 인원이 가득 찼어요 (최대 10명)" },
        { status: 400 }
      );
    }

    // 5. 멤버 추가 및 프로필 스냅샷 기록
    const profileEntry: BagMemberProfile = {
      nickname: joinerProfile.nickname.trim().slice(0, 12),
      avatarId: joinerProfile.avatarId,
      joinedAt: new Date().toISOString(),
    };

    await bagRef.update({
      memberIds: FieldValue.arrayUnion(uid),
      [`memberProfiles.${uid}`]: profileEntry,
    });

    return NextResponse.json({ bagId, joined: true });
  } catch (err) {
    console.error("[팩인백] 가방 참여 서버 오류:", err);
    return NextResponse.json({ error: "가방 참여 처리에 실패했어요" }, { status: 500 });
  }
}
