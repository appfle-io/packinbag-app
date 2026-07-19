// AI 기능 일일 사용량 관련 공용 설정/순수 함수.
// firebase-admin이나 firebase(client) SDK를 import하지 않아서 클라이언트/서버 어디서든
// 안전하게 가져다 쓸 수 있다. 숫자/날짜 기준이 클라이언트 표시용과 서버 검증용에서
// 어긋나지 않도록 이 파일 하나로 통일한다.

export const AI_FREE_DAILY_LIMIT = 10;
export const UNLOCK_CODE_LENGTH = 10;

// 하루 구분은 한국 시간(KST) 자정 기준.
export function todayKstKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateRandomCode(length = UNLOCK_CODE_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// ---- 이용권 기간 ----

export type UnlockDurationType = "unlimited" | "7d" | "1m" | "1y" | "custom";

export const UNLOCK_DURATION_LABELS: Record<UnlockDurationType, string> = {
  unlimited: "무제한",
  "7d": "7일",
  "1m": "1개월",
  "1y": "1년",
  custom: "직접 입력",
};

// durationType에 해당하는 일수를 반환한다. null이면 "무제한"(만료 없음).
// custom인데 customDays가 유효하지 않으면 안전하게 무제한으로 취급한다.
export function durationTypeToDays(
  type: UnlockDurationType,
  customDays?: number | null
): number | null {
  switch (type) {
    case "unlimited":
      return null;
    case "7d":
      return 7;
    case "1m":
      return 30;
    case "1y":
      return 365;
    case "custom":
      return customDays && customDays > 0 ? Math.floor(customDays) : null;
    default:
      return null;
  }
}
