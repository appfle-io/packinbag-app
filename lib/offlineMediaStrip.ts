// 사진 · 파일을 빼는 순수 함수.
// - 오프라인 모드 사진 · 파일(data URL)을 계정으로 옮기기 전에 뺀다(2026-10-15, offline.md 확인 필요 3)
//   오프라인 모드는 사진 · 파일을 data URL로 가방 · 팩 문서 안에 넣어 둔다. 그대로 계정으로 올리면 Storage에 안 올라가고
//   문서가 커져서(Firestore 문서 1MB 한도) 실패할 수 있다. 그래서 옮길 때는 빼고, 이 기기의 오프라인 데이터에는 그대로 남긴다.
// - 백업 파일은 사진 · 파일을 아예 담지 않는다(2026-10-20, 사용자 결정). 내보낼 때 · 불러올 때 모든 첨부(data URL · 온라인 주소)를 뺀다
import type { Bag, Pack } from "@/lib/types";

type UrlTest = (u: unknown) => boolean;

const isDataUrl: UrlTest = (u) => typeof u === "string" && u.startsWith("data:");
const isAnyUrl: UrlTest = (u) => typeof u === "string" && u.length > 0;

type DocNode = { type?: string; attrs?: Record<string, unknown>; content?: DocNode[] };

// 메모 본문(TipTap JSON)에서 첨부 노드를 뺀다. 뺀 개수를 센다
function stripDoc(node: DocNode | undefined, counter: { n: number }, test: UrlTest): DocNode | undefined {
  if (!node || typeof node !== "object") return node;
  if (!Array.isArray(node.content)) return node;
  const content: DocNode[] = [];
  for (const child of node.content) {
    const src = child?.attrs?.src;
    if ((child?.type === "imageAttachment" || child?.type === "fileAttachment") && test(src)) {
      counter.n += 1;
      continue;
    }
    content.push(stripDoc(child, counter, test) as DocNode);
  }
  return { ...node, content };
}

function stripPackWith(pack: Pack, test: UrlTest): { pack: Pack; removed: number } {
  const counter = { n: 0 };
  const images = pack.images ?? [];
  const keep = images.filter((u) => !test(u));
  counter.n += images.length - keep.length;
  const editorDoc = pack.editorDoc ? (stripDoc(pack.editorDoc as DocNode, counter, test) as object) : pack.editorDoc;
  if (counter.n === 0) return { pack, removed: 0 };
  const out: Pack = { ...pack, images: keep, editorDoc };
  // 본문 없이 Storage 정리를 판단하는 첨부 목록(lib/storageCleanup)도 같이 비운다
  if (test === isAnyUrl) delete out.attachmentUrls;
  return { pack: out, removed: counter.n };
}

function stripBagWith(bag: Bag, test: UrlTest): { bag: Bag; removed: number } {
  const images = bag.images ?? [];
  const keep = images.filter((u) => !test(u));
  let removed = images.length - keep.length;
  const packs = (bag.packs ?? []).map((p) => {
    const r = stripPackWith(p, test);
    removed += r.removed;
    return r.pack;
  });
  if (removed === 0) return { bag, removed: 0 };
  return { bag: { ...bag, images: keep, packs }, removed };
}

// 오프라인 모드(data URL)만
export const stripPackMedia = (pack: Pack) => stripPackWith(pack, isDataUrl);
export const stripBagMedia = (bag: Bag) => stripBagWith(bag, isDataUrl);

/** 고른 가방 · 팩에 옮기지 못할 사진 · 파일이 몇 개인지 */
export function countOfflineMedia(bags: Bag[], packs: Pack[]): number {
  return bags.reduce((n, b) => n + stripBagMedia(b).removed, 0) + packs.reduce((n, p) => n + stripPackMedia(p).removed, 0);
}

/** 백업용: 모든 사진 · 파일(data URL · 온라인 주소)을 뺀다. 뺀 개수를 함께 */
export function stripAllMediaForBackup(bags: Bag[], packs: Pack[]): { bags: Bag[]; packs: Pack[]; removed: number } {
  let removed = 0;
  const outBags = bags.map((b) => {
    const r = stripBagWith(b, isAnyUrl);
    removed += r.removed;
    return r.bag;
  });
  const outPacks = packs.map((p) => {
    const r = stripPackWith(p, isAnyUrl);
    removed += r.removed;
    return r.pack;
  });
  return { bags: outBags, packs: outPacks, removed };
}
