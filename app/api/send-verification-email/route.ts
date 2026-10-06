import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { sendVerificationEmailViaResend } from "@/lib/resendEmail";
import { todayKstKey } from "@/lib/aiUsageConfig";

// Resend(브랜드 도메인)로 이메일 인증 메일을 보내는 라우트.
//
// 왜 필요한가: Firebase Auth 기본 발송은 발신 도메인이 google/firebaseapp 계열이라
// 도메인만 noreply.seeuson.com 등으로 바꿔도 스팸함 문제가 해결되지 않는다(SPF/DKIM
// 서명 주체는 여전히 Google). 그래서 Firebase Admin SDK로 "진짜 Firebase 인증 링크"만
// 서버에서 생성하고, 실제 메일 발송은 seeuson.com 도메인이 등록된 Resend로 대신 보낸다.
// 링크 자체는 Firebase가 발급한 것이라 사용자가 클릭하면 여전히 Firebase가 직접
// emailVerified를 true로 바꿔준다 - 앱의 나머지 인증 로직은 전혀 바뀌지 않는다.
//
// 안정성(폴백): 이 라우트는 아래 어떤 이유로 실패하든 예외를 던지지 않고 항상
// 200 + { sent:false }로 응답한다.
//   - RESEND_API_KEY 미설정/오발급
//   - Resend 쪽 에러(도메인 미인증, 쿼터 초과, 네트워크 장애 등)
//   - FIREBASE_SERVICE_ACCOUNT_KEY 미설정으로 Admin SDK 초기화 실패
// 클라이언트(lib/emailVerification.ts)가 sent:false를 보면 그 즉시 Firebase 기본
// 발송(sendEmailVerification)으로 자동 폴백하기 때문에, 이 라우트가 500을 던져서
// 클라이언트 쪽 에러 처리를 복잡하게 만들 필요가 없다 - "안 되면 원래 방식"이 항상
// 안전망으로 남아있는 구조다.
export const runtime = "nodejs";

// 인증 완료 후 Firebase가 보여주는 확인 페이지의 "돌아가기" 링크에 쓸 주소.
// 값이 없으면 서비스 운영 도메인을 기본값으로 쓴다.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://packinbag.seeuson.com";

// 연타·악용 방지(2026-10-06): Resend 무료 한도(하루 100 · 월 3,000)와 도메인 평판을 지킨다.
// - 같은 계정은 60초에 한 번만. 그 안에 다시 오면 429 + code "COOLDOWN"(클라이언트는 Firebase로 대신 보내지 않고 "잠시 후" 안내)
// - 같은 계정은 하루(KST) 5통까지 Resend로. 넘으면 sent:false + code "DAILY_LIMIT" → 클라이언트가 Firebase 기본 발송으로 대신한다
//   (메일은 계속 가고, Firebase가 자체적으로 막는다)
// 카운터는 emailVerifyUsage/{uid} 하나. Admin SDK만 쓴다(firestore.rules에 규칙이 없어 클라이언트는 읽지도 못 한다)
const RESEND_COOLDOWN_MS = 60 * 1000;
const RESEND_DAILY_LIMIT = 5;

type SendGate = { ok: true } | { ok: false; code: "COOLDOWN"; retryAfterSec: number } | { ok: false; code: "DAILY_LIMIT" };

// 보내도 되는지 확인하고, 되면 그 자리에서 횟수를 기록한다(동시에 여러 번 눌러도 한 번만 통과). DB를 못 쓰면 막지 않는다
async function claimSendSlot(uid: string): Promise<SendGate> {
  const db = adminDb();
  if (!db) return { ok: true };
  const ref = db.collection("emailVerifyUsage").doc(uid);
  const dateKey = todayKstKey();
  const now = Date.now();
  try {
    return await db.runTransaction(async (tx): Promise<SendGate> => {
      const data = (await tx.get(ref)).data() ?? {};
      const lastSentAtMs = typeof data.lastSentAtMs === "number" ? data.lastSentAtMs : 0;
      const sinceLast = now - lastSentAtMs;
      if (sinceLast < RESEND_COOLDOWN_MS) {
        return { ok: false, code: "COOLDOWN", retryAfterSec: Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000) };
      }
      const count = data.dateKey === dateKey && typeof data.count === "number" ? data.count : 0;
      if (count >= RESEND_DAILY_LIMIT) return { ok: false, code: "DAILY_LIMIT" };
      tx.set(ref, { uid, dateKey, count: count + 1, lastSentAtMs: now, updatedAt: new Date() });
      return { ok: true };
    });
  } catch (err) {
    console.error("[팩인백] 인증 메일 발송 횟수 확인 실패(그대로 보냄):", err);
    return { ok: true };
  }
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
      return NextResponse.json({ sent: false, error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { sent: false, error: "로그인 정보를 확인할 수 없어요" },
      { status: 401 }
    );
  }

  if (!email) {
    return NextResponse.json({ sent: false, error: "이메일 정보가 없어요" }, { status: 400 });
  }

  const gate = await claimSendSlot(uid);
  if (!gate.ok) {
    if (gate.code === "COOLDOWN") {
      return NextResponse.json(
        { sent: false, code: "COOLDOWN", retryAfterSec: gate.retryAfterSec, error: "잠시 후 다시 시도해주세요" },
        { status: 429 }
      );
    }
    return NextResponse.json({ sent: false, code: "DAILY_LIMIT", error: "오늘 발송 횟수를 넘었어요" }, { status: 200 });
  }

  try {
    const link = await adminAuth().generateEmailVerificationLink(email, { url: APP_URL });
    await sendVerificationEmailViaResend(email, link);
    return NextResponse.json({ sent: true });
  } catch (err) {
    // 여기서 500을 던지지 않는 이유는 파일 상단 주석 참고 - 클라이언트가 이 응답을 보고
    // Firebase 기본 발송으로 폴백한다.
    console.error(
      "[팩인백] Resend 인증 메일 발송 실패 (클라이언트가 Firebase 기본 발송으로 폴백합니다):",
      err
    );
    return NextResponse.json({ sent: false, error: "Resend 발송 실패" }, { status: 200 });
  }
}
