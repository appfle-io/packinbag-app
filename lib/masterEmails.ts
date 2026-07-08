// 공지사항 작성 권한을 가진 마스터 계정 이메일 목록.
// 여기 있는 이메일로 로그인한 사람에게만 설정 화면에 "공지사항 관리(작성)" 진입점이 보인다.
// (실제 쓰기 권한 제한은 firestore.rules에서도 동일한 목록으로 한 번 더 검증한다)
export const MASTER_EMAILS = [
  "appfle.dev@gmail.com",
  "appfle.io@gmail.com",
  "dg931217@naver.com",
];

export function isMasterEmail(email?: string | null): boolean {
  return !!email && MASTER_EMAILS.includes(email);
}
