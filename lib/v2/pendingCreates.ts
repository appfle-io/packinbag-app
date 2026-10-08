"use client";

import type { User } from "firebase/auth";
import type { Bag, Pack } from "@/lib/types";

/**
 * 계정 모드에서 인터넷이 끊겨 있을 때 만든 새 가방·팩(연결 흐름 C).
 * 새 가방·팩은 무료 개수 검사 때문에 서버 API로만 만들 수 있어서(firestore.rules: create false),
 * 끊겨 있는 동안에는 이 기기(localStorage, 계정별)에 "만들기 대기"로 두고 화면에는 평소처럼 보여 준다.
 * - 대기 중 수정: saveBagRemote / saveLibraryPackRemote가 여기로 돌려 저장한다(서버에 아직 문서가 없으므로)
 * - 다시 연결되면 flushPendingCreates가 생성 API를 불러 실제 가방·팩으로 만든다. 서버가 같은 id를 쓰므로 바꿔 끼울 것이 없다
 * - 무료 개수를 넘었으면 지우지 않고 남겨 두고(blocked) 프리미엄 안내를 띄운다
 * 오프라인 모드(로그인 없이 이 기기 저장)와는 다른 것이다: 그쪽은 localBagsService.
 */
interface PendingBag {
  bag: Bag;
  ownerProfile: { nickname: string; avatarId: string };
  blocked?: string;
}
interface PendingPack {
  pack: Pack;
  blocked?: string;
}
interface PendingStore {
  bags: PendingBag[];
  packs: PendingPack[];
}

export const PENDING_CHANGE_EVENT = "pib:pending-change";

const keyFor = (uid: string) => `pib_pending_creates:${uid}`;

function read(uid: string): PendingStore {
  if (typeof window === "undefined") return { bags: [], packs: [] };
  try {
    const raw = localStorage.getItem(keyFor(uid));
    const parsed = raw ? (JSON.parse(raw) as Partial<PendingStore>) : {};
    return { bags: parsed.bags ?? [], packs: parsed.packs ?? [] };
  } catch {
    return { bags: [], packs: [] };
  }
}

function write(uid: string, store: PendingStore) {
  try {
    if (store.bags.length === 0 && store.packs.length === 0) localStorage.removeItem(keyFor(uid));
    else localStorage.setItem(keyFor(uid), JSON.stringify(store));
  } catch (err) {
    console.error("[팩인백] 만들기 대기 저장 실패:", err);
  }
  window.dispatchEvent(new CustomEvent(PENDING_CHANGE_EVENT));
}

// --- 가방 ---------------------------------------------------------------------------
export function getPendingBags(uid: string): Bag[] {
  return read(uid).bags.map((p) => p.bag);
}
export function isPendingBag(uid: string | undefined, bagId: string): boolean {
  return !!uid && read(uid).bags.some((p) => p.bag.id === bagId);
}
export function addPendingBag(uid: string, bag: Bag, ownerProfile: { nickname: string; avatarId: string }) {
  const store = read(uid);
  store.bags = [...store.bags.filter((p) => p.bag.id !== bag.id), { bag, ownerProfile }];
  write(uid, store);
}
export function savePendingBag(uid: string, bag: Bag) {
  const store = read(uid);
  store.bags = store.bags.map((p) => (p.bag.id === bag.id ? { ...p, bag: { ...bag, updatedAt: new Date().toISOString() } } : p));
  write(uid, store);
}
export function removePendingBag(uid: string, bagId: string) {
  const store = read(uid);
  store.bags = store.bags.filter((p) => p.bag.id !== bagId);
  write(uid, store);
}

// --- 팩 보관함 ------------------------------------------------------------------------
export function getPendingPacks(uid: string): Pack[] {
  return read(uid).packs.map((p) => p.pack);
}
export function isPendingPack(uid: string | undefined, packId: string): boolean {
  return !!uid && read(uid).packs.some((p) => p.pack.id === packId);
}
export function addPendingPack(uid: string, pack: Pack) {
  const store = read(uid);
  store.packs = [...store.packs.filter((p) => p.pack.id !== pack.id), { pack }];
  write(uid, store);
}
export function savePendingPack(uid: string, pack: Pack) {
  const store = read(uid);
  store.packs = store.packs.map((p) => (p.pack.id === pack.id ? { ...p, pack } : p));
  write(uid, store);
}
export function removePendingPack(uid: string, packId: string) {
  const store = read(uid);
  store.packs = store.packs.filter((p) => p.pack.id !== packId);
  write(uid, store);
}

/** 서버 목록 + 대기 중인 것(서버에 아직 없는 것만) */
export function withPending<T extends { id: string }>(remote: T[], pending: T[]): T[] {
  const ids = new Set(remote.map((x) => x.id));
  return [...pending.filter((x) => !ids.has(x.id)), ...remote];
}

/** fetch 자체가 실패한 경우(폐쇄망·끊김). 서버가 거절한 경우(4xx·5xx)와 구분한다 */
export function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /TypeError|Failed to fetch|NetworkError|Load failed|network/i.test(msg);
}

export interface FlushResult {
  created: number;
  blockedMessage: string | null;
}

let flushing: Promise<FlushResult> | null = null;

/**
 * 대기 중인 가방·팩을 서버에 만든다. 겹쳐 불러도 한 번만 돈다. 네트워크 오류면 그 자리에서 멈추고 다음 연결 때 다시 한다.
 * 만드는 사이에 사용자가 고친 내용은 만든 뒤 한 번 더 저장해 잃지 않는다.
 */
export function flushPendingCreates(
  user: User,
  deps: {
    createBag: (user: User, bag: Bag, ownerProfile: { nickname: string; avatarId: string }) => Promise<Bag>;
    saveBag: (bag: Bag) => Promise<unknown>;
    createPack: (user: User, pack: Pack) => Promise<unknown>;
    isLimitError: (err: unknown) => boolean;
  },
): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const result: FlushResult = { created: 0, blockedMessage: null };
    for (const item of read(user.uid).bags) {
      const sent = item.bag;
      try {
        await deps.createBag(user, sent, item.ownerProfile);
        const latest = read(user.uid).bags.find((p) => p.bag.id === sent.id)?.bag;
        removePendingBag(user.uid, sent.id);
        if (latest && JSON.stringify(latest) !== JSON.stringify(sent)) await deps.saveBag(latest);
        result.created += 1;
      } catch (err) {
        if (isNetworkError(err)) return result;
        if (deps.isLimitError(err)) {
          result.blockedMessage = err instanceof Error ? err.message : "무료 개수를 넘었어요";
          continue;
        }
        console.error("[팩인백] 대기 중인 가방 만들기 실패:", err);
      }
    }
    for (const item of read(user.uid).packs) {
      const sent = item.pack;
      try {
        await deps.createPack(user, sent);
        removePendingPack(user.uid, sent.id);
        result.created += 1;
      } catch (err) {
        if (isNetworkError(err)) return result;
        if (deps.isLimitError(err)) {
          result.blockedMessage = err instanceof Error ? err.message : "무료 개수를 넘었어요";
          continue;
        }
        console.error("[팩인백] 대기 중인 팩 만들기 실패:", err);
      }
    }
    return result;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
