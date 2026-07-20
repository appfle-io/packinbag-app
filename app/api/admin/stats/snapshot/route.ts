import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { computeAdminStats, kstDateStringDaysAgo } from "@/lib/adminStats";

export const runtime = "nodejs";

// Vercel Cron 전용 (vercel.json 참고, 매일 UTC 15:05 = KST 00:05 실행). 사람이 직접 호출하는
// 라우트가 아니라서 로그인 검사 대신 CRON_SECRET 헤더로만 인증한다(Vercel이 Cron 호출 시
// Authorization: Bearer {CRON_SECRET} 을 자동으로 붙여줌 - Vercel 프로젝트 환경변수에
// CRON_SECRET을 설정해두면 됨).
//
// 이 시각(자정 직후)의 전체 통계는 사실상 "어제(D-1) 하루가 끝난 시점"의 값이므로,
// 문서 ID는 오늘 날짜가 아니라 어제 날짜로 저장한다. 이렇게 해야 /api/admin/stats에서
// "전일 대비"를 구할 때 kstDateStringDaysAgo(1)로 바로 찾아 쓸 수 있다.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 401 });
  }

  try {
    const stats = await computeAdminStats();
    const yesterdayId = kstDateStringDaysAgo(1);

    await adminDb()
      .collection("adminStatsSnapshots")
      .doc(yesterdayId)
      .set({ ...stats, capturedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ ok: true, dateId: yesterdayId });
  } catch (err) {
    console.error("[팩인백] 통계 스냅샷 저장 실패:", err);
    return NextResponse.json({ error: "스냅샷 저장 실패" }, { status: 500 });
  }
}
