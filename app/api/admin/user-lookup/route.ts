import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireMasterUser, AdminForbiddenError, ServerAuthError } from "@/lib/adminApiAuth";
import { Bag, Pack } from "@/lib/types";

export const runtime = "nodejs";

// 마스터(운영자) 전용. CS 문의 대응 시 이메일 하나로 그 유저의 전체 현황(가방/팩/이용권)을
// 한 번에 조회하기 위한 라우트. firestore.rules상 bags는 memberIds에 있는 사람만 읽을 수
// 있어서(마스터도 예외 없음), 반드시 Admin SDK로만 조회 가능하다.
export async function GET(req: NextRequest) {
  try {
    await requireMasterUser(req);
  } catch (err) {
    if (err instanceof AdminForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ServerAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "로그인 정보를 확인할 수 없어요" }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email")?.trim();
  if (!email) {
    return NextResponse.json({ error: "이메일을 입력해주세요" }, { status: 400 });
  }

  const db = adminDb();

  let uid: string;
  try {
    const authUser = await adminAuth().getUserByEmail(email);
    uid = authUser.uid;
  } catch {
    return NextResponse.json({ error: "해당 이메일로 가입된 계정을 찾을 수 없어요" }, { status: 404 });
  }

  try {
    const [userSnap, ownedBagsSnap, memberBagsSnap, libraryPacksSnap] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("bags").where("ownerId", "==", uid).get(),
      db.collection("bags").where("memberIds", "array-contains", uid).get(),
      db.collection("users").doc(uid).collection("libraryPacks").get(),
    ]);

    const userData = userSnap.data() ?? {};

    const ownedBagIds = new Set(ownedBagsSnap.docs.map((d) => d.id));
    const summarizeBag = (id: string, bag: Bag) => {
      const packs = (bag.packs ?? []).filter((p) => (p as Pack).type !== "folder");
      const itemCount = packs.reduce((sum, p) => sum + ((p as Pack).items?.length ?? 0), 0);
      return {
        id,
        name: bag.name,
        ownerId: bag.ownerId,
        isOwner: bag.ownerId === uid,
        memberCount: bag.memberIds?.length ?? 0,
        packCount: packs.length,
        itemCount,
        locked: bag.locked ?? false,
        trashedByOwnerAt: bag.trashedByOwnerAt ?? null,
        createdAt: bag.createdAt,
        updatedAt: bag.updatedAt,
      };
    };

    const ownedBags = ownedBagsSnap.docs.map((d) => summarizeBag(d.id, d.data() as Bag));
    // memberBagsSnap에는 본인 소유 가방도 포함되어 있으니, 소유가 아닌 것만 "참여중인 가방"으로 분류
    const memberOfBags = memberBagsSnap.docs
      .filter((d) => !ownedBagIds.has(d.id))
      .map((d) => summarizeBag(d.id, d.data() as Bag));

    const libraryPacks = libraryPacksSnap.docs.map((d) => {
      const p = d.data() as Pack;
      return {
        id: d.id,
        name: p.name,
        type: p.type ?? "pack",
        kind: p.kind ?? "checklist",
        itemCount: p.items?.length ?? 0,
        trashedAt: p.trashedAt ?? null,
        createdAt: p.createdAt ?? null,
      };
    });

    let unlockCodeInfo: Record<string, unknown> | null = null;
    const unlockCode = userData.unlockCode as string | undefined;
    if (unlockCode) {
      const codeSnap = await db.collection("unlockCodes").doc(unlockCode).get();
      if (codeSnap.exists) {
        const codeData = codeSnap.data() ?? {};
        const toIso = (v: unknown) =>
          v && typeof v === "object" && "toDate" in v
            ? (v as { toDate: () => Date }).toDate().toISOString()
            : null;
        unlockCodeInfo = {
          code: unlockCode,
          status: codeData.status ?? null,
          note: codeData.note ?? "",
          durationType: codeData.durationType ?? null,
          expiresAt: toIso(codeData.expiresAt),
          invalidatedAt: toIso(codeData.invalidatedAt),
        };
      }
    }

    return NextResponse.json({
      uid,
      email: userData.email ?? email,
      nickname: userData.nickname ?? null,
      createdAt:
        userData.createdAt && typeof userData.createdAt === "object" && "toDate" in userData.createdAt
          ? (userData.createdAt as { toDate: () => Date }).toDate().toISOString()
          : null,
      aiUsage: userData.aiUsage ?? null,
      unlockCode: unlockCodeInfo,
      ownedBags,
      memberOfBags,
      libraryPacks: {
        total: libraryPacks.filter((p) => !p.trashedAt).length,
        trashed: libraryPacks.filter((p) => !!p.trashedAt).length,
        items: libraryPacks,
      },
    });
  } catch (err) {
    console.error("[팩인백] 관리자 유저 조회 실패:", err);
    return NextResponse.json({ error: "유저 정보를 불러오지 못했어요" }, { status: 500 });
  }
}
