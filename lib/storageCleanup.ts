import type { Bag, Pack } from "@/lib/types";
import { extractDocAttachmentUrls } from "@/lib/editorDocAttachmentUtils";
import { deleteBagImage } from "@/lib/storageService";

/**
 * 가방·팩을 영구 삭제할 때 Storage 첨부(사진·파일)를 함께 정리한다(2026-10-07).
 *
 * 같은 파일 URL을 여러 곳이 나눠 쓴다: 보관함 메모팩을 가방에 불러오면 users/{uid}/packs/... URL이 가방에 복사되고,
 * 가방 팩을 보관함에 저장하거나 휴지통으로 보내면 bags/{bagId}/packs/... URL이 보관함에 복사된다.
 * 그래서 지우기 전에 "아직 다른 곳(내가 볼 수 있는 가방·보관함 팩, 휴지통 포함)이 쓰는지" 보고 안 쓰는 것만 지운다.
 * 다른 사람의 보관함은 볼 수 없어서 거기서 쓰는 파일은 지울 수 있다(알려진 한계).
 */

export function packFileUrls(pack: Pack): string[] {
  return [...(pack.images ?? []), ...extractDocAttachmentUrls(pack.editorDoc)];
}

/**
 * 가방 하나가 쓰는 파일. 함께 쓰는 가방(멤버 2명+)은 다른 멤버가 그 메모팩을 자기 보관함에 저장해 두었을 수 있는데
 * 그 보관함은 내가 볼 수 없다 → 가방 사진만 지우고(예전과 같음) 팩 첨부는 남긴다.
 */
export function bagFileUrls(bag: Bag): string[] {
  const shared = (bag.memberIds?.length ?? 0) > 1;
  return [...(bag.images ?? []), ...(shared ? [] : (bag.packs ?? []).flatMap(packFileUrls))];
}

// "쓰는 중" 판정용: 가방이 쓰는 모든 파일
function allBagUrls(bag: Bag): string[] {
  return [...(bag.images ?? []), ...(bag.packs ?? []).flatMap(packFileUrls)];
}

/** 지우려는 가방·팩(exclude)을 뺀 나머지가 쓰는 파일 URL */
export function urlsInUse(
  bags: Bag[],
  packs: Pack[],
  exclude: { bagIds?: Iterable<string>; packIds?: Iterable<string> } = {},
): Set<string> {
  const skipBags = new Set(exclude.bagIds ?? []);
  const skipPacks = new Set(exclude.packIds ?? []);
  const used = new Set<string>();
  bags.forEach((b) => {
    if (!skipBags.has(b.id)) allBagUrls(b).forEach((u) => used.add(u));
  });
  packs.forEach((p) => {
    if (!skipPacks.has(p.id)) packFileUrls(p).forEach((u) => used.add(u));
  });
  return used;
}

/** 안 쓰는 것만 지운다. 실패(이미 없음·권한)는 조용히 넘긴다 */
export async function deleteUnusedFiles(urls: string[], inUse: Set<string>): Promise<void> {
  const targets = Array.from(new Set(urls)).filter((u) => u && !inUse.has(u));
  await Promise.all(targets.map((u) => deleteBagImage(u)));
}
