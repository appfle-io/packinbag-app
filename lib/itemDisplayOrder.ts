import { Item } from "./types";

/**
 * 설정 > 팩 설정 > "완료된 항목 맨 아래로 이동"이 켜져 있을 때 화면에 보여줄 순서로
 * 정렬한다. PackCard/NotebookPackSection이 화면에 그릴 때뿐 아니라, 드래그로 순서를
 * 바꿀 때도 "화면에 보이는 순서" 기준으로 계산해야 사용자가 본 위치와 실제 저장 위치가
 * 어긋나지 않는다(예전엔 화면은 정렬된 순서, 계산은 원본 순서를 써서 드래그가 이상하게
 * 동작하는 버그가 있었음).
 */
export function getDisplayOrderedItems(
  items: Item[],
  moveCompletedToBottom: boolean
): Item[] {
  return moveCompletedToBottom
    ? [...items].sort(
        (a, b) => Number(a.type === "check" && !!a.checked) - Number(b.type === "check" && !!b.checked)
      )
    : items;
}
