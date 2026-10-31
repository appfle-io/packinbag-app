// 가방 안 팩 순서 바꾸기(2026-10-31). 순서 시트에 보인 팩만 그 자리들 안에서 새 순서로 바꾸고,
// 시트에 없던 팩(미분류 · 폴더 타입 · 무료 화면에서 숨긴 날씨 추천 팩 · 시트를 연 뒤 다른 멤버가 넣은 팩)은 제자리에 둔다.
// 시트를 연 뒤 사라진 팩 id는 무시한다.
export function reorderSubset<T extends { id: string }>(list: T[], orderedIds: string[]): T[] {
  const present = new Set(list.map((x) => x.id));
  const wanted = orderedIds.filter((id, i) => present.has(id) && orderedIds.indexOf(id) === i);
  const moving = new Set(wanted);
  const byId = new Map(list.map((x) => [x.id, x]));
  let k = 0;
  return list.map((x) => (moving.has(x.id) ? byId.get(wanted[k++])! : x));
}
