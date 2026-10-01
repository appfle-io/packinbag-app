// 동시 편집 병합(3-way merge). Firestore 호출 없음 - 순수 함수.
//
// base   = 내가 마지막으로 받은 서버 버전(편집을 시작한 기준)
// local  = 지금 내 화면의 버전(내 변경 포함)
// remote = 방금 받은(또는 트랜잭션에서 읽은) 서버 최신 버전(다른 사람/기기의 변경 포함)
//
// 규칙: base에서 "내가 바꾼 것"만 remote 위에 얹는다. 둘이 같은 칸을 바꿨으면 내 쪽이 이긴다.
// - 가방/팩/아이템은 id로 짝을 맞춘다(체크·이름·추가·삭제·다른 팩으로 옮기기가 아이템 단위로 합쳐짐).
// - 메모 문서(editorDoc)는 맨 위 문단(블록) 단위로 diff3 병합한다. 서로 다른 문단은 둘 다 살고,
//   같은 문단을 둘이 고쳤으면 둘 다 남긴다(내 것 다음 상대 것) - 지우는 것보다 낫다.

import type { Bag, Item, Pack } from "@/lib/types";

type Rec = Record<string, unknown>;

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// 서버가 관리하거나 내가 바꾸면 안 되는 가방 필드(항상 서버 값을 쓴다)
const BAG_SERVER_KEYS = new Set([
  "id",
  "packs",
  "memberIds",
  "memberProfiles",
  "ownerId",
  "createdAt",
  "updatedAt",
  "trashedByOwnerAt",
  "inviteCode",
  "publicShareToken",
  "locked",
]);
const PACK_SKIP_KEYS = new Set(["id", "items"]);

// 필드 단위: remote에서 시작해서, base 대비 내가 바꾼 필드만 덮어쓴다
function mergeFields<T extends object>(base: T | undefined, local: T, remote: T, skip: Set<string>): T {
  const out: Rec = { ...(remote as Rec) };
  const l = local as Rec;
  const b = (base ?? {}) as Rec;
  const r = remote as Rec;
  const keys = new Set([...Object.keys(l), ...Object.keys(b)]);
  for (const k of keys) {
    if (skip.has(k)) continue;
    if (same(l[k], b[k])) continue; // 내가 안 바꿈 -> 서버 값 유지
    if (k === "editorDoc" && !same(r[k], b[k]) && !same(l[k], r[k])) {
      // 메모 문서를 양쪽이 다 고침 -> 문단 단위 병합
      out[k] = mergeEditorDocs(b[k] as object | undefined, l[k] as object | undefined, r[k] as object | undefined);
      continue;
    }
    if (l[k] === undefined) delete out[k];
    else out[k] = l[k];
  }
  return out as T;
}

// id 목록 병합. 순서는 내가 순서를 바꿨으면 내 순서, 아니면 서버 순서를 따르고,
// 한쪽에만 새로 생긴 것은 그쪽 목록에서 바로 앞에 있던 것 뒤에 끼운다.
function mergeList<T extends { id: string }>(
  base: T[],
  local: T[],
  remote: T[],
  mergeEl: (b: T | undefined, l: T, r: T) => T,
): T[] {
  const bm = new Map(base.map((x) => [x.id, x]));
  const lm = new Map(local.map((x) => [x.id, x]));
  const rm = new Map(remote.map((x) => [x.id, x]));

  const resolve = (id: string): T | null => {
    const b = bm.get(id);
    const l = lm.get(id);
    const r = rm.get(id);
    if (l && r) return mergeEl(b, l, r);
    if (l && !r) return b ? null : l; // 서버에서 지워짐(다른 사람이 삭제) / 내가 새로 추가
    if (r && !l) return b ? null : r; // 내가 지움 / 다른 사람이 새로 추가
    return null;
  };

  const commonOrder = (xs: T[]) => xs.map((x) => x.id).filter((id) => bm.has(id) && lm.has(id));
  const localReordered = !same(commonOrder(base), commonOrder(local));
  const primary = localReordered ? local : remote;
  const secondary = localReordered ? remote : local;

  const out: T[] = [];
  const placed = new Set<string>();
  for (const el of primary) {
    placed.add(el.id);
    const v = resolve(el.id);
    if (v) out.push(v);
  }
  let prevId: string | null = null;
  for (const el of secondary) {
    if (!placed.has(el.id)) {
      placed.add(el.id);
      const v = resolve(el.id);
      if (v) {
        const idx = prevId ? out.findIndex((o) => o.id === prevId) : -1;
        out.splice(idx + 1, 0, v);
      }
    }
    if (out.some((o) => o.id === el.id)) prevId = el.id;
  }
  return out;
}

const mergeItem = (b: Item | undefined, l: Item, r: Item): Item => mergeFields(b, l, r, new Set(["id"]));

export function mergePack(base: Pack | undefined, local: Pack, remote: Pack): Pack {
  const merged = mergeFields(base, local, remote, PACK_SKIP_KEYS);
  merged.items = mergeList(base?.items ?? [], local.items ?? [], remote.items ?? [], mergeItem);
  return merged;
}

export function mergeBag(base: Bag, local: Bag, remote: Bag): Bag {
  const merged = mergeFields(base, local, remote, BAG_SERVER_KEYS);
  merged.packs = mergeList(base.packs ?? [], local.packs ?? [], remote.packs ?? [], mergePack);
  return merged;
}

// 저장 시각만 다르고 내용이 같은지(불필요한 다시 그리기·다시 저장을 막는 데 쓴다)
export function sameContent<T extends { updatedAt?: string }>(a: T, b: T): boolean {
  return same({ ...a, updatedAt: undefined }, { ...b, updatedAt: undefined });
}

// --- 메모 문서: 맨 위 블록 단위 diff3 ---------------------------------------------------------

// 두 문자열 배열의 최장 공통 부분열 짝(인덱스 쌍)
function lcsPairs(a: string[], b: string[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  const dp = new Uint32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[at(i, j)] = a[i] === b[j] ? dp[at(i + 1, j + 1)] + 1 : Math.max(dp[at(i + 1, j)], dp[at(i, j + 1)]);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[at(i + 1, j)] >= dp[at(i, j + 1)]) i++;
    else j++;
  }
  return pairs;
}

function diff3<T>(base: T[], local: T[], remote: T[], key: (x: T) => string): T[] {
  const bk = base.map(key);
  const lk = local.map(key);
  const rk = remote.map(key);
  const toL = new Map(lcsPairs(bk, lk));
  const toR = new Map(lcsPairs(bk, rk));
  // 세 버전 모두에 그대로 남아 있는 base 블록이 기준점
  const stable: [number, number, number][] = [];
  for (let i = 0; i < bk.length; i++) {
    const li = toL.get(i);
    const ri = toR.get(i);
    if (li !== undefined && ri !== undefined) stable.push([i, li, ri]);
  }
  stable.push([bk.length, lk.length, rk.length]);

  const out: T[] = [];
  let pb = 0;
  let pl = 0;
  let pr = 0;
  for (const [sb, sl, sr] of stable) {
    const bChunk = bk.slice(pb, sb).join("\u0000");
    const lChunk = local.slice(pl, sl);
    const rChunk = remote.slice(pr, sr);
    const lStr = lk.slice(pl, sl).join("\u0000");
    const rStr = rk.slice(pr, sr).join("\u0000");
    if (lStr === bChunk) out.push(...rChunk);
    else if (rStr === bChunk || lStr === rStr) out.push(...lChunk);
    else {
      // 같은 곳을 양쪽이 고침: 내 것 + 상대 것(똑같은 블록은 한 번만)
      out.push(...lChunk);
      const seen = new Set(lk.slice(pl, sl));
      rChunk.forEach((x, idx) => {
        if (!seen.has(rk[pr + idx])) out.push(x);
      });
    }
    if (sb < bk.length) out.push(local[sl]);
    pb = sb + 1;
    pl = sl + 1;
    pr = sr + 1;
  }
  return out;
}

type DocJson = { type?: string; content?: unknown[] } & Rec;

export function mergeEditorDocs(base: object | undefined, local: object | undefined, remote: object | undefined): object | undefined {
  if (same(local, remote)) return local;
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  if (!local) return remote;
  if (!remote) return local;
  const b = ((base as DocJson | undefined)?.content ?? []) as unknown[];
  const l = ((local as DocJson).content ?? []) as unknown[];
  const r = ((remote as DocJson).content ?? []) as unknown[];
  const content = diff3(b, l, r, (x) => JSON.stringify(x));
  return { ...(local as DocJson), content };
}
