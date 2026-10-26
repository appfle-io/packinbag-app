// 가방 화면 "남은 것" 칩 기억하기(BAG-FLT-11). 고른 채로 나가면 다음에 그 가방을 열 때도 "남은 것"으로 연다.
// 가방별, 이 기기(localStorage)에만 남긴다 - 서버 읽기·쓰기 없음. 함께 쓰는 멤버마다 각자.

const keyFor = (bagId: string) => `packinbag:bagFilterLeft:${bagId}`;

export function loadLeftFilter(bagId: string): boolean {
  try {
    return window.localStorage.getItem(keyFor(bagId)) === "1";
  } catch {
    return false;
  }
}

export function saveLeftFilter(bagId: string, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(keyFor(bagId), "1");
    else window.localStorage.removeItem(keyFor(bagId));
  } catch {
    // 저장소를 못 쓰면(사파리 사생활 보호 등) 기억하지 않는다
  }
}
