// 특정 uid가 "소유"한 가방들의 locked 상태를 그 사람의 현재 이용권 상태 기준으로
// 재계산해서 Firestore에 반영하는 공용 헬퍼.
//
// app/api/sync-lock-status(본인이 자기 자신을 위해 호출)와 app/api/transfer-bag-ownership
// (그룹장 위임 시 "이전 소유자"와 "새 소유자" 양쪽을 대신 재계산) 양쪽에서 함께 쓴다 -
// 로직이 두 곳에서 따로 놀며 어긋나는 걸 방지하기 위해 한 곳에 모아둔다.

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { isPremiumServer } from "@/lib/premiumServer";
import { FREE_MAX_ACTIVE_BAGS, FREE_MAX_JOINED_BAGS, FREE_MAX_LIBRARY_PACKS, QUICK_PACK_ID } from "@/lib/premiumLimits";

function sortByCreatedAtDesc<T extends { createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

// Firestore 일괄 쓰기는 한 번에 500건까지라 나눠서 보낸다(2026-10-15, premium.md 확인 필요 3)
async function commitInChunks(
  db: FirebaseFirestore.Firestore,
  updates: { ref: FirebaseFirestore.DocumentReference; data: { locked: boolean } }[],
): Promise<void> {
  for (let i = 0; i < updates.length; i += 450) {
    const batch = db.batch();
    updates.slice(i, i + 450).forEach((u) => batch.update(u.ref, u.data));
    await batch.commit();
  }
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

  const updates: Parameters<typeof commitInChunks>[1] = [];
  bagDocs.forEach((b, index) => {
    const shouldLock = !premium && index >= FREE_MAX_ACTIVE_BAGS;
    if (!!b.locked !== shouldLock) updates.push({ ref: db.collection("bags").doc(b.id), data: { locked: shouldLock } });
  });
  await commitInChunks(db, updates);
}

// 무료 회원이 참여 가방(남이 만든 것, 휴지통 제외)을 3개를 넘게 갖고 있으면 오래된 것부터 나간다(2026-10-15, premium.md 확인 필요 2 → C).
// 프리미엄일 때 많이 참여했다가 무료로 바뀐 때만 생긴다(참여는 join-bag이 3개로 막는다).
// 남의 가방은 문서에 "나만 잠김"을 표시할 수 없어서(규칙으로 막으려면 저장마다 읽기 1번이 늘어난다) 잠그지 않고 나간다.
// 기준은 화면의 computeLockedBagIds와 같은 "만든 시각 최신 3개만 남김". 나간 가방 수를 돌려준다
export async function leaveExcessJoinedBags(uid: string, premium: boolean): Promise<number> {
  if (premium) return 0;
  const db = adminDb();
  const snap = await db.collection("bags").where("memberIds", "array-contains", uid).get();
  const joined = sortByCreatedAtDesc(
    snap.docs
      .map((d) => ({
        ref: d.ref,
        createdAt: d.data().createdAt as string | undefined,
        ownerId: d.data().ownerId as string | undefined,
        trashed: !!d.data().trashedByOwnerAt,
      }))
      .filter((b) => b.ownerId !== uid && !b.trashed),
  );
  const excess = joined.slice(FREE_MAX_JOINED_BAGS);
  for (const b of excess) {
    await b.ref.update({ memberIds: FieldValue.arrayRemove(uid), [`memberProfiles.${uid}`]: FieldValue.delete() });
  }
  return excess.length;
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

  const updates: Parameters<typeof commitInChunks>[1] = [];
  activePacks.forEach((p, idx) => {
    const shouldLock = !premium && idx >= FREE_MAX_LIBRARY_PACKS;
    if (!!p.locked !== shouldLock) updates.push({ ref: packsCol.doc(p.id), data: { locked: shouldLock } });
  });
  await commitInChunks(db, updates);
}
