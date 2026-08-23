import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, isPremiumServer, ServerAuthError } from "@/lib/premiumServer";
import { syncOwnedBagLocks } from "@/lib/bagLockSync";

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
//
// 가방 잠금 재계산 로직 자체는 lib/bagLockSync.ts의 syncOwnedBagLocks로 뽑아뒀다 -
// 그룹장 위임(app/api/transfer-bag-ownership)에서 이전/새 소유자 양쪽을 대신 재계산할 때도
// 같은 로직을 그대로 재사용하기 위함이다.
export const runtime = "nodejs";

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
    // 1. 소유 가방 잠금 상태 동기화 (최신 3개 제외 나머지 locked)
    await syncOwnedBagLocks(uid);

    // 2. 팩 보관함 잠금 상태 동기화 (무료는 최신 10개 제외 나머지 locked: true, 프리미엄은 전부 false)
    const packsCol = db.collection("users").doc(uid).collection("libraryPacks");
    const packsSnap = await packsCol.get();
    const activePacks = packsSnap.docs
      .map((d) => ({
        id: d.id,
        createdAt: d.data().createdAt as string | undefined,
        locked: d.data().locked as boolean | undefined,
        trashedAt: d.data().trashedAt as string | undefined,
        isQuick: d.id === "quick-pack" || !!d.data().isQuickPack,
      }))
      .filter((p) => !p.trashedAt && !p.isQuick)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    const packBatch = db.batch();
    let packWrites = 0;

    activePacks.forEach((p, idx) => {
      const shouldLock = !premium && idx >= 10;
      if (!!p.locked !== shouldLock) {
        packBatch.update(packsCol.doc(p.id), { locked: shouldLock });
        packWrites++;
      }
    });

    if (packWrites > 0) {
      await packBatch.commit();
    }

    return NextResponse.json({ ok: true, premium });
  } catch (err) {
    console.error("[팩인백] 잠금 상태 동기화 실패:", err);
    return NextResponse.json({ error: "잠금 상태 동기화에 실패했어요" }, { status: 500 });
  }
}
