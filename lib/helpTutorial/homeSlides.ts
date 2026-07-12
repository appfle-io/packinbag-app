import { HelpSlide } from "@/components/HelpTutorialModal";

// 가방 목록(홈) 화면 물음표(?) 버튼 -> 도움말 슬라이드 목록.
// 이미지는 public/help/home/slide1.png ~ slide5.png 로 직접 넣어둔다
// (help_slide_generator.py 스타일로 생성한 결과물을 그 경로에 복사).
export const homeHelpSlides: HelpSlide[] = [
  { src: "/help/home/slide1.png", alt: "가방 목록 상단 (설정 / 코드로 참여 / 정렬 순서)" },
  { src: "/help/home/slide2.png", alt: "가방 카드 (고정 / 디데이 / 그룹원 수 / 진행률)" },
  { src: "/help/home/slide3.png", alt: "새 가방 만들기" },
  { src: "/help/home/slide4.png", alt: "빠른팩" },
  { src: "/help/home/slide5.png", alt: "하단 메뉴 (팩 관리 / 추가 / 가방)" },
];
