import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { sendVerificationEmailViaResend } from "@/lib/resendEmail";

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

export async function POST(req: NextRequest) {
  let email: string | null;
  try {
    const verified = await verifyRequestUser(req);
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
