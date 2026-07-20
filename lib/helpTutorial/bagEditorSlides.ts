import { HelpSlide } from "@/components/HelpTutorialModal";

// 가방 화면 물음표(?) 버튼 -> 도움말 슬라이드 목록.
// 이미지는 public/help/bag-editor/slide1.png ~ slide7.png 로 직접 넣어둔다
// (help_slide_generator.py 로 생성한 결과물을 그 경로에 복사).
// 이미지를 새로 만들거나 순서를 바꾸면 이 배열만 그에 맞게 수정하면 된다.
export const bagEditorHelpSlides: HelpSlide[] = [
  { src: "/help/bag-editor/slide1.png", alt: "제일 상단 (뒤로가기 / 그룹원 보기 / 그룹 초대 / 가방 삭제 / AI 정리)" },
  { src: "/help/bag-editor/slide2.png", alt: "가방 정보 (이름 / 메모 / 디데이 / 사진·PDF 추가)" },
  { src: "/help/bag-editor/slide3.png", alt: "팩 상단 버튼 (불러오기 / 추가 / 메모장뷰 / 숨기기 / 내용추가 / 확장 / 접기·펼치기)" },
  { src: "/help/bag-editor/slide4.png", alt: "팩 카드 헤더 (순서변경 / 완료개수 / 크게보기 / 접기·펼치기)" },
  { src: "/help/bag-editor/slide5.png", alt: "길게 눌러서 드래그하기 (팩 순서·이동 / 짐 순서 바꾸기)" },
  { src: "/help/bag-editor/slide6.png", alt: "짐(항목) 체크 / 수정 / 삭제" },
  { src: "/help/bag-editor/slide7.png", alt: "팩 카드 하단 (보관함 저장 / 팩 삭제)" },
];
