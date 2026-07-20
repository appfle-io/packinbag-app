// 관리자 대시보드 통계 집계 로직. app/api/admin/stats(현재 통계 조회)와
// app/api/admin/stats/snapshot(매일 KST 자정 직후 Vercel Cron이 호출하는 스냅샷 저장용)이
// 이 파일의 computeAdminStats()를 공통으로 사용한다. 로직을 한 곳에 모아둬야
// 두 라우트의 집계 방식이 어긋나지 않는다.

import { adminDb } from "@/lib/firebaseAdmin";
import { Bag, Pack } from "@/lib/types";

export interface AdminStats {
  users: { total: number; newLast7Days: number };
  bags: { total: number; active: number; trashed: number; shared: number };
  packs: { total: number; editor: number; folders: number; libraryTotal: number };
  items: { total: number; checked: number };
  premium: { unusedCodes: number; activeCodes: number; expiredCodes: number; invalidatedCodes: number };
  inquiries: { total: number; pending: number };
}

// KST(UTC+9) 기준 날짜 문자열(YYYY-MM-DD). 스냅샷 문서 ID로 쓴다.
export function kstDateString(date: Date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function kstDateStringDaysAgo(days: number, from: Date = new Date()): string {
  return kstDateString(new Date(from.getTime() - days * 24 * 60 * 60 * 1000));
}

export async function computeAdminStats(): Promise<AdminStats> {
  const db = adminDb();

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

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newUsersSnap = await db.collection("users").where("createdAt", ">=", sevenDaysAgo).count().get();
  const newUsersLast7Days = newUsersSnap.data().count;

  let activeBags = 0;
  let trashedBags = 0;
  let sharedBags = 0;
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
    const expiresAtMs = expiresAt && typeof expiresAt.toDate === "function" ? expiresAt.toDate().getTime() : null;
    if (expiresAtMs !== null && expiresAtMs < now) unlockExpired++;
    else unlockActive++;
  }

  return {
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
  };
}
