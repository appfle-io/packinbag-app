// 마스터(운영자) 계정 이메일 판정 모듈.
// GitHub 등 공개 저장소에 개인 이메일이 노출되지 않도록 환경변수(NEXT_PUBLIC_MASTER_EMAILS)에서 읽어온다.

export function getMasterEmails(): string[] {
  const raw = process.env.NEXT_PUBLIC_MASTER_EMAILS || process.env.MASTER_EMAILS || "";
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
