import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, isPremiumServer, ServerAuthError } from "@/lib/premiumServer";
import { FREE_MAX_ACTIVE_BAGS, FREE_MAX_LIBRARY_PACKS } from "@/lib/premiumLimits";

// 이용권 상태(등록/무효화/만료)가 바뀔 때마다 클라이언트(AppShell)가 호출하는 라우트.
//
// 왜 필요한가: 무료로 전환된 사람이 이미 만들어둔 가방/팩 중 최신 N개를 넘는 것들은
// 화면(UI)에서는 클라이언트가 즉시 잠금으로 표시할 수 있지만, 그것만으로는 devtools로
// 우회해서 계속 수정할 수 있다. 그래서 여기서 실제 Firestore 문서에 locked:true/false를
// 기록해두고, firestore.rules/storage.rules가 "소유자가 잠긴 걸 수정/업로드하려는 시도"를
// 규칙 레벨에서 막는다(다른 그룹원은 소유자가 아니라서 영향 없음).
//
// 언제 호출되는가: AppShell이 이용권 상태(premium)가 true<->false로 바뀌는 순간(무효화/
// 만료가 실시간 감지되거나, 새로 코드를 등록해서 premium이 true가 된 순간) 자동으로 호출한다.
export const runtime = "nodejs";

function sortByCreatedAtDesc<T extends { createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function POST(req: NextRequest) {
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

  try {
    // 1) 내가 소유(ownerId)한 가방들만 대상. 다른 사람 소유의 공유 가방은 손대지 않는다
    // (그 가방은 그 소유자의 이용권 상태로만 잠금 여부가 결정되고, 나는 그룹원일 뿐이다).
    const bagsSnap = await db.collection("bags").where("ownerId", "==", uid).get();
    const bagDocs = sortByCreatedAtDesc(
      bagsSnap.docs.map((d) => ({
        id: d.id,
        createdAt: d.data().createdAt as string | undefined,
        locked: d.data().locked as boolean | undefined,
      }))
    );
    const lockedBagIds: string[] = [];
    if (bagDocs.length > 0) {
      const bagBatch = db.batch();
      let writes = 0;
      bagDocs.forEach((b, index) => {
        const shouldLock = !premium && index >= FREE_MAX_ACTIVE_BAGS;
        if (shouldLock) lockedBagIds.push(b.id);
        if (!!b.locked !== shouldLock) {
          bagBatch.update(db.collection("bags").doc(b.id), { locked: shouldLock });
          writes++;
        }
      });
      if (writes > 0) await bagBatch.commit();
    }

    // 2) 팩 라이브러리 (본인 전용 하위 컬렉션, 소유자 구분 필요 없음)
    const packsCol = db.collection("users").doc(uid).collection("libraryPacks");
    const packsSnap = await packsCol.get();
    const packDocs = sortByCreatedAtDesc(
      packsSnap.docs.map((d) => ({
        id: d.id,
        createdAt: d.data().createdAt as string | undefined,
        locked: d.data().locked as boolean | undefined,
      }))
    );
    const lockedPackIds: string[] = [];
    if (packDocs.length > 0) {
      const packBatch = db.batch();
      let writes = 0;
      packDocs.forEach((p, index) => {
        const shouldLock = !premium && index >= FREE_MAX_LIBRARY_PACKS;
        if (shouldLock) lockedPackIds.push(p.id);
        if (!!p.locked !== shouldLock) {
          packBatch.update(packsCol.doc(p.id), { locked: shouldLock });
          writes++;
        }
      });
      if (writes > 0) await packBatch.commit();
    }

    return NextResponse.json({ ok: true, premium, lockedBagIds, lockedPackIds });
  } catch (err) {
    console.error("[팩인백] 잠금 상태 동기화 실패:", err);
    return NextResponse.json({ error: "잠금 상태 동기화에 실패했어요" }, { status: 500 });
  }
}
