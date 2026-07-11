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
  // [사용 안 함 - UserProfile.packDisplayStates로 이전됨] 예전에는 이 팩의 펼침/접힘/넓게보기
  // 상태를 여기(가방 문서, 그룹 전체 공유)에 저장했는데, 그룹원끼리 접고 펴는 상태가 서로
  // 동기화되는 문제가 있어 사용자별 설정(계정 저장, 기기 간 유지)으로 옮겼다. 예전 데이터
  // 호환을 위해 필드는 남겨두되 더 이상 읽거나 쓰지 않는다.
  displayState?: "normal" | "wide" | "collapsed";
  // true면 이 팩은 하단 "+"(빠른입력) 버튼으로 만들어지는 시스템 팩("빠른팩")이다.
  // 사용자당 최대 1개, id는 항상 QUICK_PACK_ID(lib/premiumLimits.ts) 고정값을 쓴다.
  // 무료 라이브러리 개수 제한(FREE_MAX_LIBRARY_PACKS)과 잠금 대상 계산에서 항상 제외되고,
  // 아이템이 0개가 되면 화면에서는 숨겨지지만(HIDE) 문서 자체는 삭제되지 않는다 -
  // 다음에 다시 빠른입력하면 그대로 재사용된다.
  isQuickPack?: boolean;
  // 이용권이 없거나 만료/무효화된 사람이 라이브러리 개수 제한(FREE_MAX_LIBRARY_PACKS)을
  // 넘겨서 갖고 있던 팩 중 "최신 N개"에 들지 못한 것에 true로 표시된다. 서버(app/api/sync-lock-status)만
  // 이 필드를 쓸 수 있고(firestore.rules에서 클라이언트 수정/삭제를 막음), 잠긴 팩은 보기만
  // 가능하고 수정/삭제는 막힌다. 다시 이용권을 등록하면 서버가 자동으로 false로 되돌려준다.
  locked?: boolean;
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
  // 소유자(ownerId)가 이용권이 없거나 만료/무효화된 상태에서, 본인이 소유한 가방 중
  // 동시 진행 개수 제한(FREE_MAX_ACTIVE_BAGS)을 넘겨서 "최신 N개"에 들지 못한 가방에
  // true로 표시된다. 서버(app/api/sync-lock-status)만 이 필드를 쓸 수 있고(firestore.rules/
  // storage.rules에서 소유자의 수정·삭제·이미지 업로드를 막음), 다른 그룹원은 이 값과
  // 무관하게 그대로 이용할 수 있다(규칙에서 request.auth.uid == ownerId 조건과 함께 검사).
  // 잠긴 가방은 보기만 가능하고 수정/삭제/공유 관련 동작은 모두 막힌다.
  locked?: boolean;
}

// 회원가입 시 고를 수 있는 간단한 샘플 아바타 중 하나의 id (avatars.ts 참고)
export type AvatarId = string;

// 가방/팩 목록 정렬 기준 (둘 다 같은 옵션 구성). "custom"은 고정핀 + 사용자가 길게 눌러서
// 끌어다 놓은 순서(pinnedXIds/xOrder, UserProfile 참고)를 따르는 모드로, 드래그 리오더를
// 시작하는 순간 자동으로 이 값으로 전환된다.
export type ListSortOption = "createdAt" | "nameAsc" | "nameDesc" | "updatedAt" | "custom";

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
  // 카드 안 여백·아이콘을 배율 적용 (팩 카드는 글자 크기가 아래 packCardFontScale로
  // 분리되어 있고, 가방 카드/팩 라이브러리 타일은 기존처럼 글자도 함께 배율 적용됨)
  bagCardScale?: number;
  packCardScale?: number;
  packLibraryCardScale?: number;
  // 가방 속 팩 카드 안 글자 크기 배율 (없으면 1 = 100%). packCardScale(카드 크기)과
  // 분리되어 독립적으로 조절 가능 - 패딩/아이콘/간격은 packCardScale을, 팩 이름·짐
  // 텍스트·짐 개수 등 글자 크기는 이 값을 따른다 (앱 전체 글자 크기 설정과도 곱해짐)
  packCardFontScale?: number;
  // 글자 크기 (없으면 "md" 기본값)
  fontScale?: "sm" | "md" | "lg";
  // 앱 실행 시 처음 보여줄 탭 (없으면 "home" 기본값)
  defaultTab?: "home" | "packs";
  // "다시 보지 않기" 처리한 공지사항 id 목록
  dismissedAnnouncementIds?: string[];
  // 가방/팩 목록 정렬 기준 (없으면 "createdAt" 기본값)
  bagSortBy?: ListSortOption;
  packSortBy?: ListSortOption;
  // 고정핀 처리한 가방/팩 id (각각 최대 2개, 그리드 맨 앞에 고정되고 드래그 대상에서 제외됨)
  pinnedBagIds?: string[];
  pinnedPackIds?: string[];
  // "custom"(사용자설정순) 정렬일 때 쓰는 직접 지정한 순서(id 배열, 고정된 항목 제외).
  // 여기 없는 새 항목은 뒤쪽에 생성일자 최신순으로 자동으로 붙는다.
  bagOrder?: string[];
  packOrder?: string[];
  // 팩(짐 목록) 표시 관련 개인 설정
  packSettings?: {
    // 체크된 항목을 목록 맨 아래로 내려서 보여줄지 (없으면 true 기본값)
    moveCompletedToBottom?: boolean;
    // ON이면 가방에 들어갈 때마다(진입 시점만) 모든 팩이 접힌 상태로 시작한다.
    // 저장된 Pack.displayState는 전혀 바꾸지 않고(진입 시 적용되는 화면 표시만 덮어씀),
    // 진입 후에는 평소처럼 자유롭게 펼치고 접을 수 있다. 없으면 false(기본) 기본값.
    alwaysCollapseOnEntry?: boolean;
  };
  // 하단 QuickPackBar(빠른팩 미리보기)를 접어서 오른쪽 끝에 떠있는 작은 원형 버튼으로만
  // 보여줄지. 없으면 false(펼쳐진 바 형태) 기본값. 계정에 저장되어 기기/화면(팩·가방)
  // 어디서나 동일하게 적용된다.
  quickPackCollapsed?: boolean;
  // 가방 속 팩의 펼침/접힘/넓게보기 상태(카드뷰)와 섹션 접기(메모장뷰). 그룹원과는
  // 절대 동기화되지 않고(각자 자기 화면에만 적용), 같은 사용자가 다른 기기에서 다시 로그인해도
  // 그대로 유지된다(계정에 저장되므로). 키는 `${bagId}:${packId}` 형태.
  packDisplayStates?: Record<string, "normal" | "wide" | "collapsed">;
  // 가방별 보기 방식(팩뷰/메모장뷰) 개별 오버라이드. 키는 bagId, 값이 없으면
  // 아래 defaultBagViewMode(전역 기본값)를 따른다. 이것도 packDisplayStates처럼 그룹원과는
  // 동기화되지 않는 사용자별 설정이다.
  bagViewMode?: Record<string, "pack" | "notebook">;
  // 설정 > 가방설정에서 고르는 새 가방의 기본 보기 방식 (없으면 "pack"(팩뷰) 기본값).
  // "notebook"은 팩을 헤더+내용으로 이어지는 문서형(메모장) 레이아웃으로 보여준다.
  defaultBagViewMode?: "pack" | "notebook";
  // AI 기능(메모/샘플 가져오기, 가방 속 AI 정리) 일일 무료 사용량.
  // date가 오늘(KST)과 다르면 count는 0으로 취급한다 (lib/aiUsageService.ts 참고)
  aiUsage?: {
    date: string; // YYYY-MM-DD (KST)
    count: number;
  };
  // 이용권 코드를 입력해서 무제한 인증을 받은 경우, 그 코드 값(있으면 무제한).
  // 나중에 유료회원 필드(isPremium 등)가 추가되면 그쪽도 함께 무제한 조건에 포함시킬 예정.
  unlockCode?: string;
  // unlockCode의 만료 시각(ISO). null/undefined면 "무제한" 코드라 만료가 없다는 뜻.
  // 코드 자체(unlockCodes/{code}.expiresAt)에 있는 값을 클라이언트가 매번 다시 조회하지
  // 않아도 되게 이 필드에도 그대로 복사해둔다(redeem 서버 라우트가 두 곳에 동시에 씀).
  unlockCodeExpiresAt?: string | null;
  // unlockCodes/{unlockCode} 문서를 AuthProvider가 실시간 구독(onSnapshot)해서 지금 이
  // 순간 실제로 무효화/만료됐는지 담아두는 값이다. Firestore에는 저장되지 않고 클라이언트
  // 메모리에만 있는 값(=매 세션 다시 계산됨). 왜 필요한가: 마스터가 "무효화"를 누르면
  // unlockCodes/{code}.status만 바뀌고 users/{uid} 문서는 안 건드리기 때문에, 캐시된
  // unlockCodeExpiresAt만 보면 무효화를 실시간으로 알 수 없다. lib/premiumLimits.ts의
  // isPremiumUser/isUnlimitedAiUser가 unlockCodeExpiresAt보다 이 값을 우선한다.
  unlockCodeLiveStatus?: "active" | "invalidated" | "expired" | null;
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
