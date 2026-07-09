// "샘플로 시작하기" 기능에서 보여주는 정적 큐레이션 템플릿.
// AI 호출 없이 즉시 팩/짐을 채워주는 용도라 API 할당량을 전혀 쓰지 않는다.
// 여기 없는 케이스는 SampleBagSheet 하단의 "해시태그로 AI에게 만들어달라기" 쪽으로 유도한다.

import { ImportedBagResult } from "@/lib/types";

export type SampleCategory = "travel" | "life" | "event" | "work";

export interface SampleBagTemplate extends ImportedBagResult {
  id: string;
  category: SampleCategory;
  icon: string; // 이모지 아이콘
  title: string; // 카드에 보여줄 제목 (bagName과 다를 수 있음)
}

export const SAMPLE_CATEGORIES: { id: SampleCategory; label: string }[] = [
  { id: "travel", label: "여행" },
  { id: "life", label: "생활" },
  { id: "event", label: "이벤트" },
  { id: "work", label: "업무" },
];

export function sampleItemCount(t: SampleBagTemplate): number {
  return t.packs.reduce((sum, p) => sum + p.items.length, 0);
}

export const SAMPLE_BAG_TEMPLATES: SampleBagTemplate[] = [
  // ── 여행 ──────────────────────────────────────────
  {
    id: "travel-abroad",
    category: "travel",
    icon: "✈️",
    title: "해외여행",
    bagName: "해외여행 준비물",
    packs: [
      {
        name: "서류/카드",
        items: ["여권", "여권 사본/사진", "비자(필요시)", "해외여행자보험", "신용카드/현금(환전)", "숙소·항공 예약 확인서"],
      },
      { name: "전자기기", items: ["휴대폰 충전기", "해외용 멀티어댑터", "보조배터리", "이어폰", "카메라"] },
      { name: "세면도구", items: ["여행용 샴푸/린스", "치약/치솔", "선크림", "기초 화장품", "면도기"] },
      { name: "의류", items: ["여행 일수+1 속옷/양말", "편한 신발", "우비/우산", "잠옷"] },
      { name: "기타", items: ["상비약", "목베개", "간식", "유심/로밍"] },
    ],
  },
  {
    id: "travel-domestic",
    category: "travel",
    icon: "🚗",
    title: "국내여행 (1박2일)",
    bagName: "국내여행 준비물",
    packs: [
      { name: "필수품", items: ["신분증", "예약 확인서", "차키/하이패스카드", "현금/카드"] },
      { name: "옷/세면", items: ["갈아입을 옷", "세면도구 파우치", "수건", "슬리퍼"] },
      { name: "전자기기", items: ["휴대폰 충전기", "보조배터리", "카메라"] },
      { name: "기타", items: ["상비약", "간식/물", "차량용 방향제"] },
    ],
  },
  {
    id: "travel-camping",
    category: "travel",
    icon: "⛺",
    title: "캠핑/등산",
    bagName: "캠핑 준비물",
    packs: [
      { name: "캠핑 장비", items: ["텐트", "침낭/매트", "랜턴/헤드랜턴", "캠핑 테이블/의자", "버너/가스"] },
      { name: "취사용품", items: ["코펠/식기", "칼/도마", "아이스박스", "물통", "쓰레기봉투"] },
      { name: "의류", items: ["방수 자켓", "여벌 옷", "등산화/트레킹화", "장갑/모자"] },
      { name: "기타", items: ["벌레퇴치제", "구급약", "손전등", "보조배터리"] },
    ],
  },
  {
    id: "travel-baby",
    category: "travel",
    icon: "👶",
    title: "아기와 여행",
    bagName: "아기와 함께 여행 준비물",
    packs: [
      { name: "아기용품", items: ["기저귀", "물티슈", "분유/젖병", "이유식/간식", "유모차"] },
      { name: "옷/위생", items: ["아기 여벌옷", "속싸개/겉싸개", "아기 세면도구", "체온계"] },
      { name: "서류/약", items: ["아기 상비약", "건강보험증", "예방접종 수첩"] },
      { name: "놀이", items: ["좋아하는 장난감", "책", "간식통"] },
    ],
  },

  // ── 생활 ──────────────────────────────────────────
  {
    id: "life-groceries",
    category: "life",
    icon: "🛒",
    title: "장보기",
    bagName: "이번주 장보기",
    packs: [
      { name: "채소/과일", items: ["양파", "대파", "마늘", "당근", "사과"] },
      { name: "육류/수산", items: ["돼지고기", "닭가슴살", "계란", "생선"] },
      { name: "가공/냉동", items: ["두부", "우유", "냉동만두", "김치"] },
      { name: "생활용품", items: ["휴지", "세제", "쓰레기봉투"] },
    ],
  },
  {
    id: "life-moving",
    category: "life",
    icon: "📦",
    title: "이사",
    bagName: "이사 체크리스트",
    packs: [
      { name: "이사 전", items: ["이사업체 예약", "전입/전출 신고", "인터넷/케이블 이전", "관리비 정산", "짐 라벨링"] },
      { name: "주방", items: ["그릇/식기 포장", "냉장고 정리", "조미료류 정리"] },
      { name: "방/거실", items: ["옷장 정리", "침구 포장", "전자기기 케이블 정리"] },
      { name: "이사 후", items: ["전입신고", "우편물 주소변경", "가스/수도 검침", "새 집 청소"] },
    ],
  },
  {
    id: "life-baby-outing",
    category: "life",
    icon: "🍼",
    title: "아기 외출 준비물",
    bagName: "아기 외출 준비물",
    packs: [
      { name: "필수품", items: ["기저귀 2~3개", "물티슈", "여벌옷", "손수건"] },
      { name: "먹거리", items: ["분유/젖병", "이유식", "간식", "물"] },
      { name: "기타", items: ["장난감 1개", "체온계", "상비약"] },
    ],
  },
  {
    id: "life-pet",
    category: "life",
    icon: "🐶",
    title: "반려동물 동반 외출",
    bagName: "반려동물 외출 준비물",
    packs: [
      { name: "필수품", items: ["리드줄/하네스", "배변봉투", "물/물통", "간식"] },
      { name: "안전", items: ["인식표/등록증", "구급약", "여분 목줄"] },
      { name: "이동", items: ["이동장/캐리어", "방석/담요"] },
    ],
  },

  // ── 이벤트 ──────────────────────────────────────────
  {
    id: "event-wedding",
    category: "event",
    icon: "💒",
    title: "결혼식 준비",
    bagName: "결혼식 준비 체크리스트",
    packs: [
      { name: "예식장/일정", items: ["예식장 계약", "웨딩플래너 미팅", "청첩장 제작/발송", "본식 스냅/영상 계약"] },
      { name: "웨딩 패키지", items: ["스튜디오 촬영", "드레스 투어", "메이크업/헤어 예약"] },
      { name: "혼수/예단", items: ["가전/가구 목록", "예단 준비", "신혼여행 예약"] },
      { name: "당일 준비물", items: ["예물/반지", "축의금 봉투/방명록", "혼인신고서"] },
    ],
  },
  {
    id: "event-housewarming",
    category: "event",
    icon: "🎉",
    title: "집들이/파티 준비물",
    bagName: "집들이 준비물",
    packs: [
      { name: "음식/음료", items: ["메인 요리", "안주/디저트", "음료/주류", "종이컵/접시"] },
      { name: "공간 준비", items: ["청소/정리", "테이블 세팅", "조명/데코"] },
      { name: "누가 가져올지", items: ["와인 - OO", "디저트 - OO", "과일 - OO"] },
    ],
  },
  {
    id: "event-back-to-school",
    category: "event",
    icon: "🎒",
    title: "신학기 준비물",
    bagName: "신학기 준비물",
    packs: [
      { name: "학용품", items: ["필통/필기구", "공책/스케치북", "가위/풀/색연필", "네임스티커"] },
      { name: "가방/의류", items: ["새 가방", "실내화", "체육복"] },
      { name: "서류", items: ["가정통신문 확인", "예방접종 확인서", "학원/방과후 신청"] },
    ],
  },
  {
    id: "event-potluck-meet",
    category: "event",
    icon: "🧺",
    title: "모임 준비물 분담",
    bagName: "모임 준비물",
    packs: [
      { name: "음식", items: ["메인 - OO", "사이드 - OO", "디저트 - OO"] },
      { name: "물품", items: ["돗자리/테이블", "블루투스 스피커", "종이컵/수저"] },
      { name: "장소/이동", items: ["장소 예약 확인", "카풀/이동수단"] },
    ],
  },

  // ── 업무 ──────────────────────────────────────────
  {
    id: "work-kanban",
    category: "work",
    icon: "📋",
    title: "팀 할일 보드",
    bagName: "팀 프로젝트",
    packs: [
      {
        name: "할일",
        items: [
          { text: "기획안 초안 작성", type: "text" },
          { text: "요구사항 정리", type: "text" },
          { text: "디자인 시안 요청", type: "text" },
        ],
      },
      { name: "진행중", items: [{ text: "API 연동 작업", type: "text" }] },
      { name: "완료", items: [{ text: "킥오프 미팅", type: "text" }] },
    ],
  },
  {
    id: "work-event-booth",
    category: "work",
    icon: "🎪",
    title: "행사/부스 준비물",
    bagName: "행사 준비물",
    packs: [
      { name: "부스 물품", items: ["배너/현수막", "테이블/의자", "명함/브로슈어", "간식/음료"] },
      { name: "장비", items: ["노트북", "멀티탭/연장선", "명찰", "결제단말기"] },
      { name: "사전 준비", items: ["참가 신청 명단", "발표 자료", "역할 분담표"] },
    ],
  },
  {
    id: "work-office-supply",
    category: "work",
    icon: "🖇️",
    title: "사무실 비품 체크",
    bagName: "사무실 비품 체크리스트",
    packs: [
      { name: "소모품", items: ["A4 용지", "복사기 토너", "포스트잇/펜", "커피/티백"] },
      { name: "장비", items: ["모니터/케이블 점검", "회의실 빔프로젝터", "여분 마우스/키보드"] },
    ],
  },
  {
    id: "work-onboarding",
    category: "work",
    icon: "🧑‍💻",
    title: "신입사원 온보딩",
    bagName: "신입사원 온보딩 체크리스트",
    packs: [
      { name: "입사 전", items: ["계정/이메일 생성", "장비(노트북 등) 준비", "자리 배치"] },
      { name: "1주차", items: ["팀 소개", "사내 시스템 교육", "담당 업무 설명"] },
      { name: "서류", items: ["근로계약서", "4대보험 서류", "비밀유지계약서"] },
    ],
  },
];
