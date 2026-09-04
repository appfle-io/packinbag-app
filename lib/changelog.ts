// 앱 버전 + 업데이트 노트. package.json의 version과 값을 맞춰서 함께 관리한다.
// 새 버전을 배포할 때마다 배열 맨 앞에 새 항목을 추가한다 (최신순).
export const APP_VERSION = "1.0.0";

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2026-09-04",
    items: [
      "팩인백 정식 서비스 오픈",
      "가방 및 팩 보관함 관리",
      "체크리스트 및 메모팩 작성",
      "데스크톱 및 오프라인 모드 지원",
    ],
  },
];
