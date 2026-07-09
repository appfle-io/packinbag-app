// 팩인백 데이터 모델
// 가방(Bag) = 체크리스트, 팩(Pack) = 카테고리 묶음, 짐(Item) = 개별 항목

export type ItemType = "check" | "text";

export interface RichSpan {
  text: string;
  bold?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export interface Item {
  id: string;
  type: ItemType;
  // check 타입: text가 단순 문자열, checked 사용
  // text 타입: spans로 부분 서식(굵게/밑줄/취소선) 표현 (현재는 미사용,
  // 텍스트 전체에 적용되는 bold/strike/color 필드를 대신 사용)
  text: string;
  checked?: boolean;
  spans?: RichSpan[];
  // text 타입 전용 - 텍스트 전체에 적용되는 간단 서식
  bold?: boolean;
  strike?: boolean;
  color?: string; // hex, 없으면 기본 텍스트 색상
}

export interface Pack {
  id: string;
  name: string;
  items: Item[];
  // 이 팩이 이미 라이브러리에 저장된 적이 있는지 (북마크 채움 여부)
  savedAsLibraryPack?: boolean;
  // 이 팩이 어떤 라이브러리 팩과 연결돼있는지 (새로고침 대상)
  linkedLibraryPackId?: string;
  // 마지막으로 라이브러리와 동기화(저장/덮어쓰기/새로고침)했던 시점의 라이브러리 팩 updatedAt.
  // 저장 시점에 라이브러리 쪽 updatedAt이 이 값보다 더 최신이면 "다른 가방/기기에서
  // 먼저 바뀐 것"으로 판단해 덮어쓰기 대신 새롭게 저장을 유도한다.
  linkedLibraryUpdatedAt?: string;
  createdAt?: string; // 라이브러리 팩 정렬(생성일자)용. 최초 저장 시점에 서버에서 채워짐
  updatedAt?: string;
  // 팩 카드/태그에 보여줄 색상 프리셋 id (lib/packColors.ts 참고). 없으면 무색.
  color?: string;
}

// 가방 멤버의 표시용 정보 (닉네임/아바타). users/{uid} 문서는 본인만 읽을 수 있어서
// 다른 멤버가 조회할 수 없기 때문에, 가방 문서 자체에 스냅샷으로 들고 있는다.
// (참여/탈퇴/강퇴 시점에 갱신. 닉네임을 바꾼 직후에는 다음 참여/저장 전까지 약간 오래된 값일 수 있음)
export interface BagMemberProfile {
  nickname: string;
  avatarId: string;
  joinedAt: string;
}

// 여행일 하루 전/당일 등 언제 D-Day 리마인더를 보낼지 (0 = 당일, 1 = 1일 전, 3 = 3일 전)
export type ReminderOffset = 0 | 1 | 3;

// 가방이 곧 공유 단위. 가방마다 초대코드가 있고, 그 코드로 들어온 사람만
// 이 가방을 보고 동시에 편집할 수 있다. 팩 라이브러리는 공유되지 않는다 -
// 다른 사람이 이 가방에 불러온 팩이 마음에 들면 북마크로 "내" 라이브러리에
// 따로 복사해서 저장해야 한다 (가방 안의 팩과는 이후 연동되지 않음).
export interface Bag {
  id: string;
  name: string;
  images: string[]; // 최대 3장, 스토리지 경로/URL
  packs: Pack[]; // 최대 10개
  memberIds: string[]; // 이 가방에 접근 가능한 사람들 (최대 10명)
  memberProfiles?: Record<string, BagMemberProfile>; // memberIds 각각의 닉네임/아바타 스냅샷
  ownerId: string;
  inviteCode: string; // 가방 참여용 코드 (초대링크에도 사용)
  createdAt: string;
  updatedAt: string;
  // 가방 상단에 공지사항처럼 적어두는 짧은 메모. 함께 보는 사람들에게 보여요.
  notice?: string;
  // 여행일 (D-Day 리마인더용). 지정 안 하면 배지/알림 없음.
  travelDate?: string; // YYYY-MM-DD
  reminderOffsets?: ReminderOffset[]; // 예: [3, 1, 0] = 3일전/1일전/당일 알림 (발송 로직은 추후 구현)
}

// 회원가입 시 고를 수 있는 간단한 샘플 아바타 중 하나의 id (avatars.ts 참고)
export type AvatarId = string;

// 가방/팩 목록 정렬 기준 (둘 다 같은 옵션 구성)
export type ListSortOption = "createdAt" | "nameAsc" | "nameDesc" | "updatedAt";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  nickname: string | null; // 최대 12자, 설정에서 자유롭게 수정 가능
  avatarId: AvatarId | null;
  createdAt?: string;
  // 화면 모드/강조 색상 - 계정에 저장해서 기기 간 동기화 (없으면 기기 로컬 값 사용)
  themeMode?: "system" | "light" | "dark";
  accentId?: string;
  customAccentHex?: string;
  // 가방 카드 배경 톤 / 팩 카드 배경 톤 (없으면 "default" = 기본 무채색 배경)
  bagColorId?: string;
  customBagColorHex?: string;
  packGridColorId?: string;
  customPackGridColorHex?: string;
  packLibraryColorId?: string;
  customPackLibraryColorHex?: string;
  // 가방/팩 카드 배경색 투명도 (0~1, 없으면 1 = 완전 불투명). 기본색(default)일 때도 적용됨 -
  // 낮출수록 카드 뒤 배경(라이트=흰색/다크=검정)이 비쳐 보임
  bagColorOpacity?: number;
  packGridColorOpacity?: number;
  packLibraryColorOpacity?: number;
  // 기본 투명도 (0~1, 없으면 1 = 완전 불투명): 하단 탭바, 필터 버튼, 짐(체크/텍스트) 배경,
  // 설정 메뉴 미선택 버튼 배경 등 --surface-2를 쓰는 모든 요소에 공통 적용됨
  baseOpacity?: number;
  // 가방 카드 / 팩 카드(가방 속) / 팩 라이브러리 타일 크기 배율 (없으면 1 = 100%).
  // 카드 안 여백·아이콘·글자를 함께 배율 적용
  bagCardScale?: number;
  packCardScale?: number;
  packLibraryCardScale?: number;
  // 글자 크기 (없으면 "md" 기본값)
  fontScale?: "sm" | "md" | "lg";
  // 앱 실행 시 처음 보여줄 탭 (없으면 "home" 기본값)
  defaultTab?: "home" | "packs";
  // "다시 보지 않기" 처리한 공지사항 id 목록
  dismissedAnnouncementIds?: string[];
  // 가방/팩 목록 정렬 기준 (없으면 "createdAt" 기본값)
  bagSortBy?: ListSortOption;
  packSortBy?: ListSortOption;
  // 팩(짐 목록) 표시 관련 개인 설정
  packSettings?: {
    // 체크된 항목을 목록 맨 아래로 내려서 보여줄지 (없으면 true 기본값)
    moveCompletedToBottom?: boolean;
  };
  // AI 기능(메모/샘플 가져오기, 가방 속 AI 정리) 일일 무료 사용량.
  // date가 오늘(KST)과 다르면 count는 0으로 취급한다 (lib/aiUsageService.ts 참고)
  aiUsage?: {
    date: string; // YYYY-MM-DD (KST)
    count: number;
  };
  // 이용권 코드를 입력해서 무제한 인증을 받은 경우, 그 코드 값(있으면 무제한).
  // 나중에 유료회원 필드(isPremium 등)가 추가되면 그쪽도 함께 무제한 조건에 포함시킬 예정.
  unlockCode?: string;
}

// 새 가방을 만들 때(AI 가져오기/샘플/AI 해시태그 생성) 공통으로 쓰는 결과 형태.
// items는 문자열(체크형 기본)이거나, 타입을 직접 지정하고 싶을 때(예: 업무 보드 샘플의
// 텍스트형 카드)는 객체 형태로 줄 수 있다.
export interface ImportedItemDraft {
  text: string;
  type?: ItemType; // 없으면 "check" 기본값
}

export interface ImportedPackDraft {
  name: string;
  items: (string | ImportedItemDraft)[];
}

export interface ImportedBagResult {
  bagName: string;
  packs: ImportedPackDraft[];
}

// 마스터 계정이 작성하는 공지사항. 노출기간(startDate~endDate) 안에 있고
// 사용자가 다시 보지 않기 처리를 안 한 것만 앱 진입시 모달로 보여준다.
export interface Announcement {
  id: string;
  title: string;
  content: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  createdBy: string;
  createdAt: string;
}

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

// 가방 편집 화면에 실시간으로 접속 중인 사람 표시용
export interface PresenceEntry {
  uid: string;
  nickname: string;
  avatarId: AvatarId;
  updatedAt: number; // epoch ms, 클라이언트에서 오래된 항목 필터링용
}
