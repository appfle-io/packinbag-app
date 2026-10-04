// Firebase Auth 에러 메시지를 사용자 친화적인 한국어 문구로 바꿔주는 헬퍼.
// 로그인/가입/비밀번호 찾기/비밀번호 변경/탈퇴 화면에서 공통으로 사용한다.
// 빈 문자열("")은 "사용자가 스스로 닫은 것이라 알릴 필요 없음"이라는 뜻이다.
export function friendlyAuthError(raw: string): string {
  // 앱이 직접 만든 한국어 안내(예: 탈퇴 재로그인 안내)는 그대로 보여 준다
  if (/[가-힣]/.test(raw)) return raw;
  if (raw.includes("email-already-in-use")) return "이미 가입된 이메일이에요.";
  if (raw.includes("invalid-email")) return "이메일 형식을 확인해주세요.";
  if (raw.includes("weak-password")) return "비밀번호는 6자 이상이어야 해요.";
  if (raw.includes("missing-password")) return "비밀번호를 입력해주세요.";
  if (raw.includes("wrong-password") || raw.includes("invalid-credential"))
    return "이메일 또는 비밀번호가 맞지 않아요.";
  if (raw.includes("user-not-found")) return "가입되지 않은 이메일이에요.";
  if (raw.includes("user-mismatch")) return "지금 로그인한 계정과 다른 계정을 골랐어요. 같은 계정으로 다시 확인해주세요.";
  if (raw.includes("user-disabled")) return "사용이 중지된 계정이에요. 문의해주세요.";
  if (raw.includes("too-many-requests"))
    return "잠시 후 다시 시도해주세요. 시도 횟수가 너무 많아요.";
  if (raw.includes("network-request-failed"))
    return "인터넷에 연결되지 않았어요. 연결을 확인하거나 오프라인 모드로 써 주세요.";
  if (raw.includes("requires-recent-login"))
    return "보안을 위해 로그아웃 후 다시 로그인한 뒤 시도해주세요.";
  if (raw.includes("unauthorized-domain"))
    return "이 환경에서는 이 로그인 방법을 쓸 수 없어요. 이메일로 로그인하거나 오프라인 모드를 이용해주세요.";
  if (raw.includes("operation-not-allowed")) return "지금은 이 로그인 방법을 쓸 수 없어요. 다른 방법으로 로그인해주세요.";
  if (raw.includes("popup-blocked")) return "로그인 창이 막혔어요. 팝업을 허용하거나 이메일로 로그인해주세요.";
  if (
    raw.includes("popup-closed-by-user") ||
    raw.includes("cancelled-popup-request") ||
    /user[ _-]?cancel/i.test(raw) ||
    /canceled|cancelled/i.test(raw)
  )
    return "";
  return "문제가 발생했어요. 다시 시도해주세요.";
}
