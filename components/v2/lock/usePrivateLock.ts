"use client";

import { useAuth } from "@/contexts/AuthProvider";
import type { Pack, PrivateLock } from "@/lib/types";
import {
  checkPin,
  clearPinFailures,
  createPinLock,
  isBagLocked,
  isLibraryLocked,
  isPackLockInherited,
  isPackLocked,
  lockoutRemainingMs,
  readBiometricPref,
  recordPinFailure,
  setSessionUnlocked,
  useLockSession,
  withLockToggled,
  writeBiometricPref,
  type LockKind,
  type PinLength,
} from "@/lib/v2/privateLock";

// 개인 잠금 화면 쪽 훅(lib/v2/privateLock.ts). 계정 설정(profile.privateLock) + 지금 풀려 있는지(이 앱 실행)를 묶는다.
// - available: 이 계정에서 쓸 수 있는지(오프라인 모드 · 게스트는 본인 확인을 할 수 없어 PIN을 잊으면 아무나 재설정 → 안 씀)
// - *Hidden: 잠겼고 지금 풀려 있지 않아서 내용을 가려야 하는지
export function usePrivateLock() {
  const { user, profile, isOfflineMode, isGuest, updatePrivateLock } = useAuth();
  const { unlocked } = useLockSession();
  const uid = user?.uid ?? "";
  const available = !!user && !isOfflineMode && !isGuest;
  const lock: PrivateLock | null = available && profile?.privateLock?.pinHash ? profile.privateLock : null;

  const bagLocked = (bagId: string) => isBagLocked(lock, bagId);
  const packLocked = (bagId: string, pack: Pick<Pack, "id" | "linkedLibraryPackId">) => isPackLocked(lock, bagId, pack);
  const libraryLocked = (packId: string | undefined) => isLibraryLocked(lock, packId);

  // PIN 확인. 틀린 횟수가 쌓이면 잠깐 막는다. 맞으면 이번 실행 동안 모두 풀린다
  const verify = async (pin: string): Promise<{ ok: true } | { ok: false; waitMs: number; fails: number }> => {
    if (!lock) return { ok: false, waitMs: 0, fails: 0 };
    const wait = lockoutRemainingMs(uid);
    if (wait > 0) return { ok: false, waitMs: wait, fails: 0 };
    if (await checkPin(lock, pin)) {
      clearPinFailures(uid);
      setSessionUnlocked(true);
      return { ok: true };
    }
    const r = recordPinFailure(uid);
    return { ok: false, waitMs: r.waitMs, fails: r.fails };
  };

  // 새 PIN(처음 · 바꾸기 · 잊어서 재설정). 잠근 목록은 그대로 둔다. 방금 입력했으니 이번 실행은 풀린 상태로
  const savePin = async (pin: string, length: PinLength): Promise<PrivateLock> => {
    const next = await createPinLock(pin, length, profile?.privateLock ?? null);
    // 쓰기는 기다리지 않는다(끊긴 동안에는 서버 답이 연결될 때까지 안 와서 화면이 멈춘 것처럼 보인다). 화면에는 바로 반영됨
    persist(next);
    clearPinFailures(uid);
    setSessionUnlocked(true);
    return next;
  };

  // base: 방금 PIN을 만든 직후처럼 화면에 아직 안 들어온 설정을 기준으로 할 때
  const setLocked = async (kind: LockKind, id: string, on: boolean, base?: PrivateLock) => {
    const from = base ?? lock;
    if (!from) return;
    persist(withLockToggled(from, kind, id, on));
  };

  const persist = (next: PrivateLock | null) => {
    updatePrivateLock(next).catch((err) => console.error("[팩인백] 잠금 설정 저장 실패:", err));
  };

  // 잠금 끄기: PIN과 잠근 목록을 모두 지운다
  const disable = async () => {
    persist(null);
    writeBiometricPref(uid, false);
    setSessionUnlocked(false);
  };

  return {
    available,
    lock,
    hasPin: !!lock,
    pinLength: (lock?.length ?? 6) as PinLength,
    unlocked,
    uid,
    bagLocked,
    packLocked,
    libraryLocked,
    packLockInherited: (bagId: string, pack: Pick<Pack, "id" | "linkedLibraryPackId">) => isPackLockInherited(lock, bagId, pack),
    bagHidden: (bagId: string) => bagLocked(bagId) && !unlocked,
    packHidden: (bagId: string, pack: Pick<Pack, "id" | "linkedLibraryPackId">) => packLocked(bagId, pack) && !unlocked,
    libraryHidden: (packId: string | undefined) => libraryLocked(packId) && !unlocked,
    biometricOn: !!uid && readBiometricPref(uid),
    setBiometricOn: (on: boolean) => writeBiometricPref(uid, on),
    verify,
    savePin,
    setLocked,
    disable,
  };
}

export type PrivateLockApi = ReturnType<typeof usePrivateLock>;
