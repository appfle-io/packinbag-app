import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { sendPasswordResetViaResend } from "@/lib/resendEmail";
import { todayKstKey } from "@/lib/aiUsageConfig";

// 비밀번호 재설정 메일을 Resend(브랜드 도메인)로 보내는 라우트(2026-10-15, auth.md 확인 필요 7).
// Firebase 기본 발송은 스팸함으로 가기 쉽다(send-verification-email과 같은 이유). 링크는 Firebase가 만든 진짜 재설정 링크다.
// - 로그인 전 화면에서 부르므로 인증 토큰이 없다 → 이메일마다 60초에 한 번 · 하루(KST) 5통으로 막는다
//   (카운터 passwordResetUsage/{이메일 해시}, Admin SDK만 씀 - 규칙이 없어 클라이언트는 못 읽고 못 쓴다)
// - 가입하지 않은 이메일이어도 "보냈다"고 답한다(가입 여부를 알려 주지 않기 위해). 실제로는 아무것도 보내지 않는다
// - 그 밖의 실패는 200 + sent:false → 앱이 Firebase 기본 발송으로 대신한다
export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://packinbag.seeuson.com";
const COOLDOWN_MS = 60 * 1000;
const DAILY_LIMIT = 5;

export async function POST(req: NextRequest) {
  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ sent: false, error: "이메일 주소를 확인해 주세요" }, { status: 400 });
  }

  const db = adminDb();
  if (!db) return NextResponse.json({ sent: false });
  const ref = db.collection("passwordResetUsage").doc(createHash("sha256").update(email).digest("hex"));
  const now = Date.now();
  const dateKey = todayKstKey();
  try {
    const gate = await db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data() ?? {};
      const last = typeof data.lastSentAtMs === "number" ? data.lastSentAtMs : 0;
      if (now - last < COOLDOWN_MS) return "COOLDOWN" as const;
      const count = data.dateKey === dateKey && typeof data.count === "number" ? data.count : 0;
      if (count >= DAILY_LIMIT) return "DAILY_LIMIT" as const;
      tx.set(ref, { dateKey, count: count + 1, lastSentAtMs: now, updatedAt: new Date() });
      return "OK" as const;
    });
    if (gate === "COOLDOWN") {
      return NextResponse.json({ sent: false, code: "COOLDOWN", error: "잠시 후 다시 시도해주세요" }, { status: 429 });
    }
    // 하루 한도를 넘으면 Firebase 기본 발송으로(Firebase가 자체적으로 막는다)
    if (gate === "DAILY_LIMIT") return NextResponse.json({ sent: false, code: "DAILY_LIMIT" });
  } catch (err) {
    console.error("[팩인백] 재설정 메일 횟수 확인 실패(그대로 진행):", err);
  }

  let link: string;
  try {
    link = await adminAuth().generatePasswordResetLink(email, { url: APP_URL });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (code === "auth/user-not-found" || code === "auth/email-not-found") {
      return NextResponse.json({ sent: true });
    }
    console.error("[팩인백] 재설정 링크 만들기 실패(앱이 Firebase로 대신):", err);
    return NextResponse.json({ sent: false });
  }

  try {
    await sendPasswordResetViaResend(email, link);
    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[팩인백] Resend 재설정 메일 실패(앱이 Firebase로 대신):", err);
    return NextResponse.json({ sent: false });
  }
}
