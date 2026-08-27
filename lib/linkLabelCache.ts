import type { User } from "firebase/auth";
import { fetchLinkMeta, parseShortLinkUrl, type LinkMeta } from "@/lib/shortLinkService";

// 짧은/커스텀 링크의 표시 이름(label)을 code 기준으로 앱 전체에서 공유하는 캐시.
// 짐/메모(components/LinkifiedText.tsx, 리액트 상태로 재렌더)와 메모팩
// (components/screens/PackNoteEditorScreen.tsx, TipTap DOM을 직접 갱신)이 렌더링 방식은
// 서로 다르지만 같은 링크가 양쪽에 동시에 나타날 수 있어서, 캐시/조회 로직 자체는 여기
// 하나로 공유한다. 세션(탭) 안에서만 유지되는 메모리 캐시이고 새로고침하면 비워진다 -
// 링크 몇 개 조회하는 정도라 매번 다시 받아와도 부담이 없다.
const cache = new Map<string, LinkMeta | null>();
const listeners = new Map<string, Set<() => void>>();

const SS_PREFIX = "pb_linkmeta:";

function readSessionStorage(key: string): LinkMeta | null | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(`${SS_PREFIX}${key}`);
    if (raw === null) return undefined;
    return JSON.parse(raw) as LinkMeta | null;
  } catch {
    return undefined;
  }
}

function writeSessionStorage(key: string, meta: LinkMeta | null) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${SS_PREFIX}${key}`, JSON.stringify(meta));
  } catch {
    // quota exceeded or disabled
  }
}

function cacheKey(kind: "s" | "c", code: string): string {
  return `${kind}:${code}`;
}

// 캐시에 아직 없으면(요청 전) undefined, 조회했는데 없거나 우리 링크가 아니면 null,
// 있으면 LinkMeta를 돌려준다. 메모리 Map -> sessionStorage 순으로 확인.
export function getCachedLinkMeta(url: string): LinkMeta | null | undefined {
  const parsed = parseShortLinkUrl(url);
  if (!parsed) return null;
  const key = cacheKey(parsed.kind, parsed.code);
  if (cache.has(key)) {
    return cache.get(key);
  }
  const fromSs = readSessionStorage(key);
  if (fromSs !== undefined) {
    cache.set(key, fromSs);
    return fromSs;
  }
  return undefined;
}

// 링크를 새로 만들거나 수정한 직후, 서버 응답을 곧바로 캐시에 반영해서(재조회 없이) 화면에
// 바로 최신 이름이 보이도록 한다. 이 code를 구독 중인 컴포넌트가 있으면 즉시 리렌더된다.
export function setLinkMetaCache(kind: "s" | "c", code: string, meta: LinkMeta | null) {
  const key = cacheKey(kind, code);
  cache.set(key, meta);
  writeSessionStorage(key, meta);
  listeners.get(key)?.forEach((fn) => fn());
}

// url이 우리 서비스 링크면(parseShortLinkUrl 성공) 아직 캐시에 없을 때만 백그라운드로 한 번
// 조회해서 채워넣는다.
export function ensureLinkMetaLoaded(url: string, user: User | null) {
  const parsed = parseShortLinkUrl(url);
  if (!parsed) return;
  const key = cacheKey(parsed.kind, parsed.code);
  if (cache.has(key)) return;
  const fromSs = readSessionStorage(key);
  if (fromSs !== undefined) {
    cache.set(key, fromSs);
    return;
  }
  fetchLinkMeta(url, user).then((meta) => setLinkMetaCache(parsed.kind, parsed.code, meta));
}

// 이 url(짧은/커스텀 링크)의 캐시 값이 바뀔 때마다 listener를 호출한다. 반환값(구독 해제
// 함수)을 useEffect의 cleanup으로 그대로 넘기면 된다. 우리 링크가 아니면 아무것도 하지 않는
// 빈 함수를 돌려준다.
export function subscribeLinkMeta(url: string, listener: () => void): () => void {
  const parsed = parseShortLinkUrl(url);
  if (!parsed) return () => {};
  const key = cacheKey(parsed.kind, parsed.code);
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(listener);
  return () => {
    listeners.get(key)?.delete(listener);
  };
}
