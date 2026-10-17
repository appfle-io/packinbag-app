import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrivateLock } from "@/lib/types";
import {
  PIN_LENGTHS,
  checkPin,
  clearPinFailures,
  createPinLock,
  isBagLocked,
  isLibraryLocked,
  isPackLockInherited,
  isPackLocked,
  isSessionUnlocked,
  lockedCount,
  lockoutRemainingMs,
  nativeLockFilter,
  packLockKey,
  recordPinFailure,
  setSessionUnlocked,
  withLockToggled,
} from "@/lib/v2/privateLock";

// docs/spec/settings.md SET-LOCK · SET-PIN · SET-LIM · SET-LOCKSCR: 개인 잠금(나만 잠김, 화면 가림)

const lockWith = (extra: Partial<PrivateLock> = {}) =>
  ({ v: 1, pinHash: "hash", salt: "salt", iterations: 1, length: 6, bags: [], packs: [], library: [], ...extra }) as PrivateLock;
const pack = (id: string, linkedLibraryPackId?: string) => ({ id, linkedLibraryPackId });

describe("잠근 대상 판정", () => {
  it("SET-LOCK-10 PIN이 없으면 목록에 있어도 아무것도 잠기지 않는다", () => {
    const noPin = lockWith({ pinHash: "", bags: ["b1"], packs: [packLockKey("b1", "p1")], library: ["L1"] });
    expect(isBagLocked(noPin, "b1")).toBe(false);
    expect(isPackLocked(noPin, "b1", pack("p1"))).toBe(false);
    expect(isLibraryLocked(noPin, "L1")).toBe(false);
    expect(lockedCount(noPin)).toBe(0);
    expect(nativeLockFilter(noPin)).toEqual({ lockedBagIds: [], lockedPackKeys: [], lockedLibraryIds: [] });
    expect(isBagLocked(null, "b1")).toBe(false);
  });

  it("SET-LOCK-10 가방 · 가방 속 팩(가방id/팩id) · 보관함 팩", () => {
    const lock = lockWith({ bags: ["b1"], packs: [packLockKey("b1", "p1")], library: ["L1"] });
    expect(isBagLocked(lock, "b1")).toBe(true);
    expect(isBagLocked(lock, "b2")).toBe(false);
    expect(isPackLocked(lock, "b1", pack("p1"))).toBe(true);
    expect(isPackLocked(lock, "b2", pack("p1"))).toBe(false); // 같은 팩 id라도 다른 가방이면 아님
    expect(isLibraryLocked(lock, "L1")).toBe(true);
    expect(isLibraryLocked(lock, undefined)).toBe(false);
  });

  it("SET-LOCKSCR-05 보관함에서 잠근 팩을 불러온 가방 속 팩은 같이 잠기고, '물려받은 잠금'으로 표시", () => {
    const lock = lockWith({ library: ["L1"] });
    expect(isPackLocked(lock, "b1", pack("p9", "L1"))).toBe(true);
    expect(isPackLockInherited(lock, "b1", pack("p9", "L1"))).toBe(true);
    // 가방에서 직접 잠갔다면 물려받은 것이 아님
    const both = lockWith({ library: ["L1"], packs: [packLockKey("b1", "p9")] });
    expect(isPackLockInherited(both, "b1", pack("p9", "L1"))).toBe(false);
  });
});

describe("잠금 목록 바꾸기", () => {
  it("SET-LOCK-03 중복 없이 추가하고, 빼고, updatedAt을 새로 쓴다", () => {
    const start = lockWith({ bags: ["b1"], updatedAt: "2000-01-01T00:00:00.000Z" });
    const added = withLockToggled(start, "bag", "b1", true);
    expect(added.bags).toEqual(["b1"]);
    expect(added.updatedAt).not.toBe(start.updatedAt);
    const more = withLockToggled(withLockToggled(added, "pack", "b1/p1", true), "library", "L1", true);
    expect(lockedCount(more)).toBe(3);
    const removed = withLockToggled(more, "bag", "b1", false);
    expect(removed.bags).toEqual([]);
    expect(lockedCount(removed)).toBe(2);
    expect(start.bags).toEqual(["b1"]); // 원본은 그대로
  });

  it("SET-LOCK-10 위젯 요약에서 뺄 목록", () => {
    const lock = lockWith({ bags: ["b1"], packs: ["b2/p1"], library: ["L1"] });
    expect(nativeLockFilter(lock)).toEqual({ lockedBagIds: ["b1"], lockedPackKeys: ["b2/p1"], lockedLibraryIds: ["L1"] });
  });
});

describe("PIN", () => {
  it("SET-PIN-03 PIN 자리 수는 4 · 6", () => {
    expect([...PIN_LENGTHS]).toEqual([4, 6]);
  });

  it("SET-PIN-03 · 04 만든 PIN은 맞고, 다른 PIN은 틀리며, 평문은 남지 않는다", async () => {
    const lock = await createPinLock("123456", 6);
    expect(lock.pinHash).not.toContain("123456");
    expect(await checkPin(lock, "123456")).toBe(true);
    expect(await checkPin(lock, "123457")).toBe(false);
    expect(await checkPin({ ...lock, pinHash: "" }, "123456")).toBe(false);
  });

  it("SET-PIN-04 PIN을 바꿔도 잠근 목록은 유지되고, 같은 PIN이어도 salt가 달라 해시가 다르다", async () => {
    const before = lockWith({ bags: ["b1"], packs: ["b1/p1"], library: ["L1"] });
    const a = await createPinLock("1234", 4, before);
    const b = await createPinLock("1234", 4, before);
    expect(a).toMatchObject({ length: 4, bags: ["b1"], packs: ["b1/p1"], library: ["L1"] });
    expect(a.salt).not.toBe(b.salt);
    expect(a.pinHash).not.toBe(b.pinHash);
  });
});

describe("틀린 횟수(이 기기)", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("SET-LIM-07 4번까지는 기다림 없음, 5번 30초, 6번 60초, 상한 30분", () => {
    const waits = Array.from({ length: 12 }, () => recordPinFailure("u1").waitMs);
    expect(waits.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(waits[4]).toBe(30_000);
    expect(waits[5]).toBe(60_000);
    expect(Math.max(...waits)).toBe(30 * 60_000);
    expect(waits[11]).toBe(30 * 60_000);
  });

  it("SET-LOCKSCR-03 기다리는 동안 남은 시간이 있고, 맞히면(clear) 처음부터", () => {
    for (let i = 0; i < 5; i++) recordPinFailure("u1");
    expect(lockoutRemainingMs("u1")).toBeGreaterThan(0);
    expect(lockoutRemainingMs("u2")).toBe(0); // 계정마다 따로
    clearPinFailures("u1");
    expect(lockoutRemainingMs("u1")).toBe(0);
    expect(recordPinFailure("u1").fails).toBe(1);
  });
});

describe("지금 풀려 있는지", () => {
  it("SET-LOCKSCR-03 풀기 · 다시 잠그기", () => {
    setSessionUnlocked(true);
    expect(isSessionUnlocked()).toBe(true);
    setSessionUnlocked(false);
    expect(isSessionUnlocked()).toBe(false);
  });
});
