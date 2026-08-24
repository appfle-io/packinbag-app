"use client";

// 이메일 인증 메일 발송 클라이언트 헬퍼.
//
// 왜 필요한가: Firebase Auth 기본 발송(sendEmailVerification)은 발신 도메인이
// google/firebaseapp 계열이라 SPF/DKIM 서명 주체를 우리 도메인(seeuson.com)으로
// 바꿀 수 없어서 스팸함으로 분류되는 경우가 많다. 그래서 서버(app/api/send-verification-email)가
// Firebase Admin SDK로 "진짜 Firebase 인증 링크"를 생성한 뒤, 그 링크를 우리가 직접
// 디자인한 메일에 담아 Resend(seeuson.com 도메인 SPF/DKIM/DMARC 등록됨)로 발송한다.
// 인증 자체(emailVerified 플래그)는 여전히 Firebase가 처리하므로, 발신 채널만
// Resend로 바뀌는 것이고 나머지 앱 로직(emailVerified 체크 등)은 전혀 안 바뀐다.
//
// 안정성: 위 서버 라우트가 어떤 이유로든(RESEND_API_KEY 미설정, Resend 쪽 에러/쿼터
// 초과, 네트워크 장애, Admin SDK 초기화 실패 등) 실패하면, 이 함수가 그 즉시
// Firebase 기본 발송(sendEmailVerification)으로 자동 폴백한다. 즉 Resend에 무슨
// 문제가 생겨도 사용자가 인증 메일 자체를 못 받는 일은 없다 - 원래(Resend 도입 전)
// 동작하던 방식이 항상 안전망으로 남아있는 구조.
import { sendEmailVerification, User } from "firebase/auth";

export async function sendVerificationEmailWithFallback(user: User): Promise<void> {
  let sentByResend = false;

  try {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/send-verification-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    });
    const data = await res.json().catch(() => ({}) as { sent?: boolean; error?: string });
    sentByResend = res.ok && data?.sent === true;
    if (!sentByResend) {
      console.warn(
        "[팩인백] Resend 인증 메일 발송 실패, Firebase 기본 발송으로 대체합니다:",
        data?.error ?? `HTTP ${res.status}`
      );
    }
  } catch (err) {
    // fetch 자체가 실패한 경우(오프라인, CORS 등 - 이론상 같은 오리진이라 거의 없음)도
    // 동일하게 폴백 대상으로 취급한다.
    console.warn("[팩인백] 인증 메일 API 호출 실패, Firebase 기본 발송으로 대체합니다:", err);
  }

  if (!sentByResend) {
    // 여기서 던지는 예외는 호출부(AuthProvider)가 그대로 처리한다(그동안 해오던 것과 동일).
    await sendEmailVerification(user);
  }
}
