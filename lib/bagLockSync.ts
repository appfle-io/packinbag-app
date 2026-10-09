// 특정 uid가 "소유"한 가방들의 locked 상태를 그 사람의 현재 이용권 상태 기준으로
// 재계산해서 Firestore에 반영하는 공용 헬퍼.
//
// app/api/sync-lock-status(본인이 자기 자신을 위해 호출)와 app/api/transfer-bag-ownership
// (그룹장 위임 시 "이전 소유자"와 "새 소유자" 양쪽을 대신 재계산) 양쪽에서 함께 쓴다 -
// 로직이 두 곳에서 따로 놀며 어긋나는 걸 방지하기 위해 한 곳에 모아둔다.

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { isPremiumServer } from "@/lib/premiumServer";
import { FREE_MAX_ACTIVE_BAGS, FREE_MAX_LIBRARY_PACKS, QUICK_PACK_ID } from "@/lib/premiumLimits";

function sortByCreatedAtDesc<T extends { createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function syncOwnedBagLocks(uid: string): Promise<void> {
  const db = adminDb();

  // sync-lock-status는 요청자 본인의 idToken에서 email을 바로 얻지만, 여기서는 "남을 대신"
  // 계산할 수도 있어서(그룹장 위임의 이전/새 소유자) Admin SDK로 이메일을 다시 조회한다.
  let email: string | null = null;
  try {
    const authUser = await adminAuth().getUser(uid);
    // 인증한 이메일만(마스터 판정용, lib/premiumServer.ts verifyRequestUser와 같은 기준)
    email = authUser.emailVerified ? authUser.email ?? null : null;
  } catch (err) {
    console.warn("[팩인백] 잠금 재계산용 이메일 조회 실패:", err);
  }
  const premium = await isPremiumServer(uid, email);

  const bagsSnap = await db.collection("bags").where("ownerId", "==", uid).get();
  const bagDocs = sortByCreatedAtDesc(
    bagsSnap.docs
      .map((d) => ({
        id: d.id,
        createdAt: d.data().createdAt as string | undefined,
        locked: d.data().locked as boolean | undefined,
        trashedByOwnerAt: d.data().trashedByOwnerAt as string | undefined,
      }))
      .filter((b) => !b.trashedByOwnerAt)
  );
  if (bagDocs.length === 0) return;

  const batch = db.batch();
  let writes = 0;
  bagDocs.forEach((b, index) => {
    const shouldLock = !premium && index >= FREE_MAX_ACTIVE_BAGS;
    if (!!b.locked !== shouldLock) {
      batch.update(db.collection("bags").doc(b.id), { locked: shouldLock });
      writes++;
    }
  });
  if (writes > 0) await batch.commit();
}

// 팩 보관함 잠금 동기화: 무료는 최신 10개를 넘는 팩·폴더를 locked:true, 프리미엄은 전부 false.
// app/api/sync-lock-status와 restore-library-pack(복구로 개수가 늘 때)이 함께 쓴다(2026-10-09).
// 빠른팩은 문서 id(quick-pack)로만 가른다 - isQuickPack 필드는 예전에 클라이언트가 아무 팩에나 넣을 수 있어서
// 그걸로 잠금을 피해 갔다.
export async function syncLibraryPackLocks(uid: string, premium: boolean): Promise<void> {
  const db = adminDb();
  const packsCol = db.collection("users").doc(uid).collection("libraryPacks");
  const packsSnap = await packsCol.get();
  const activePacks = sortByCreatedAtDesc(
    packsSnap.docs
      .map((d) => ({
        id: d.id,
        createdAt: d.data().createdAt as string | undefined,
        locked: d.data().locked as boolean | undefined,
        trashedAt: d.data().trashedAt as string | undefined,
      }))
      .filter((p) => !p.trashedAt && p.id !== QUICK_PACK_ID)
  );

  const batch = db.batch();
  let writes = 0;
  activePacks.forEach((p, idx) => {
    const shouldLock = !premium && idx >= FREE_MAX_LIBRARY_PACKS;
    if (!!p.locked !== shouldLock) {
      batch.update(packsCol.doc(p.id), { locked: shouldLock });
      writes++;
    }
  });
  if (writes > 0) await batch.commit();
}
