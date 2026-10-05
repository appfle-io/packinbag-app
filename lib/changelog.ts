// 앱 버전 + 업데이트 노트. 버전 숫자는 package.json에서 그대로 가져온다(npm version으로 올리면 자동 반영).
// 새 버전을 배포할 때 사용자에게 알릴 내용이 있으면 배열 맨 앞에 항목을 추가한다 (최신순).
import { version } from "../package.json";

export const APP_VERSION: string = version;

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.20",
    date: "2026-10-05",
    items: [
      "새 디자인으로 앱 전체를 바꿨어요",
      "넓은 화면에서 목록과 내용을 나란히 볼 수 있어요",
      "인터넷이 끊겨도 이어서 쓰고, 연결되면 알아서 올라가요",
      "설정에서 앱 글꼴을 고를 수 있어요",
    ],
  },
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
