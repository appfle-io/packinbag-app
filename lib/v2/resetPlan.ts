// 설정 > 데이터 초기화 계획(2026-10-15) - Firebase를 부르지 않는 순수 함수. 실행은 SettingsScreenV2.
// _secrets/docs/spec/settings.md SET-ACC-04 ~ 09
//
// - 내가 그룹장인데 다른 멤버가 있는 가방(휴지통 포함)이 하나라도 있으면 막는다(blocked).
//   예전에는 위임 없이 나가기만 해서 그룹장이 없는 가방이 남았고, 휴지통에 있던 함께 쓰는 가방은 모두에게서 지워졌다
// - 나 혼자 남은 가방은 지운다(deleteBags), 남이 그룹장인 함께 쓰는 가방은 나간다(leaveBags)
// - 아직 서버에 없는 "만들기 대기" 가방 · 팩은 이 기기 대기 목록에서만 지운다
import type { Bag, Pack } from "@/lib/types";

export interface ResetPlan {
  blocked: Bag[];
  deleteBags: Bag[];
  leaveBags: Bag[];
  pendingBagIds: string[];
  deletePacks: Pack[];
  pendingPackIds: string[];
}

export function planDataReset(
  uid: string,
  bags: Bag[],
  packs: Pack[],
  pending: { bagIds: Set<string>; packIds: Set<string> },
): ResetPlan {
  const seen = new Set<string>();
  const uniqueBags = bags.filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));
  const plan: ResetPlan = { blocked: [], deleteBags: [], leaveBags: [], pendingBagIds: [], deletePacks: [], pendingPackIds: [] };
  for (const bag of uniqueBags) {
    if (pending.bagIds.has(bag.id)) {
      plan.pendingBagIds.push(bag.id);
      continue;
    }
    const shared = (bag.memberIds?.length ?? 0) > 1;
    if (!shared) plan.deleteBags.push(bag);
    else if (bag.ownerId === uid) plan.blocked.push(bag);
    else plan.leaveBags.push(bag);
  }
  const seenPacks = new Set<string>();
  for (const pack of packs) {
    if (seenPacks.has(pack.id)) continue;
    seenPacks.add(pack.id);
    if (pending.packIds.has(pack.id)) plan.pendingPackIds.push(pack.id);
    else plan.deletePacks.push(pack);
  }
  return plan;
}

/** 막힌 가방 안내 문구: "'제주', '캠핑' 외 2개" */
export function blockedBagLabel(bags: Pick<Bag, "name">[]): string {
  const names = bags.slice(0, 2).map((b) => `'${b.name || "이름 없는 가방"}'`);
  const rest = bags.length - names.length;
  return rest > 0 ? `${names.join(", ")} 외 ${rest}개` : names.join(", ");
}
