/**
 * Gemini AI 모델 공용 설정 및 엔드포인트 관리
 * 향후 모델 변경 시 이 파일의 GEMINI_MODEL 상수만 수정하면 전체 API 라우트에 즉시 적용됩니다.
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";
// 가벼운 추천(날씨 아이템 4개)에 쓰는 싼 모델. 예전에는 app/api/ai-weather-recommend에 주소가 직접 적혀 있었다(2026-10-16)
export const GEMINI_LITE_MODEL = process.env.GEMINI_LITE_MODEL || "gemini-2.5-flash-lite";

/**
 * Google Generative Language API 엔드포인트 URL 생성 헬퍼
 */
export function getGeminiEndpoint(model: string = GEMINI_MODEL): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}
