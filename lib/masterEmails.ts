// 마스터(운영자) 계정 이메일 판정 모듈. 서버 전용.
//
// 2026-10-09: 예전에는 NEXT_PUBLIC_MASTER_EMAILS(브라우저로 내려가는 환경변수)에서 읽어, 운영자 이메일이
// 앱 코드에 그대로 보였다. 이제 서버 전용 MASTER_EMAILS만 읽는다(Vercel·.env.local에 MASTER_EMAILS로 등록).
// 브라우저에서 부르면 값이 없어 항상 false - 화면은 users 문서의 role === "master"로 판단한다
// (마스터가 앱을 열면 /api/auth/master-status가 role·masters 문서·Custom Claims를 맞춰 둔다).
// 이메일은 반드시 인증된 것만 넘긴다(lib/premiumServer.ts verifyRequestUser).

function getMasterEmails(): string[] {
  const raw = process.env.MASTER_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isMasterEmail(email?: string | null): boolean {
  if (!email) return false;
  const target = email.trim().toLowerCase();
  return getMasterEmails().includes(target);
}
