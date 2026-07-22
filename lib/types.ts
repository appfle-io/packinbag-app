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
  // v70+ 에디터팩(자유문서형 팩). 없으면(예전 데이터 포함) "checklist"로 취급 - 지금까지의
  // 구조화된 짐(Item) 배열 방식. "editor"면 items는 항상 빈 배열이고 실제 내용은 아래
  // editorDoc(TipTap JSON 블록 문서)에 들어있다 - 아이폰 메모처럼 체크박스/제목/표가 순서대로
  // 섞인 자유 문서. AI 자동분류(메모 가져오기/해시태그) 대상에서 제외되고, 완료율(진행률 링)
  // 계산에서도 제외된다(items가 항상 []이라 getProgressRatio가 자연히 null을 반환함).
  kind?: "checklist" | "editor";
  // "editor" 팩의 실제 내용 - TipTap(ProseMirror) JSON 문서. 크기는 lib/editorDocLimits.ts의
  // MAX_EDITOR_DOC_BYTES로 방어(Firestore 문서 1MB 제한 보호) - 그 이상은 저장 시 잘라내고
  // 안내한다.
  editorDoc?: object;
  // 메모팩(kind==='editor') 전용 글자 크기(px, 3~20, 없으면 10 기본값). 제목(h1/h2)은 고정 크기를 유지하고 본문만 이 값을
  // 따른다(app/globals.css .pib-note-editor h1/h2는 절대px라 컨테이너 font-size와 무관하게 고정됨). 개인 설정이 아니라
  // 팩(Pack) 자체에 저장되는 값이라, 함께 보는 모든 사람에게 동일하게 보인다(EditorPackCard/NotebookEditorPackSection
  // 미리보기에도 동일하게 적용).
  editorFontSize?: number;
  // 팩 카드(가방 속 미리보기)/팩 보관함 타일에 보여줄 일반 텍스트 요약. editorDoc을 저장할
  // 때마다 함께 갱신된다(전체 JSON을 매번 파싱해서 보여주지 않기 위한 캐시).
  editorPreviewText?: string;
  // v68+ 팩 보관함 폴더 기능. 없으면(예전 데이터) "pack"으로 취급한다. "folder"면 items는
  // 항상 빈 배열이고, 실제 내용물은 parentId로 이 폴더를 가리키는 다른 Pack들이다.
  type?: "pack" | "folder";
  // 이 팩/폴더가 속한 상위 폴더의 id. 없으면(undefined) 팩 보관함 최상위. 아이폰 메모처럼
  // 폴더 안에 폴더를 계속 만들 수 있어 깊이 제한이 없다.
  parentId?: string;
  // 이 팩이 이미 보관함에 저장된 적이 있는지 (북마크 채움 여부)
  savedAsLibraryPack?: boolean;
  // 이 팩이 어떤 보관함 팩과 연결돼있는지 (새로고침 대상)
  linkedLibraryPackId?: string;
  // 마지막으로 보관함과 동기화(저장/덮어쓰기/새로고침)했던 시점의 보관함 팩 updatedAt.
  // 저장 시점에 보관함 쪽 updatedAt이 이 값보다 더 최신이면 "다른 가방/기기에서
  // 먼저 바뀐 것"으로 판단해 덮어쓰기 대신 새롭게 저장을 유도한다.
  linkedLibraryUpdatedAt?: string;
  createdAt?: string; // 보관함 팩 정렬(생성일자)용. 최초 저장 시점에 서버에서 채워짐
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
  // 무료 보관함 개수 제한(FREE_MAX_LIBRARY_PACKS)과 잠금 대상 계산에서 항상 제외되고,
  // 아이템이 0개가 되면 화면에서는 숨겨지지만(HIDE) 문서 자체는 삭제되지 않는다 -
  // 다음에 다시 빠른입력하면 그대로 재사용된다.
  isQuickPack?: boolean;
  // 이용권이 없거나 만료/무효화된 사람이 보관함 개수 제한(FREE_MAX_LIBRARY_PACKS)을
  // 넘겨서 갖고 있던 팩 중 "최신 N개"에 들지 못한 것에 true로 표시된다. 서버(app/api/sync-lock-status)만
  // 이 필드를 쓸 수 있고(firestore.rules에서 클라이언트 수정/삭제를 막음), 잠긴 팩은 보기만
  // 가능하고 수정/삭제는 막힌다. 다시 이용권을 등록하면 서버가 자동으로 false로 되돌려준다.
  locked?: boolean;
  // 휴지통으로 보낸 시각(ISO). 있으면 팩 보관함 목록에서 숨겨지고 설정 > 휴지통에만
  // 보인다. 30일(TRASH_RETENTION_DAYS)이 지나면 클라이언트가 다음에 열릴 때 자동으로
  // 영구삭제된다(별도 서버 배치 없이 클라이언트가 열릴 때 검사). 복구(지우기)는 무료 개수
  // 제한 검증이 필요해서 클라이언트가 직접 지울 수 없고(firestore.rules) app/api/
  // restore-library-pack만 가능하다.
  trashedAt?: string;
  // 가방 "안"에서 삭제된 팩이 휴지통으로 올 때만 채워지는 출처 정보(가방 id/이름 스냅샷).
  // 라이브러리 화면에서 직접 휴지통으로 보낸 팩/폴더는 이 필드가 없다. 이름 스냅샷을
  // 같이 저장해두는 이유는 원본 가방이 그 사이에 이름이 바뀌거나 완전히 삭제될 수도
  // 있어서, 휴지통 화면에서 "어디서 삭제됐는지"를 항상 정확히 보여주기 위함이다.
  trashSourceBagId?: string;
  trashSourceBagName?: string;
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
// 이 가방을 보고 동시에 편집할 수 있다. 팩 보관함은 공유되지 않는다 -
// 다른 사람이 이 가방에 불러온 팩이 마음에 들면 북마크로 "내" 보관함에
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
  // 여행일이 지난 뒤(D+) 표시할 때, 여행 당일도 "1일째"로 셀지 (가방별 설정). 없으면
  // false 기본값 (여행 당일 = D-DAY, 다음날부터 D+1). true면 여행 당일부터 D+1로
  // 세서(1일째), 다음날은 D+2가 된다.
  ddayCountTodayAsDayOne?: boolean;
  // 소유자(ownerId)가 이용권이 없거나 만료/무효화된 상태에서, 본인이 소유한 가방 중
  // 동시 진행 개수 제한(FREE_MAX_ACTIVE_BAGS)을 넘겨서 "최신 N개"에 들지 못한 가방에
  // true로 표시된다. 서버(app/api/sync-lock-status)만 이 필드를 쓸 수 있고(firestore.rules/
  // storage.rules에서 소유자의 수정·삭제·이미지 업로드를 막음), 다른 그룹원은 이 값과
  // 무관하게 그대로 이용할 수 있다(규칙에서 request.auth.uid == ownerId 조건과 함께 검사).
  // 잠긴 가방은 보기만 가능하고 수정/삭제/공유 관련 동작은 모두 막힌다.
  locked?: boolean;
  // 소유자(ownerId)가 이 가방을 휴지통으로 보낸 시각(ISO). 있으면 소유자 본인의 홈 목록에서만
  // 숨겨지고 설정 > 휴지통에 나타난다 - 다른 그룹원들은 이 필드와 무관하게 가방을 계속
  // 그대로 볼 수 있다(소유자 화면에서만 휴지통 처리되는 정책). 30일(TRASH_RETENTION_DAYS)이
  // 지나면 클라이언트가 다음에 열릴 때 자동으로 영구삭제된다(별도 서버 배치 없이 클라이언트가
  // 열릴 때 검사). 복구(지우기)는 무료 동시 진행 개수 제한 검증이 필요해서 클라이언트가 직접
  // 지울 수 없고(firestore.rules) app/api/restore-bag만 가능하다.
  trashedByOwnerAt?: string;
}

// 새 가방을 만들 때(AI 가져오기/샘플/AI 해시태그 생성) 공통으로 쓰는 결과 형태의 참고용 주석은
// 파일 아래쪽 ImportedBagResult 근처에 있다.

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
  // 가방 카드 / 팩 카드(가방 속) / 팩 보관함 타일 크기 배율 (없으면 1 = 100%).
  // 카드 안 여백·아이콘을 배율 적용 (팩 카드는 글자 크기가 아래 packCardFontScale로
  // 분리되어 있고, 가방 카드/팩 보관함 타일은 기존처럼 글자도 함께 배율 적용됨)
  bagCardScale?: number;
  // 가방 보관함 그리드 열 개수(카드 크기) - "작게"를 고르면 한 화면에 더 많은 가방이
  // 보이도록 열이 늘어나고, "크게"를 고르면 열이 줄어 카드 하나하나가 커진다. 위
  // bagCardScale(글씨 크기)과는 별개로 작동한다 - 그건 카드 안 여백/글자 배율만
  // 조절하고, 이건 그리드 자체의 열 개수를 바꾼다. 없으면 "medium"(기존 2열) 기본값.
  bagCardSize?: "small" | "medium" | "large";
  packCardScale?: number;
  packLibraryCardScale?: number;
  // 가방 속 팩 카드 안 글자 크기 배율 (없으면 1 = 100%). packCardScale(카드 크기)과
  // 분리되어 독립적으로 조절 가능 - 패딩/아이콘/간격은 packCardScale을, 팩 이름·짐
  // 텍스트·짐 개수 등 글자 크기는 이 값을 따른다 (앱 전체 글자 크기 설정과도 곱해짐)
  packCardFontScale?: number;
  // 글자 크기 (없으면 "md" 기본값)
  fontScale?: "sm" | "md" | "lg";
  // v68: 하단탑이 가방보관함/설정 2개로 재개편되어 "packs" 옵션은 사라졌다(팩 트리는
  // 이제 스와이프로 열리는 풀스크린 화면임). 앱 실행 시 처음 보여줄 탭(없으면 "home" 기본값).
  defaultTab?: "home" | "settings" | "packs";
  // "다시 보지 않기" 처리한 공지사항 id 목록
  dismissedAnnouncementIds?: string[];
  // 가방/팩 목록 정렬 기준 (없으면 "createdAt" 기본값)
  bagSortBy?: ListSortOption;
  packSortBy?: ListSortOption;
  // 고정핀 처리한 가방/팩 id (각각 최대 2개, 그리드 맨 앞에 고정되고 드래그 대상에서 제외됨)
  pinnedBagIds?: string[];
  pinnedPackIds?: string[];
  // "보관" 처리한 가방 id (삭제와 다름 - 그냥 홈 목록의 "진행중" 탭에서 숨기고 "보관" 탭으로
  // 옮긴다. 개수 제한 없음, 언제든 되돌릴 수 있음). 휴지통(trashedByOwnerAt)과 달리 소유자가
  // 아니어도(공유받은 가방도) 각자 자기 화면에서만 보관 처리할 수 있다 - 그래서 가방 문서가
  // 아니라 이 프로필에 저장한다.
  archivedBagIds?: string[];
  // 여행일(D-Day)이 한참 지난 가방을 "보관함으로 옮길까요?" 배너로 제안했을 때, 사용자가
  // "닫기"로 넘긴 가방 id 목록. 한 번 넘긴 가방은 계속 다시 물어보지 않는다.
  archiveSuggestionDismissedIds?: string[];
  // "custom"(사용자설정순) 정렬일 때 쓰는 직접 지정한 순서(id 배열, 고정된 항목 제외).
  // 여기 없는 새 항목은 뒤쪽에 생성일자 최신순으로 자동으로 붙는다.
  bagOrder?: string[];
  packOrder?: string[];
  // v69: 폴더 트리에서 드래그로 순서를 바꿀(또는 다른 폴더로 옴긴) 결과를 부모(parentId)별로 따로 저장한다.
  // 키는 폴더 id, 최상위는 "root". 값은 packOrder와 동일하게 arrangeList의 order로 쓰이는
  // id 배열(그 레벨의 형제들만 해당)이다.
  packOrderByParent?: Record<string, string[]>;
  // 폴더 트리에서 펼쳐져있는 폴더 id 목록(계정에 저장되어 기기 간에도 동일하게 유지된다).
  expandedPackFolderIds?: string[];
  // 팩(짐 목록) 표시 관련 개인 설정
  packSettings?: {
    // 체크된 항목을 목록 맨 아래로 내려서 보여줄지 (없으면 true 기본값)
    moveCompletedToBottom?: boolean;
    // ON이면 가방에 들어갈 때마다(진입 시점만) 모든 팩이 접힌 상태로 시작한다.
    // 저장된 Pack.displayState는 전혀 바꾸지 않고(진입 시 적용되는 화면 표시만 덮어씀),
    // 진입 후에는 평소처럼 자유롭게 펼치고 접을 수 있다. 없으면 false(기본) 기본값.
    alwaysCollapseOnEntry?: boolean;
    // 짐 이름을 몇 줄까지 보여줄지 (없으면 1 기본값). 넘치는 내용은 ...으로 줄여 보여준다.
    itemMaxLines?: 1 | 2 | 3;
    // 짐 더블클릭 시 클립보드 복사 토스트를 몇 초간 띄울지 (없으면 3 기본값, 3~7 사이).
    itemCopyToastSeconds?: number;
    // v69: 가방보관함 왼쪽 가장자리에 뜨는 물방울 모양 스와이프 힌트(PackTreeSwipeHint)를
    // 보여줄지. 없으면 true(켜짐) 기본값. 힌트를 실제로 당겨서 팩 트리를 한 번 열면
    // 자동으로 false로 꺼지고(계정에 저장되어 기기 간 동기화), 여기서 다시 켤 수 있다.
    packTreeHintEnabled?: boolean;
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

// 문의하기 게시판. 카테고리 + 제목 + 내용으로 작성하고, 마스터(운영자) 계정만
// 전체 목록을 볼 수 있고 답변을 달 수 있다. 일반 사용자는 본인이 쓴 글만 볼 수 있다
// (firestore.rules에서 uid 일치 또는 마스터 이메일만 허용).
export type InquiryCategory = "bag" | "pack" | "ai" | "other";

export interface Inquiry {
  id: string;
  uid: string; // 작성자
  authorNickname: string; // 작성 시점 스냅샷(닉네임 바뀌어도 예전 글은 그대로)
  category: InquiryCategory;
  title: string;
  content: string;
  createdAt: string;
  status: "pending" | "answered";
  answer?: string;
  answeredAt?: string;
}

// 범용 알림함(users/{uid}/notifications). 지금은 "내 문의에 답변 달림" +
// "댓글에서 멘션됨" 두 종류. 나중에 푸시 기능이 추가되면 같은 구조에 type만
// 늘려가면서 쓰이도록 설계된다.
export type NotificationType = "inquiry_answered" | "comment_mention";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedId?: string; // 예: 해당 inquiry id, 또는 댓글 id
  // comment_mention 타입일 때만 사용 - 어느 가방에서 멘션됐는지(딥링크/권한검증용).
  relatedBagId?: string;
  createdAt: string;
  read: boolean;
}

// 댓글이 달리는 대상. "item"은 특정 짐(개별 항목), "bag"은 가방 전체(공지/자유 대화).
export type CommentTargetType = "item" | "bag";

// 가방 안 댓글. bags/{bagId}/comments 서브컬렉션에 저장되고, 그 가방 멤버끼리만
// 읽고 쓸 수 있다(firestore.rules). targetType='item'이면 targetId가 짐(Item.id),
// targetType='bag'이면 targetId는 그냥 bagId 자체(가방 전체 공지/자유 대화용).
export interface BagComment {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  packId?: string; // targetType='item'일 때, 그 짐이 속한 팩 id (필터링/딥링크용)
  authorUid: string;
  authorNickname: string; // 작성 시점 스냅샷(닉네임 바뀌어도 예전 댓글은 그대로)
  authorAvatarId: string;
  text: string; // 최대 500자
  mentions?: string[]; // 멘션된 멤버 uid 목록
  createdAt: string;
  updatedAt?: string; // 수정한 적 있으면 채워짐
}

// 짐/팩/가방에 다는 가벼운 이모지 리액션. 댓글보다 마찰이 적은 소통 수단.
// bags/{bagId}/reactions/{targetType_targetId} 문서 하나에 그 대상의 모든
// 이모지별 반응자를 모아서 저장한다(대상당 문서 1개, 실시간 구독 가볍게 하려는 목적).
export type ReactionTargetType = "item" | "comment" | "pack" | "bag";

// 프리셋 이모지 - 무한 이모지피커 대신 자주 쓸 법한 것들로 구성(10개).
export const REACTION_EMOJIS = [
  "👍", // 좋아요
  "❤️", // 사랑해요
  "😂", // 웃겨요
  "😮", // 놀람
  "😢", // 슬퍼요
  "🙏", // 감사해요/부탁해요
  "✅", // 확인했어요
  "❓", // 궁금해요
  "🙋", // 제가 할게요
  "🔥", // 핫해요
] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface BagReactionDoc {
  id: string; // `${targetType}_${targetId}`
  targetType: ReactionTargetType;
  targetId: string;
  reactions: Partial<Record<ReactionEmoji, string[]>>; // emoji -> uid 배열
  updatedAt: string;
}
