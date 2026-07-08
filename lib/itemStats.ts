import { Item } from "./types";

/**
 * 짐(항목) 배열을 받아 카드에 보여줄 요약 카운트 문자열을 만든다.
 *
 * 규칙:
 * - 체크항목이 하나라도 있으면 "체크됨/전체(체크+텍스트)" 형태로 표시
 *   예) 체크 10개 중 7개 체크 + 텍스트 2개 -> "7/12"
 * - 체크항목이 없고 텍스트만 있으면 텍스트 개수만 표시
 *   예) 텍스트 5개 -> "5"
 * - 항목이 아예 없으면 null
 * - hasImages가 true면 끝에 "+" 를 붙임
 */
export function formatItemCountLabel(
  items: Item[],
  hasImages: boolean
): string | null {
  const checkItems = items.filter((i) => i.type === "check");
  const textItems = items.filter((i) => i.type === "text");
  const total = checkItems.length + textItems.length;

  if (total === 0) {
    return hasImages ? "+" : null;
  }

  let label: string;
  if (checkItems.length > 0) {
    const checked = checkItems.filter((i) => i.checked).length;
    label = `${checked}/${total}`;
  } else {
    label = `${textItems.length}`;
  }

  return hasImages ? `${label}+` : label;
}

/**
 * 체크항목 기준 완료 비율(0~1)을 계산한다.
 * 체크항목이 하나도 없으면 null (진행률 시각화를 보여줄 대상이 아님).
 */
export function getProgressRatio(items: Item[]): number | null {
  const checkItems = items.filter((i) => i.type === "check");
  if (checkItems.length === 0) return null;
  const checked = checkItems.filter((i) => i.checked).length;
  return checked / checkItems.length;
}

