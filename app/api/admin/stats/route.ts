import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireMasterUser, AdminForbiddenError, ServerAuthError } from "@/lib/adminApiAuth";
import { computeAdminStats, kstDateStringDaysAgo, AdminStats } from "@/lib/adminStats";

export const runtime = "nodejs";

// 마스터(운영자) 전용. 대시보드 메인에 보여줄 전체 통계 + 전일/전주 대비 증감(trend)을
// 한 번에 집계해서 돌려준다. 통계 집계 로직 자체는 lib/adminStats.ts에 있고(스냅샷 cron
// 라우트와 공유), 이 라우트는 "지금 현재 값"과 "어제/일주일 전 스냅샷 값"을 비교하는
// 역할만 한다. 스냅샷이 아직 없는 날짜(cron 첫 실행 전, 또는 실패한 날)는 trend가 null로
// 내려가고 프런트에서는 이를 "데이터 없음"으로 표시해야 한다.
// AdminStats 각 필드가 전부 number라서, 증감값도 같은 모양(AdminStats)으로 재사용한다.
// (제네릭 매핑 타입으로 루프를 돌리면 "유니언 키에 쓰기"에서 TS가 교집합 타입을 요구하는
// 제약에 걸려서, 섹션별로 명시적으로 뺄셈하는 방식으로 단순화함)
function diffStats(current: AdminStats, baseline: AdminStats | null): AdminStats | null {
  if (!baseline) return null;
  return {
    users: {
      total: current.users.total - baseline.users.total,
      newLast7Days: current.users.newLast7Days - baseline.users.newLast7Days,
    },
    bags: {
      total: current.bags.total - baseline.bags.total,
      active: current.bags.active - baseline.bags.active,
      trashed: current.bags.trashed - baseline.bags.trashed,
      shared: current.bags.shared - baseline.bags.shared,
    },
    packs: {
      total: current.packs.total - baseline.packs.total,
      editor: current.packs.editor - baseline.packs.editor,
      folders: current.packs.folders - baseline.packs.folders,
      libraryTotal: current.packs.libraryTotal - baseline.packs.libraryTotal,
    },
    items: {
      total: current.items.total - baseline.items.total,
      checked: current.items.checked - baseline.items.checked,
    },
    premium: {
      unusedCodes: current.premium.unusedCodes - baseline.premium.unusedCodes,
      activeCodes: current.premium.activeCodes - baseline.premium.activeCodes,
      expiredCodes: current.premium.expiredCodes - baseline.premium.expiredCodes,
      invalidatedCodes: current.premium.invalidatedCodes - baseline.premium.invalidatedCodes,
    },
    inquiries: {
      total: current.inquiries.total - baseline.inquiries.total,
      pending: current.inquiries.pending - baseline.inquiries.pending,
    },
  };
}

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

  try {
    const stats = await computeAdminStats();

    const db = adminDb();
    const yesterdayId = kstDateStringDaysAgo(1);
    const weekAgoId = kstDateStringDaysAgo(7);
    const [yesterdaySnap, weekAgoSnap] = await Promise.all([
      db.collection("adminStatsSnapshots").doc(yesterdayId).get(),
      db.collection("adminStatsSnapshots").doc(weekAgoId).get(),
    ]);

    const yesterdayStats = yesterdaySnap.exists ? (yesterdaySnap.data() as AdminStats) : null;
    const weekAgoStats = weekAgoSnap.exists ? (weekAgoSnap.data() as AdminStats) : null;

    return NextResponse.json({
      ...stats,
      trend: {
        vsYesterday: diffStats(stats, yesterdayStats),
        vsLastWeek: diffStats(stats, weekAgoStats),
      },
    });
  } catch (err) {
    console.error("[팩인백] 관리자 통계 조회 실패:", err);
    return NextResponse.json({ error: "통계를 불러오지 못했어요" }, { status: 500 });
  }
}
