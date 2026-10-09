import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, isPremiumServer, ServerAuthError } from "@/lib/premiumServer";
import { FREE_MAX_JOINED_BAGS, FREE_MAX_BAG_MEMBERS, MAX_BAG_MEMBERS } from "@/lib/premiumLimits";
import { BagMemberProfile } from "@/lib/types";

export const runtime = "nodejs";

/**
 * 초대 코드로 가방에 참여하는 서버 API 라우트.
 *
 * 왜 서버에서 처리하는가:
 * 1. 무료 회원의 "초대받은 가방 최대 3개" 제한을 클라이언트가 devtools로 우회하여
 *    무제한으로 참여하는 것을 원천 차단하기 위함.
 * 2. 가방 최대 인원(10명) 및 초대 코드 유효성을 서버 트랜잭션/Admin SDK로 안전하게 검증.
 * 3. 가방을 만든 사람이 무료면 그 가방은 2명(나+1)까지만 함께 쓸 수 있다.
 *    이미 인원을 넘긴 가방은 멤버를 그대로 두고 새 참여만 막는다.
 */

// 만든 사람(ownerId)이 프리미엄인지. 이메일은 Auth에서 가져온다(마스터 이메일 판정용, Firestore 읽기 아님).
async function isOwnerPremium(ownerId: string): Promise<boolean> {
  let ownerEmail: string | null = null;
  try {
    const owner = await adminAuth().getUser(ownerId);
    // 인증한 이메일만(마스터 판정용, lib/premiumServer.ts와 같은 기준)
    ownerEmail = owner.emailVerified ? owner.email ?? null : null;
  } catch {
    // 탈퇴 등으로 계정을 못 찾으면 이메일 없이 판정
  }
  return isPremiumServer(ownerId, ownerEmail);
}

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
    // 초대코드 문서가 가리키는 가방의 "지금" 코드와 같아야만 참여된다.
    // - 재발급으로 바뀐 옛 코드, 가방 삭제 뒤 남은 코드 문서로는 못 들어온다
    // - inviteCodes 문서를 위조해 남의 bagId를 가리키게 해도 못 들어온다(규칙도 create false)
    if ((bagData?.inviteCode as string | undefined)?.toUpperCase() !== cleanCode) {
      return NextResponse.json({ error: "해당 초대코드의 가방을 찾을 수 없어요" }, { status: 404 });
    }
    if (bagData?.trashedByOwnerAt) {
      return NextResponse.json({ error: "가방이 삭제되었거나 존재하지 않아요" }, { status: 404 });
    }

    const memberIds = (bagData?.memberIds as string[] | undefined) ?? [];
    const ownerId = bagData?.ownerId as string | undefined;
    const isAlreadyMember = memberIds.includes(uid);

    // 이미 멤버면 아무것도 검사하지 않고 그대로 들어간다(프로필 스냅샷만 갱신)
    let ownerPremium: boolean | null = null;
    if (!isAlreadyMember) {
      // 3. 가방 정원(최대 10명) 검사
      if (memberIds.length >= MAX_BAG_MEMBERS) {
        return NextResponse.json(
          { error: `가방 인원이 가득 찼어요 (최대 ${MAX_BAG_MEMBERS}명)` },
          { status: 400 }
        );
      }

      // 4. 만든 사람이 무료면 2명까지. 이미 2명 이상일 때만 만든 사람을 조회한다(읽기 최소화)
      if (ownerId && memberIds.length >= FREE_MAX_BAG_MEMBERS) {
        ownerPremium = await isOwnerPremium(ownerId);
        if (!ownerPremium) {
          return NextResponse.json(
            {
              code: "BAG_MEMBER_LIMIT",
              error: `이 가방은 ${FREE_MAX_BAG_MEMBERS}명까지만 함께 쓸 수 있어요. 가방을 만든 사람이 프리미엄이면 ${MAX_BAG_MEMBERS}명까지 함께할 수 있어요.`,
            },
            { status: 403 }
          );
        }
      }

      // 5. 참여하는 사람의 무료 참여 슬롯(최대 3개) 검증
      const premium = await isPremiumServer(uid, email);
      if (!premium) {
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
    }

    // 6. 멤버 추가 및 프로필 스냅샷 기록
    const profileEntry: BagMemberProfile = {
      nickname: joinerProfile.nickname.trim().slice(0, 12),
      avatarId: joinerProfile.avatarId,
      joinedAt: new Date().toISOString(),
    };

    // 검사와 쓰기 사이에 다른 사람이 먼저 들어오거나 코드가 재발급될 수 있어서,
    // 트랜잭션으로 최신 문서를 다시 보고 정원·코드를 한 번 더 확인한 뒤 쓴다.
    const outcome = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(bagRef);
      if (!fresh.exists) return "gone" as const;
      const d = fresh.data();
      if ((d?.inviteCode as string | undefined)?.toUpperCase() !== cleanCode) return "gone" as const;
      const ids = (d?.memberIds as string[] | undefined) ?? [];
      if (!ids.includes(uid)) {
        if (ids.length >= MAX_BAG_MEMBERS) return "full" as const;
        // 처음 볼 때는 2명 미만이라 만든 사람을 안 봤는데, 그 사이 2명이 됐으면 여기서 다시 판정
        // (처음에 무료로 판정됐으면 이미 위에서 돌려보냈다)
        if (ids.length >= FREE_MAX_BAG_MEMBERS && ownerPremium === null && ownerId) {
          if (!(await isOwnerPremium(ownerId))) return "member-limit" as const;
        }
      }
      tx.update(bagRef, {
        memberIds: FieldValue.arrayUnion(uid),
        [`memberProfiles.${uid}`]: profileEntry,
      });
      return "ok" as const;
    });

    if (outcome === "gone") {
      return NextResponse.json({ error: "해당 초대코드의 가방을 찾을 수 없어요" }, { status: 404 });
    }
    if (outcome === "full") {
      return NextResponse.json(
        { error: `가방 인원이 가득 찼어요 (최대 ${MAX_BAG_MEMBERS}명)` },
        { status: 400 }
      );
    }
    if (outcome === "member-limit") {
      return NextResponse.json(
        {
          code: "BAG_MEMBER_LIMIT",
          error: `이 가방은 ${FREE_MAX_BAG_MEMBERS}명까지만 함께 쓸 수 있어요. 가방을 만든 사람이 프리미엄이면 ${MAX_BAG_MEMBERS}명까지 함께할 수 있어요.`,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ bagId, joined: true });
  } catch (err) {
    console.error("[팩인백] 가방 참여 서버 오류:", err);
    return NextResponse.json({ error: "가방 참여 처리에 실패했어요" }, { status: 500 });
  }
}
