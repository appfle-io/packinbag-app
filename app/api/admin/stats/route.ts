import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireMasterUser, AdminForbiddenError, ServerAuthError } from "@/lib/adminApiAuth";
import { Bag, Pack } from "@/lib/types";

export const runtime = "nodejs";

// 마스터(운영자) 전용. 대시보드 메인에 보여줄 전체 통계를 한 번에 집계해서 돌려준다.
// 가방/팩/짐은 서브컬렉션이 아니라 가방 문서 안 배열(packs/items)이라, count() 애그리게이션
// 쿼리로는 셀 수 없어서 bags 컬렉션 전체를 한 번 읽어(select로 필요한 필드만) 메모리에서
// 합산한다. 초기 단계 앱 규모에서는 문제 없지만, 가방 수가 크게 늘어나면 이 방식은
// 다시 검토해야 한다(예: 집계 전용 카운터 문서로 전환).
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

  const db = adminDb();

  try {
    const [usersCountSnap, bagsSnap, libraryPacksCountSnap, inquiriesCountSnap, pendingInquiriesCountSnap, unlockCodesSnap] =
      await Promise.all([
        db.collection("users").count().get(),
        db.collection("bags").select("packs", "memberIds", "ownerId", "trashedByOwnerAt", "createdAt").get(),
        db.collectionGroup("libraryPacks").count().get(),
        db.collection("inquiries").count().get(),
        db.collection("inquiries").where("status", "==", "pending").count().get(),
        db.collection("unlockCodes").select("status", "expiresAt").get(),
      ]);

    const totalUsers = usersCountSnap.data().count;

    // 최근 7일 신규 가입자 수 (users.createdAt은 serverTimestamp)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersSnap = await db
      .collection("users")
      .where("createdAt", ">=", sevenDaysAgo)
      .count()
      .get();
    const newUsersLast7Days = newUsersSnap.data().count;

    let activeBags = 0;
    let trashedBags = 0;
    let sharedBags = 0; // memberIds 2명 이상
    let totalPacks = 0;
    let editorPacks = 0;
    let folderPacks = 0;
    let totalItems = 0;
    let checkedItems = 0;

    for (const doc of bagsSnap.docs) {
      const bag = doc.data() as Bag;
      if (bag.trashedByOwnerAt) trashedBags++;
      else activeBags++;
      if ((bag.memberIds?.length ?? 0) >= 2) sharedBags++;

      for (const pack of bag.packs ?? []) {
        const p = pack as Pack;
        if (p.type === "folder") {
          folderPacks++;
          continue;
        }
        totalPacks++;
        if (p.kind === "editor") {
          editorPacks++;
          continue;
        }
        for (const item of p.items ?? []) {
          totalItems++;
          if (item.checked) checkedItems++;
        }
      }
    }

    const totalBags = activeBags + trashedBags;
    const totalLibraryPacks = libraryPacksCountSnap.data().count;

    // 이용권 코드: 상태별 집계 (claimed인데 만료 안 된 것 = "활성 프리미엄")
    let unlockUnused = 0;
    let unlockActive = 0;
    let unlockExpired = 0;
    let unlockInvalidated = 0;
    const now = Date.now();
    for (const doc of unlockCodesSnap.docs) {
      const data = doc.data();
      const status = (data.status as string | undefined) ?? "unused";
      if (status === "unused") {
        unlockUnused++;
        continue;
      }
      if (status === "invalidated") {
        unlockInvalidated++;
        continue;
      }
      const expiresAt = data.expiresAt as { toDate?: () => Date } | null | undefined;
      const expiresAtMs =
        expiresAt && typeof expiresAt.toDate === "function" ? expiresAt.toDate().getTime() : null;
      if (expiresAtMs !== null && expiresAtMs < now) unlockExpired++;
      else unlockActive++;
    }

    return NextResponse.json({
      users: {
        total: totalUsers,
        newLast7Days: newUsersLast7Days,
      },
      bags: {
        total: totalBags,
        active: activeBags,
        trashed: trashedBags,
        shared: sharedBags,
      },
      packs: {
        total: totalPacks,
        editor: editorPacks,
        folders: folderPacks,
        libraryTotal: totalLibraryPacks,
      },
      items: {
        total: totalItems,
        checked: checkedItems,
      },
      premium: {
        unusedCodes: unlockUnused,
        activeCodes: unlockActive,
        expiredCodes: unlockExpired,
        invalidatedCodes: unlockInvalidated,
      },
      inquiries: {
        total: inquiriesCountSnap.data().count,
        pending: pendingInquiriesCountSnap.data().count,
      },
    });
  } catch (err) {
    console.error("[팩인백] 관리자 통계 조회 실패:", err);
    return NextResponse.json({ error: "통계를 불러오지 못했어요" }, { status: 500 });
  }
}
