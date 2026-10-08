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
  // 가방 안 메모는 본문이 따로 있어 목록에는 본문이 없다 → 가방 문서에 남긴 첨부 목록을 쓴다(lib/bagNotesService)
  const docUrls = pack.editorDoc !== undefined ? extractDocAttachmentUrls(pack.editorDoc) : pack.attachmentUrls ?? [];
  return [...(pack.images ?? []), ...docUrls];
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
  const targets = Array.from(new Set(urls)).filter((u) => u && !inUse.has(u) && isStorageUrl(u));
  await Promise.all(targets.map((u) => deleteBagImage(u)));
}

// Firebase Storage 파일만 지운다(오프라인 data: URL·외부 이미지 주소는 건드리지 않음)
function isStorageUrl(u: string): boolean {
  return u.includes("firebasestorage.googleapis.com") || u.startsWith("gs://");
}

// ---- 메모 본문에서 지운 첨부 정리(2026-10-07) ----
// 편집기는 앱 전체의 가방·보관함 목록을 모르므로 AppShell이 지금 목록을 꺼내 주는 함수를 등록해 둔다.
let usageSource: (() => { bags: Bag[]; packs: Pack[] }) | null = null;
export function setFileUsageSource(fn: (() => { bags: Bag[]; packs: Pack[] }) | null) {
  usageSource = fn;
}

/**
 * 메모 편집기를 닫을 때 부른다. 이번에 여는 동안 본문에 있었던 첨부(seen) 중 마지막 문서(finalUrls)에 없고
 * 다른 가방·보관함 팩도 쓰지 않는 것만 지운다. 편집기를 닫은 뒤라 되돌리기(undo)로 되살릴 일은 없다.
 * - 공유 가방(멤버 2명+)의 메모는 건드리지 않는다: 다른 멤버가 편집 중이거나 자기 보관함에 저장해 뒀을 수 있다
 * - 이 메모 자체의 옛 사본(목록에 아직 남은 저장 전 상태)은 "쓰는 곳"에서 뺀다. 같은 id라도 다른 곳(보관함 ↔ 가방)의 사본은 남긴다
 */
export async function sweepRemovedAttachments(opts: {
  packId: string;
  bagId?: string;
  seen: Iterable<string>;
  finalUrls: string[];
}): Promise<void> {
  if (!usageSource) return;
  const { bags, packs } = usageSource();
  if (opts.bagId) {
    const bag = bags.find((b) => b.id === opts.bagId);
    if (!bag || (bag.memberIds?.length ?? 0) > 1) return;
  }
  const keep = new Set(opts.finalUrls);
  const removed = Array.from(new Set(opts.seen)).filter((u) => !keep.has(u));
  if (removed.length === 0) return;

  const used = new Set<string>();
  bags.forEach((b) => {
    (b.images ?? []).forEach((u) => used.add(u));
    (b.packs ?? []).forEach((p) => {
      if (opts.bagId && b.id === opts.bagId && p.id === opts.packId) return;
      packFileUrls(p).forEach((u) => used.add(u));
    });
  });
  packs.forEach((p) => {
    if (!opts.bagId && p.id === opts.packId) return;
    packFileUrls(p).forEach((u) => used.add(u));
  });
  await deleteUnusedFiles(removed, used);
}
