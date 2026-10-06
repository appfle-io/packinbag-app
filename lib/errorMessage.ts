import { reportFirestoreError } from "@/lib/v2/firestoreRecovery";

// Firebase 에러 객체에서 code만 뽑아서 토스트 메시지에 붙이기 위한 헬퍼.
// (예: "permission-denied", "failed-precondition" 등) 콘솔을 안 봐도
// 화면에서 바로 원인을 알 수 있게 하기 위함.
// 앱의 실패 처리 대부분이 여기를 거치므로, Firestore가 멈춘 오류(내부 검사 실패)도 여기서 알려 복구를 시작한다.
export function firebaseErrorCode(err: unknown): string {
  reportFirestoreError(err);
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return "unknown";
}
