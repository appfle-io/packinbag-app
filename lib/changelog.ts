// 앱 버전 + 업데이트 노트. package.json의 version과 값을 맞춰서 함께 관리한다.
// 새 버전을 배포할 때마다 배열 맨 앞에 새 항목을 추가한다 (최신순).
export const APP_VERSION = "1.1.0";

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2026-07-13",
    items: [
      "새 버전이 배포되면 알림벨에 자동으로 NEW 표시가 뜬다 (누르면 새로고침)",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-07-08",
    items: [
      "공지사항 기능 추가 (운영자 작성, 노출기간, 다시 보지 않기)",
      "자주 묻는 질문(FAQ) 추가",
      "가방 그룹원 관리 화면 추가 (멤버 목록, 강퇴, 초대코드 재발급)",
      "여행일 D-Day 리마인더 추가 (가방에 여행 날짜와 알림 시점 설정)",
      "글자 크기 조절, 시작 화면 기본값 설정 추가",
      "버전 정보, 오픈소스 라이선스 화면 추가",
    ],
  },
];
