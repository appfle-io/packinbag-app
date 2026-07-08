// Firebase Auth 에러 메시지를 사용자 친화적인 한국어 문구로 바꿔주는 헬퍼.
// 로그인/가입/비밀번호 찾기/비밀번호 변경 화면에서 공통으로 사용한다.
export function friendlyAuthError(raw: string): string {
  if (raw.includes("email-already-in-use")) return "이미 가입된 이메일이에요.";
  if (raw.includes("invalid-email")) return "이메일 형식을 확인해주세요.";
  if (raw.includes("weak-password")) return "비밀번호는 6자 이상이어야 해요.";
  if (raw.includes("wrong-password") || raw.includes("invalid-credential"))
    return "이메일 또는 비밀번호가 맞지 않아요.";
  if (raw.includes("user-not-found")) return "가입되지 않은 이메일이에요.";
  if (raw.includes("too-many-requests"))
    return "잠시 후 다시 시도해주세요. 시도 횟수가 너무 많아요.";
  if (raw.includes("requires-recent-login"))
    return "보안을 위해 로그아웃 후 다시 로그인한 뒤 시도해주세요.";
  if (raw.includes("popup-closed-by-user")) return "";
  return "문제가 발생했어요. 다시 시도해주세요.";
}
