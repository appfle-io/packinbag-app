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
    version: "1.0.34",
    date: "2026-10-13",
    items: [
      "가방 · 팩을 나만 잠글 수 있어요(PIN, iPhone은 Face ID도)",
      "잠금화면에 띄우기: 글자색을 고르고 미리 보며 꾸며요",
      "홈 화면 위젯: 중간 · 크게에서 1열 · 2열을 골라요",
      "잠금화면에서 체크하면 바로 챙긴 쪽으로 정리돼요",
      "위젯 · 잠금화면에서 체크한 것을 ↶로 하나씩 되돌려요",
      "위젯 · 잠금화면에서 다 챙긴 아이템을 숨길 수 있어요",
      "iPhone 검색 · Siri에서 가방 · 팩 이름으로 찾아 바로 열어요",
      "공유 링크를 누르면 팩인백 앱에서 바로 열려요",
    ],
  },
  {
    version: "1.0.32",
    date: "2026-10-11",
    items: [
      "iPhone 홈 화면 위젯: 가방이나 팩을 골라 위젯에서 바로 체크해요",
      "잠금화면에 띄우기: 잠금화면과 다이내믹 아일랜드에서 체크해요",
      "알림: 함께 쓰는 가방 소식 · 나에게 맡긴 아이템 · D-Day · 요일 반복",
      "단축어 · Siri: 빠른팩에 입력, 가방에 추가",
    ],
  },
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
