// 서버 전용. 공유 팩 · 폴더를 내 보관함으로 가져올 때 사진 · 파일을 내 저장소로 복사한다(2026-10-15, share.md 확인 필요 6).
// 예전에는 공유한 사람 저장소 주소를 그대로 써서, 그 사람이 지우면 깨지고 내가 메모에서 지우면 남의 파일 삭제를 시도했다.
// - 복사 위치: users/{uid}/packs/{packId}/{시각}_{원래 이름} (storage.rules의 보관함 메모 첨부 경로)
// - 새 다운로드 주소는 Firebase 다운로드 토큰을 붙여 만든다(앱이 올린 파일과 같은 모양)
// - 복사에 실패한 파일은 원래 주소를 그대로 둔다(가져오기 자체는 막지 않는다)
import { randomUUID } from "crypto";
import { adminStorage } from "@/lib/firebaseAdmin";
import type { Pack } from "@/lib/types";

const MAX_FILES_PER_IMPORT = 40;

export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const m = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?#]+)/.exec(url);
  if (!m) return null;
  try {
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

type DocNode = { type?: string; attrs?: Record<string, unknown>; content?: DocNode[] };

function collectDocUrls(node: DocNode | undefined, out: Set<string>) {
  if (!node || typeof node !== "object") return;
  const src = node.attrs?.src;
  if (typeof src === "string" && parseStorageUrl(src)) out.add(src);
  node.content?.forEach((c) => collectDocUrls(c, out));
}

function replaceDocUrls(node: DocNode | undefined, map: Map<string, string>): DocNode | undefined {
  if (!node || typeof node !== "object") return node;
  const src = node.attrs?.src;
  const attrs = typeof src === "string" && map.has(src) ? { ...node.attrs, src: map.get(src) } : node.attrs;
  const content = node.content?.map((c) => replaceDocUrls(c, map) as DocNode);
  return { ...node, ...(attrs ? { attrs } : {}), ...(content ? { content } : {}) };
}

/** 이 팩에 들어 있는 저장소 파일 주소(사진 · 메모 첨부) */
export function packStorageUrls(pack: Pack): string[] {
  const out = new Set<string>();
  (pack.images ?? []).forEach((u) => parseStorageUrl(u) && out.add(u));
  collectDocUrls(pack.editorDoc as DocNode | undefined, out);
  return [...out];
}

async function copyOne(url: string, uid: string, packId: string): Promise<string> {
  const parsed = parseStorageUrl(url);
  if (!parsed) return url;
  // 이미 내 보관함 파일이면 복사하지 않는다
  if (parsed.path.startsWith(`users/${uid}/`)) return url;
  const bucket = adminStorage().bucket(parsed.bucket);
  const name = (parsed.path.split("/").pop() ?? "file").replace(/^\d+_/, "").slice(-80);
  const destPath = `users/${uid}/packs/${packId}/${Date.now()}_${name}`;
  const dest = bucket.file(destPath);
  await bucket.file(parsed.path).copy(dest);
  const token = randomUUID();
  await dest.setMetadata({ cacheControl: "public, max-age=31536000", metadata: { firebaseStorageDownloadTokens: token } });
  return `https://firebasestorage.googleapis.com/v0/b/${parsed.bucket}/o/${encodeURIComponent(destPath)}?alt=media&token=${token}`;
}

/** 팩의 사진 · 첨부를 내 저장소로 복사한 팩. budget은 이번 가져오기에서 남은 복사 개수(넘으면 원래 주소 유지) */
export async function copyPackFilesToUser(pack: Pack, uid: string, budget: { left: number }): Promise<Pack> {
  const urls = packStorageUrls(pack);
  if (urls.length === 0) return pack;
  const map = new Map<string, string>();
  for (const url of urls) {
    if (budget.left <= 0) break;
    budget.left -= 1;
    try {
      map.set(url, await copyOne(url, uid, pack.id));
    } catch (err) {
      console.warn("[팩인백] 가져오기 첨부 복사 실패(원래 주소 유지):", err);
    }
  }
  if (map.size === 0) return pack;
  return {
    ...pack,
    images: pack.images?.map((u) => map.get(u) ?? u),
    editorDoc: pack.editorDoc ? (replaceDocUrls(pack.editorDoc as DocNode, map) as object) : pack.editorDoc,
  };
}

export const newImportBudget = () => ({ left: MAX_FILES_PER_IMPORT });
