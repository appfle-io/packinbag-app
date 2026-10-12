// 개인 잠금(2026-10-12) - 가방 · 가방 속 팩 · 보관함 팩을 "나만" PIN(+ Face ID)으로 잠근다.
//
// - 설정은 내 계정(users/{uid}.privateLock)에만 있다. 가방 문서에는 아무것도 쓰지 않는다 → 함께 쓰는 멤버에게는 영향 없음
// - PIN은 PBKDF2-SHA256 해시로만 저장한다(평문 X). 같은 계정이면 모든 기기에서 같은 PIN
// - 화면을 가리는 잠금이지 암호화가 아니다(데이터는 서버에 그대로). 휴대폰을 잠깐 빌려준 사람을 막는 용도
// - 한 번 풀면 이 앱을 떠날 때까지(다른 앱 · 홈 화면 · 탭 전환) 모든 잠금이 풀린 상태. 떠나면 바로 다시 잠긴다
// - 틀린 횟수 · Face ID 사용 여부는 이 기기에만(localStorage)
// - 무료 한도 초과로 잠긴 가방 · 팩(Bag.locked / Pack.locked, 서버 전용)과는 다른 기능이다. 화면에서는 그쪽을 "읽기 전용"이라 부른다
"use client";

import { useSyncExternalStore } from "react";
import type { Pack, PrivateLock } from "@/lib/types";

export const PIN_LENGTHS = [4, 6] as const;
export type PinLength = (typeof PIN_LENGTHS)[number];
export const DEFAULT_PIN_LENGTH: PinLength = 6;
const ITERATIONS = 150_000;

// ---- 잠근 대상 ---------------------------------------------------------------

export type LockKind = "bag" | "pack" | "library";

export const packLockKey = (bagId: string, packId: string) => `${bagId}/${packId}`;

export function isBagLocked(lock: PrivateLock | null | undefined, bagId: string): boolean {
  return !!lock?.pinHash && !!lock.bags?.includes(bagId);
}

export function isLibraryLocked(lock: PrivateLock | null | undefined, packId: string | undefined): boolean {
  return !!lock?.pinHash && !!packId && !!lock.library?.includes(packId);
}

// 가방 속 팩: 직접 잠갔거나, 보관함에서 잠근 팩을 불러온 것(linkedLibraryPackId)이면 잠김
export function isPackLocked(lock: PrivateLock | null | undefined, bagId: string, pack: Pick<Pack, "id" | "linkedLibraryPackId">): boolean {
  if (!lock?.pinHash) return false;
  return !!lock.packs?.includes(packLockKey(bagId, pack.id)) || isLibraryLocked(lock, pack.linkedLibraryPackId);
}

// 보관함 잠금 때문에 같이 잠긴 것인지(가방에서는 풀 수 없음 - 보관함에서 풀어야 함)
export function isPackLockInherited(lock: PrivateLock | null | undefined, bagId: string, pack: Pick<Pack, "id" | "linkedLibraryPackId">): boolean {
  return !!lock?.pinHash && !lock.packs?.includes(packLockKey(bagId, pack.id)) && isLibraryLocked(lock, pack.linkedLibraryPackId);
}

const listOf = (kind: LockKind) => (kind === "bag" ? "bags" : kind === "pack" ? "packs" : "library");

export function withLockToggled(lock: PrivateLock, kind: LockKind, id: string, on: boolean): PrivateLock {
  const key = listOf(kind);
  const current = new Set(lock[key] ?? []);
  if (on) current.add(id);
  else current.delete(id);
  return { ...lock, [key]: [...current], updatedAt: new Date().toISOString() };
}

export function lockedCount(lock: PrivateLock | null | undefined): number {
  if (!lock?.pinHash) return 0;
  return (lock.bags?.length ?? 0) + (lock.packs?.length ?? 0) + (lock.library?.length ?? 0);
}

// 위젯 요약(lib/nativeSummary)에서 뺄 것
export function nativeLockFilter(lock: PrivateLock | null | undefined): { lockedBagIds: string[]; lockedPackKeys: string[]; lockedLibraryIds: string[] } {
  if (!lock?.pinHash) return { lockedBagIds: [], lockedPackKeys: [], lockedLibraryIds: [] };
  return { lockedBagIds: lock.bags ?? [], lockedPackKeys: lock.packs ?? [], lockedLibraryIds: lock.library ?? [] };
}

// ---- PIN 해시 -------------------------------------------------------------------

const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return toB64(bits);
}

export async function createPinLock(pin: string, length: PinLength, keep?: PrivateLock | null): Promise<PrivateLock> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pinHash = await derive(pin, salt, ITERATIONS);
  return {
    v: 1,
    pinHash,
    salt: toB64(salt),
    iterations: ITERATIONS,
    length,
    bags: keep?.bags ?? [],
    packs: keep?.packs ?? [],
    library: keep?.library ?? [],
    updatedAt: new Date().toISOString(),
  };
}

export async function checkPin(lock: PrivateLock, pin: string): Promise<boolean> {
  if (!lock.pinHash || !lock.salt) return false;
  const hash = await derive(pin, fromB64(lock.salt), lock.iterations || ITERATIONS);
  // 길이가 같은 문자열을 끝까지 비교(시간 차이로 맞히지 못하게)
  if (hash.length !== lock.pinHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ lock.pinHash.charCodeAt(i);
  return diff === 0;
}

// ---- 틀린 횟수(이 기기) ----------------------------------------------------------
// 5번 틀리면 30초, 그 뒤로 한 번 틀릴 때마다 두 배(최대 30분)

const FREE_TRIES = 5;
const attemptsKey = (uid: string) => `pib_lock_attempts:${uid}`;

function readAttempts(uid: string): { fails: number; until: number } {
  try {
    const v = JSON.parse(localStorage.getItem(attemptsKey(uid)) ?? "null");
    if (v && typeof v.fails === "number") return { fails: v.fails, until: Number(v.until) || 0 };
  } catch {}
  return { fails: 0, until: 0 };
}

export function lockoutRemainingMs(uid: string): number {
  return Math.max(0, readAttempts(uid).until - Date.now());
}

export function recordPinFailure(uid: string): { fails: number; waitMs: number } {
  const { fails } = readAttempts(uid);
  const next = fails + 1;
  const waitMs = next >= FREE_TRIES ? Math.min(30 * 60_000, 30_000 * 2 ** (next - FREE_TRIES)) : 0;
  try {
    localStorage.setItem(attemptsKey(uid), JSON.stringify({ fails: next, until: waitMs ? Date.now() + waitMs : 0 }));
  } catch {}
  return { fails: next, waitMs };
}

export function clearPinFailures(uid: string) {
  try {
    localStorage.removeItem(attemptsKey(uid));
  } catch {}
}

// ---- Face ID 사용(이 기기) -------------------------------------------------------

const bioKey = (uid: string) => `pib_lock_biometric:${uid}`;

export function readBiometricPref(uid: string): boolean {
  try {
    return localStorage.getItem(bioKey(uid)) === "1";
  } catch {
    return false;
  }
}

export function writeBiometricPref(uid: string, on: boolean) {
  try {
    if (on) localStorage.setItem(bioKey(uid), "1");
    else localStorage.removeItem(bioKey(uid));
  } catch {}
  emit();
}

// ---- 지금 풀려 있는지(이 탭 · 이 앱 실행) -----------------------------------------

let unlocked = false;
let version = 0;
const listeners = new Set<() => void>();
function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function isSessionUnlocked(): boolean {
  return unlocked;
}

export function setSessionUnlocked(on: boolean) {
  if (unlocked === on) return;
  unlocked = on;
  emit();
}

let watching = false;
function watchLeave() {
  if (watching || typeof document === "undefined") return;
  watching = true;
  // 앱을 떠나면(홈 화면 · 다른 앱 · 탭 전환) 바로 다시 잠근다
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") setSessionUnlocked(false);
  });
}

function subscribe(cb: () => void) {
  watchLeave();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// 풀림 상태 · Face ID 설정이 바뀌면 다시 그린다(version이 바뀜)
export function useLockSession(): { unlocked: boolean; version: number } {
  const v = useSyncExternalStore(subscribe, () => version, () => 0);
  return { unlocked, version: v };
}
