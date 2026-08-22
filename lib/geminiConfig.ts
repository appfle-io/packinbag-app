/**
 * Gemini AI 모델 공용 설정 및 엔드포인트 관리
 * 향후 모델 변경 시 이 파일의 GEMINI_MODEL 상수만 수정하면 전체 API 라우트에 즉시 적용됩니다.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";

/**
 * Google Generative Language API 엔드포인트 URL 생성 헬퍼
 */
export function getGeminiEndpoint(model: string = GEMINI_MODEL): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}
