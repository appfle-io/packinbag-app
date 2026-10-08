import type { Bag, Item, Pack } from "@/lib/types";

// 체크리스트 팩(메모팩 제외)의 체크 아이템만 모은다. 진행률·다 쌌는지 판단의 기준.
function checklistPacks(packs: Pack[]): Pack[] {
  return packs.filter((p) => p.kind !== "editor" && p.type !== "folder");
}

function checkItemsOf(packs: Pack[]): Item[] {
  return checklistPacks(packs).flatMap((p) => p.items.filter((i) => i.type === "check"));
}

export interface PackStats {
  done: number;
  total: number;
}

export function statsOf(packs: Pack[]): PackStats {
  const items = checkItemsOf(packs);
  return { done: items.filter((i) => i.checked).length, total: items.length };
}

export function isAllPacked(packs: Pack[]): boolean {
  const { done, total } = statsOf(packs);
  return total > 0 && done === total;
}

export type PackingState = "empty" | "packing" | "packed";

// 비어 있음(아무것도 안 챙김) / 싸는 중 / 다 쌌어요
export function packingStateOf(packs: Pack[]): PackingState {
  const { done, total } = statsOf(packs);
  if (total === 0 || done === 0) return "empty";
  return done === total ? "packed" : "packing";
}

export function findInbox(bag: Bag): Pack | undefined {
  return bag.packs.find((p) => p.isInbox && p.kind !== "editor");
}