// Firebase 에러 객체에서 code만 뽑아서 토스트 메시지에 붙이기 위한 헬퍼.
// (예: "permission-denied", "failed-precondition" 등) 콘솔을 안 봐도
// 화면에서 바로 원인을 알 수 있게 하기 위함.
export function firebaseErrorCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return "unknown";
}
