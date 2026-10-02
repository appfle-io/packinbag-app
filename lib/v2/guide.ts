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

export function hasSeenBagGuide(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(BAG_GUIDE_KEY) === "1";
  } catch {
    // 저장소를 못 쓰면(사파리 사생활 보호 등) 매번 띄우지 않도록 본 것으로 친다
    return true;
  }
}

export function markBagGuideSeen() {
  try {
    window.localStorage.setItem(BAG_GUIDE_KEY, "1");
  } catch {
    // 무시
  }
}

export function resetBagGuide() {
  try {
    window.localStorage.removeItem(BAG_GUIDE_KEY);
  } catch {
    // 무시
  }
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
    target: "bag-members",
    title: "함께 챙기기",
    body: "초대 링크나 코드를 보내면 같은 가방을 같이 체크해요. 누가 체크하든 바로 반영돼요.",
  },
  {
    target: "bag-more",
    title: "더보기",
    body: "출발 날짜, 설명 한 줄, 사진, 새 팩·메모는 여기 있어요. 이 안내도 여기서 다시 볼 수 있어요.",
  },
];
