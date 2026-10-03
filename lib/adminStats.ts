// 관리자 대시보드 통계 집계 로직. app/api/admin/stats(현재 통계 조회)와
// app/api/admin/stats/snapshot(매일 KST 자정 직후 Vercel Cron이 호출하는 스냅샷 저장용)이
// 이 파일의 computeAdminDashboard()를 공통으로 사용한다. 로직을 한 곳에 모아둬야
// 두 라우트의 집계 방식이 어긋나지 않는다.
//
// 2026-10-03 대시보드 개편: "몇 개 있나"(총량)보다 "누가 실제로 쓰나 · 어디서 막히나 · 무엇을 하면 되나"를 보도록
// AdminInsights를 추가했다. 읽기 비용: users 전체(필드 몇 개만) + bags 전체(이미 읽던 것) + unlockCodes 전체 +
// 미답변 문의 + 스냅샷 최근 30일. 라우트가 5분 캐시로 막는다.

import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { Bag, Pack } from "@/lib/types";

// lib/premiumLimits.ts의 FREE_MAX_ACTIVE_BAGS / bagMemberLimit(false)와 같은 값.
// (그 파일은 클라이언트 Firebase를 불러서 서버 집계에서는 숫자만 맞춰 둔다. 바뀌면 함께 바꿀 것)
const FREE_MAX_ACTIVE_BAGS = 3;
const FREE_MAX_BAG_MEMBERS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;
const SERIES_DAYS = 30;

export interface AdminStats {
  users: { total: number; newLast7Days: number };
  bags: { total: number; active: number; trashed: number; shared: number };
  packs: { total: number; editor: number; folders: number; libraryTotal: number };
  items: { total: number; checked: number };
  premium: { unusedCodes: number; activeCodes: number; expiredCodes: number; invalidatedCodes: number };
  inquiries: { total: number; pending: number };
}

// 스냅샷에도 저장해서 추이 그래프·전주 대비에 쓰는 핵심 숫자(평평한 구조)
export interface AdminKpis {
  activeUsers1d: number;
  activeUsers7d: number;
  activeUsers30d: number;
  premiumUsers: number;
  activatedUsers: number;
}

export interface AdminInsights {
  kpis: AdminKpis;
  // 최근 7일 신규 가입 중 가방을 만들고 아이템까지 넣은 사람 / 가입 8~30일 전 사람 중 최근 7일에 다시 쓴 사람
  funnel: { signedUp: number; madeBag: number; addedItems: number; checkedItem: number; shared: number };
  retention: { cohort: number; returned: number };
  // 휴지통 아닌 가방 기준 기능 사용률
  usage: {
    bags: number;
    sharedBags: number;
    ddayBags: number;
    memoBags: number;
    packedOnceBags: number;
    avgPacksPerBag: number;
    avgItemsPerBag: number;
    libraryPacks: number;
  };
  monetization: {
    premiumUsers: number;
    viaPurchase: number;
    viaCode: number;
    freeAtBagLimit: number;
    freeBagsAtMemberLimit: number;
    codesExpiringIn7d: number;
    unusedCodes: number;
  };
  ai: { usersToday: number; callsToday: number };
  ops: { pendingInquiries: number; oldestPendingDays: number | null };
  // 최근 30일(KST) 일별. signups는 실제 가입 시각으로 정확히, activeUsers7d·premiumUsers는 그날 스냅샷이 있을 때만
  daily: { date: string; signups: number; activeUsers7d: number | null; premiumUsers: number | null }[];
}

// KST(UTC+9) 기준 날짜 문자열(YYYY-MM-DD). 스냅샷 문서 ID로 쓴다.
export function kstDateString(date: Date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function kstDateStringDaysAgo(days: number, from: Date = new Date()): string {
  return kstDateString(new Date(from.getTime() - days * DAY_MS));
}

function toMs(v: unknown): number | null {
  if (!v) return null;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === "object" && v !== null && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  return null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function computeAdminDashboard(): Promise<{ stats: AdminStats; insights: AdminInsights }> {
  const db = adminDb();
  const now = Date.now();
  const todayKst = kstDateString();

  const seriesIds = Array.from({ length: SERIES_DAYS }, (_, i) => kstDateStringDaysAgo(SERIES_DAYS - 1 - i));

  const [usersSnap, bagsSnap, libraryPacksCountSnap, inquiriesCountSnap, pendingSnap, unlockCodesSnap, snapshotsSnap] = await Promise.all([
    db.collection("users").select("createdAt", "unlockCode", "premiumPurchase", "aiUsage", "role").get(),
    db
      .collection("bags")
      .select("packs", "memberIds", "ownerId", "trashedByOwnerAt", "createdAt", "updatedAt", "lastCheckedAt", "lastPackedAt", "travelDate")
      .get(),
    db.collectionGroup("libraryPacks").count().get(),
    db.collection("inquiries").count().get(),
    db.collection("inquiries").where("status", "==", "pending").select("createdAt").get(),
    db.collection("unlockCodes").select("status", "expiresAt").get(),
    db
      .collection("adminStatsSnapshots")
      .where(FieldPath.documentId(), ">=", seriesIds[0])
      .where(FieldPath.documentId(), "<=", seriesIds[seriesIds.length - 1])
      .get(),
  ]);

  // --- 이용권 코드 ---------------------------------------------------------------
  let unlockUnused = 0;
  let unlockActive = 0;
  let unlockExpired = 0;
  let unlockInvalidated = 0;
  let codesExpiringIn7d = 0;
  const validCodes = new Set<string>();
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
    const expiresMs = toMs(data.expiresAt);
    if (expiresMs !== null && expiresMs < now) {
      unlockExpired++;
    } else {
      unlockActive++;
      validCodes.add(doc.id);
      if (expiresMs !== null && expiresMs - now <= 7 * DAY_MS) codesExpiringIn7d++;
    }
  }

  // --- 사용자 --------------------------------------------------------------------
  const premiumUids = new Set<string>();
  let viaPurchase = 0;
  let viaCode = 0;
  let aiUsersToday = 0;
  let aiCallsToday = 0;
  let newLast7Days = 0;
  const createdAtByUid = new Map<string, number>();
  const signupsByDay = new Map<string, number>();
  for (const doc of usersSnap.docs) {
    const d = doc.data();
    const createdMs = toMs(d.createdAt);
    if (createdMs !== null) {
      createdAtByUid.set(doc.id, createdMs);
      if (now - createdMs <= 7 * DAY_MS) newLast7Days++;
      if (now - createdMs <= SERIES_DAYS * DAY_MS) {
        const day = kstDateString(new Date(createdMs));
        signupsByDay.set(day, (signupsByDay.get(day) ?? 0) + 1);
      }
    }
    // 운영자 계정은 결제 지표에서 뺀다
    if (d.role !== "master") {
      if ((d.premiumPurchase as { purchased?: boolean } | undefined)?.purchased) {
        premiumUids.add(doc.id);
        viaPurchase++;
      } else if (typeof d.unlockCode === "string" && validCodes.has(d.unlockCode)) {
        premiumUids.add(doc.id);
        viaCode++;
      }
    }
    const ai = d.aiUsage as { date?: string; count?: number } | undefined;
    if (ai?.date === todayKst && (ai.count ?? 0) > 0) {
      aiUsersToday++;
      aiCallsToday += ai.count ?? 0;
    }
  }

  // --- 가방 --------------------------------------------------------------------
  let activeBags = 0;
  let trashedBags = 0;
  let sharedBagsAll = 0;
  let totalPacks = 0;
  let editorPacks = 0;
  let folderPacks = 0;
  let totalItems = 0;
  let checkedItems = 0;

  const usage = { sharedBags: 0, ddayBags: 0, memoBags: 0, packedOnceBags: 0, packs: 0, items: 0 };
  const active1d = new Set<string>();
  const active7d = new Set<string>();
  const active30d = new Set<string>();
  const ownedActiveBags = new Map<string, number>();
  const madeBag = new Set<string>();
  const addedItems = new Set<string>();
  const checkedItem = new Set<string>();
  const sharedUsers = new Set<string>();
  let freeBagsAtMemberLimit = 0;

  for (const doc of bagsSnap.docs) {
    const bag = doc.data() as Bag;
    const members = bag.memberIds ?? [];
    const shared = members.length >= 2;
    if (shared) sharedBagsAll++;

    let bagItems = 0;
    let bagChecked = 0;
    let hasMemo = false;
    let bagPacks = 0;
    for (const pack of bag.packs ?? []) {
      const p = pack as Pack;
      if (p.type === "folder") {
        folderPacks++;
        continue;
      }
      totalPacks++;
      bagPacks++;
      if (p.kind === "editor") {
        editorPacks++;
        hasMemo = true;
        continue;
      }
      for (const item of p.items ?? []) {
        totalItems++;
        bagItems++;
        if (item.checked) {
          checkedItems++;
          bagChecked++;
        }
      }
    }

    if (bag.trashedByOwnerAt) {
      trashedBags++;
      continue;
    }
    activeBags++;

    // 활동: 마지막 체크 또는 저장 시각. 그 가방의 멤버 모두를 활동한 사람으로 센다(가방 기준 근사치)
    const lastMs = Math.max(toMs(bag.lastCheckedAt) ?? 0, toMs(bag.updatedAt) ?? 0);
    if (lastMs > 0) {
      const age = now - lastMs;
      for (const uid of members) {
        if (age <= DAY_MS) active1d.add(uid);
        if (age <= 7 * DAY_MS) active7d.add(uid);
        if (age <= 30 * DAY_MS) active30d.add(uid);
      }
    }

    if (bag.ownerId) {
      ownedActiveBags.set(bag.ownerId, (ownedActiveBags.get(bag.ownerId) ?? 0) + 1);
      madeBag.add(bag.ownerId);
      if (bagItems > 0) addedItems.add(bag.ownerId);
      if (shared && !premiumUids.has(bag.ownerId) && members.length >= FREE_MAX_BAG_MEMBERS) freeBagsAtMemberLimit++;
    }
    if (bagChecked > 0) members.forEach((uid) => checkedItem.add(uid));
    if (shared) members.forEach((uid) => sharedUsers.add(uid));

    if (shared) usage.sharedBags++;
    if (bag.travelDate) usage.ddayBags++;
    if (hasMemo) usage.memoBags++;
    if (bag.lastPackedAt) usage.packedOnceBags++;
    usage.packs += bagPacks;
    usage.items += bagItems;
  }

  let freeAtBagLimit = 0;
  for (const [uid, count] of ownedActiveBags) {
    if (count >= FREE_MAX_ACTIVE_BAGS && !premiumUids.has(uid)) freeAtBagLimit++;
  }

  // --- 퍼널(최근 30일 가입자) · 재방문(가입 8~30일 전) ----------------------------------------
  const recentSignups: string[] = [];
  let cohort = 0;
  let returned = 0;
  for (const [uid, createdMs] of createdAtByUid) {
    const age = now - createdMs;
    if (age <= SERIES_DAYS * DAY_MS) recentSignups.push(uid);
    if (age > 7 * DAY_MS && age <= SERIES_DAYS * DAY_MS) {
      cohort++;
      if (active7d.has(uid)) returned++;
    }
  }
  const funnel = {
    signedUp: recentSignups.length,
    madeBag: recentSignups.filter((u) => madeBag.has(u)).length,
    addedItems: recentSignups.filter((u) => addedItems.has(u)).length,
    checkedItem: recentSignups.filter((u) => checkedItem.has(u)).length,
    shared: recentSignups.filter((u) => sharedUsers.has(u)).length,
  };

  // --- 문의 ----------------------------------------------------------------------
  let oldestPendingMs: number | null = null;
  for (const doc of pendingSnap.docs) {
    const t = toMs(doc.data().createdAt);
    if (t !== null && (oldestPendingMs === null || t < oldestPendingMs)) oldestPendingMs = t;
  }

  // --- 일별 추이 -------------------------------------------------------------------
  const snapById = new Map(snapshotsSnap.docs.map((d) => [d.id, d.data()]));
  const daily = seriesIds.map((date) => {
    const kpis = snapById.get(date)?.kpis as Partial<AdminKpis> | undefined;
    return {
      date,
      signups: signupsByDay.get(date) ?? 0,
      activeUsers7d: typeof kpis?.activeUsers7d === "number" ? kpis.activeUsers7d : null,
      premiumUsers: typeof kpis?.premiumUsers === "number" ? kpis.premiumUsers : null,
    };
  });
  // 오늘은 스냅샷이 없으니 지금 값으로 채운다
  const todayRow = daily[daily.length - 1];
  if (todayRow && todayRow.date === todayKst) {
    todayRow.activeUsers7d = active7d.size;
    todayRow.premiumUsers = premiumUids.size;
  }

  const totalUsers = usersSnap.size;
  const libraryTotal = libraryPacksCountSnap.data().count;

  const stats: AdminStats = {
    users: { total: totalUsers, newLast7Days },
    bags: { total: activeBags + trashedBags, active: activeBags, trashed: trashedBags, shared: sharedBagsAll },
    packs: { total: totalPacks, editor: editorPacks, folders: folderPacks, libraryTotal },
    items: { total: totalItems, checked: checkedItems },
    premium: { unusedCodes: unlockUnused, activeCodes: unlockActive, expiredCodes: unlockExpired, invalidatedCodes: unlockInvalidated },
    inquiries: { total: inquiriesCountSnap.data().count, pending: pendingSnap.size },
  };

  const insights: AdminInsights = {
    kpis: {
      activeUsers1d: active1d.size,
      activeUsers7d: active7d.size,
      activeUsers30d: active30d.size,
      premiumUsers: premiumUids.size,
      activatedUsers: addedItems.size,
    },
    funnel,
    retention: { cohort, returned },
    usage: {
      bags: activeBags,
      sharedBags: usage.sharedBags,
      ddayBags: usage.ddayBags,
      memoBags: usage.memoBags,
      packedOnceBags: usage.packedOnceBags,
      avgPacksPerBag: activeBags ? round1(usage.packs / activeBags) : 0,
      avgItemsPerBag: activeBags ? round1(usage.items / activeBags) : 0,
      libraryPacks: libraryTotal,
    },
    monetization: {
      premiumUsers: premiumUids.size,
      viaPurchase,
      viaCode,
      freeAtBagLimit,
      freeBagsAtMemberLimit,
      codesExpiringIn7d,
      unusedCodes: unlockUnused,
    },
    ai: { usersToday: aiUsersToday, callsToday: aiCallsToday },
    ops: {
      pendingInquiries: pendingSnap.size,
      oldestPendingDays: oldestPendingMs === null ? null : Math.floor((now - oldestPendingMs) / DAY_MS),
    },
    daily,
  };

  return { stats, insights };
}

// 예전 호출부 호환
export async function computeAdminStats(): Promise<AdminStats> {
  return (await computeAdminDashboard()).stats;
}
