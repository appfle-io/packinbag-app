import { InquiryCategory } from "@/lib/types";

// 문의하기 작성 시 고르는 분류 - 화면(가방 편집/팩 보관함/설정 등) 어디서 겪은 문제인지
// 빠르게 구분하기 위한 용도. 관리자 목록에서도 이 라벨로 필터/구분한다.
export const INQUIRY_CATEGORY_OPTIONS: InquiryCategory[] = ["bag", "pack", "ai", "other"];

export const INQUIRY_CATEGORY_LABELS: Record<InquiryCategory, string> = {
  bag: "가방",
  pack: "팩",
  ai: "AI 기능",
  other: "그 외",
};
