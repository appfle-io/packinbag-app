// 오프라인 모드 사진 · 파일(data URL)을 계정으로 옮기기 전에 빼는 순수 함수(2026-10-15, offline.md 확인 필요 3).
//
// 오프라인 모드는 사진 · 파일을 data URL로 가방 · 팩 문서 안에 넣어 둔다. 그대로 계정으로 올리면 Storage에 안 올라가고
// 문서가 커져서(Firestore 문서 1MB 한도) 실패할 수 있다. 그래서 옮길 때는 빼고, 이 기기의 오프라인 데이터에는 그대로 남긴다.
// 옮기기 전에 시트가 "따로 저장했는지" 묻고 백업 파일 저장을 권한다(OfflineImportSheet).
import type { Bag, Pack } from "@/lib/types";

const isDataUrl = (u: unknown): u is string => typeof u === "string" && u.startsWith("data:");

type DocNode = { type?: string; attrs?: Record<string, unknown>; content?: DocNode[] };

// 메모 본문(TipTap JSON)에서 data URL 첨부 노드를 뺀다. 뺀 개수를 센다
function stripDoc(node: DocNode | undefined, counter: { n: number }): DocNode | undefined {
  if (!node || typeof node !== "object") return node;
  if (!Array.isArray(node.content)) return node;
  const content: DocNode[] = [];
  for (const child of node.content) {
    const src = child?.attrs?.src;
    if ((child?.type === "imageAttachment" || child?.type === "fileAttachment") && isDataUrl(src)) {
      counter.n += 1;
      continue;
    }
    content.push(stripDoc(child, counter) as DocNode);
  }
  return { ...node, content };
}

export function stripPackMedia(pack: Pack): { pack: Pack; removed: number } {
  const counter = { n: 0 };
  const images = pack.images ?? [];
  const keep = images.filter((u) => !isDataUrl(u));
  counter.n += images.length - keep.length;
  const editorDoc = pack.editorDoc ? (stripDoc(pack.editorDoc as DocNode, counter) as object) : pack.editorDoc;
  if (counter.n === 0) return { pack, removed: 0 };
  return { pack: { ...pack, images: keep, editorDoc }, removed: counter.n };
}

export function stripBagMedia(bag: Bag): { bag: Bag; removed: number } {
  const images = bag.images ?? [];
  const keep = images.filter((u) => !isDataUrl(u));
  let removed = images.length - keep.length;
  const packs = (bag.packs ?? []).map((p) => {
    const r = stripPackMedia(p);
    removed += r.removed;
    return r.pack;
  });
  if (removed === 0) return { bag, removed: 0 };
  return { bag: { ...bag, images: keep, packs }, removed };
}

/** 고른 가방 · 팩에 옮기지 못할 사진 · 파일이 몇 개인지 */
export function countOfflineMedia(bags: Bag[], packs: Pack[]): number {
  return bags.reduce((n, b) => n + stripBagMedia(b).removed, 0) + packs.reduce((n, p) => n + stripPackMedia(p).removed, 0);
}
