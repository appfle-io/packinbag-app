// 리디자인 v2 사용 가이드(코치마크 투어). 예전 "스크린샷 슬라이드" 가이드(lib/helpTutorial) 대신 실제 화면 위에서
// 버튼을 밝게 비추고 설명한다. 대상은 data-guide="..." 속성으로 찾는다 - 화면에 없거나 숨겨진 대상(예: 넓은 화면의
// 1열/2열 버튼, 빈 가방의 팩)은 그 단계를 건너뛴다. 레이아웃이 바뀌어도 좌표를 다시 잡을 필요가 없다.
//
// 본 기록은 이 기기(localStorage)에만 남긴다 - 서버 읽기·쓰기 없음.

export interface TourStep {
  // data-guide 값
  target: string;
  title: string;
  body: string;
  // 길게 누르기 같은 동작을 설명할 때 대상 안 첫 아이템 위에 퍼지는 원을 그린다(연결선은 쓰지 않는다)
  gesture?: "press";
}

const BAG_GUIDE_KEY = "packinbag:v2GuideBagSeen";
// 가방 탭 · 팩 탭(목록 화면) 투어(2026-10-25)
export const HOME_GUIDE_KEY = "packinbag:v2GuideHomeSeen";
export const PACKS_GUIDE_KEY = "packinbag:v2GuidePacksSeen";

export function hasSeenGuide(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    // 저장소를 못 쓰면(사파리 사생활 보호 등) 매번 띄우지 않도록 본 것으로 친다
    return true;
  }
}

export function markGuideSeen(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // 무시
  }
}

export function hasSeenBagGuide(): boolean {
  return hasSeenGuide(BAG_GUIDE_KEY);
}

export function markBagGuideSeen() {
  markGuideSeen(BAG_GUIDE_KEY);
}

// 설정 > 사용 가이드 다시 보기: 가방 · 가방 탭 · 팩 탭 투어를 모두 다시
export function resetBagGuide() {
  try {
    [BAG_GUIDE_KEY, HOME_GUIDE_KEY, PACKS_GUIDE_KEY].forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // 무시
  }
}

// 투어는 한 번에 하나만. 넓은 화면에서 가방 탭 투어와 가방 투어가 겹쳐 뜨지 않게, 열기 직전에
// 다른 투어나 시트 · 창(aria-modal)이 떠 있으면 띄우지 않는다(본 것으로 치지 않으니 다음에 다시 나온다)
export function canStartTour(): boolean {
  return !document.querySelector('[aria-modal="true"]');
}

// 가방 화면 투어. 화면 문구는 가방 / 팩 / 아이템만 쓴다.
export const BAG_GUIDE_STEPS: TourStep[] = [
  {
    target: "bag-add",
    title: "아이템 넣기",
    body: "아래 칸에 적으면 맨 위 '미분류'에 모여요. 모인 건 '팩으로 나눠 담기'로 한 번에 정리할 수 있어요. 왼쪽 버튼은 팩 보관함의 팩을 통째로 불러와요.",
  },
  {
    target: "bag-pack",
    title: "체크하고 고치기",
    body: "아이템을 누르면 체크돼요. 길게 누르면(PC는 오른쪽 클릭) 이름·담당·다른 팩으로 옮기기 메뉴가 나와요. 팩 이름을 길게 누르면 팩 메뉴예요.",
    gesture: "press",
  },
  {
    target: "bag-columns",
    title: "한 화면에 더 많이",
    body: "이 버튼으로 아이템을 2열로 볼 수 있어요. 아이패드나 넓은 화면에서는 폭에 맞춰 알아서 2열·3열이 돼요.",
  },
  {
    target: "bag-repack",
    title: "다시 싸기",
    body: "다녀와서 누르면 체크가 모두 풀려요. 마지막으로 다 싼 날은 남아서, 같은 가방을 다음에 또 쓸 수 있어요.",
  },
  {
    target: "bag-filter",
    title: "남은 것만 보기",
    body: "'남은 것'을 누르면 아직 안 챙긴 것만 보여요. 고른 채로 나가면 이 가방은 다음에도 그대로 열려요. 팩 이름을 누르면 그 팩만 봐요.",
  },
  {
    target: "bag-members",
    title: "함께 챙기기",
    body: "초대 링크나 코드를 보내면 같은 가방을 같이 체크해요. 누가 체크하든 바로 반영돼요.",
  },
  {
    target: "bag-more",
    title: "더보기",
    body: "D-Day, 설명 한 줄, 사진, 새 팩·메모는 여기 있어요. 이 안내도 여기서 다시 볼 수 있어요.",
  },
];

// 가방 탭(가방 목록) 투어. 화면에 없는 대상(보관함 줄 · 큰 카드 · 폴더 칩)은 CoachTour가 건너뛴다
export const HOME_GUIDE_STEPS: TourStep[] = [
  {
    target: "home-new",
    title: "새 가방",
    body: "여행, 어린이집, 출장처럼 챙길 일마다 가방을 하나씩 만들어요.",
  },
  {
    target: "home-folders",
    title: "폴더로 나누기",
    body: "+로 폴더를 만들어 가방을 나눠요. 폴더를 길게 누르면 이름 · 순서 · 삭제예요.",
  },
  {
    target: "home-carousel",
    title: "지금 챙길 가방",
    body: "D-Day가 가깝거나 싸는 중인 가방이 여기 크게 보여요. 옆으로 넘겨 볼 수 있어요.",
  },
  {
    target: "home-row",
    title: "열기와 메뉴",
    body: "누르면 열려요. 길게 누르면(PC는 오른쪽 클릭) 고정 · 폴더로 옮기기 · 보관함 · 삭제예요.",
    gesture: "press",
  },
  {
    target: "home-search",
    title: "한 번에 찾기",
    body: "가방, 팩, 아이템, 메모 속 글자까지 한 번에 찾아요.",
  },
  {
    target: "home-archive",
    title: "보관함",
    body: "다녀온 가방은 보관함에 모여요. 다시 꺼내 쓸 수 있어요.",
  },
];

// 팩 탭(팩 보관함) 투어
export const PACKS_GUIDE_STEPS: TourStep[] = [
  {
    target: "packs-new",
    title: "팩 만들기",
    body: "자주 챙기는 것을 팩(체크리스트)이나 메모로 만들어 두면, 가방에서 통째로 불러올 수 있어요.",
  },
  {
    target: "packs-folder",
    title: "폴더로 정리",
    body: "폴더로 정리해요. 폴더 안에 폴더도 만들 수 있어요.",
  },
  {
    target: "packs-row",
    title: "열기와 메뉴",
    body: "누르면 열려요. 길게 누르면(PC는 오른쪽 클릭) 이름 · 고정 · 옮기기 · 공유 · 삭제예요.",
    gesture: "press",
  },
  {
    target: "packs-quick",
    title: "빠른팩",
    body: "생각날 때 바로 적어 두는 곳이에요. 나중에 가방으로 옮겨요.",
  },
  {
    target: "packs-search",
    title: "검색",
    body: "모든 폴더의 팩 이름, 아이템, 메모를 찾아요.",
  },
];
