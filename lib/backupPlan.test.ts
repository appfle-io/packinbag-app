import { describe, expect, it } from "vitest";
import type { Bag, Pack } from "@/lib/types";
import {
  BACKUP_QUICK_PACK_NAME,
  buildRestoreProgress,
  isQuickPackEntry,
  libraryRestoreOrder,
  restoreProgressKey,
  restoredBagPacks,
  restoredLibraryPack,
  type BackupFileContent,
  type RestoreProgress,
} from "@/lib/backupPlan";

// _secrets/docs/spec/settings.md SET-BAK-09 · 10: 백업 복원(새 id로 만들기 · 폴더 따라가기 · 이어서 하기)

const lib = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, items: [], ...extra }) as unknown as Pack;
const folder = (id: string, parentId?: string) => lib(id, { type: "folder", ...(parentId ? { parentId } : {}) });
const bag = (id: string, packs: Pack[] = []) => ({ id, name: id, packs }) as unknown as Bag;
const backup = (bags: Bag[], libraryPacks: Pack[]): BackupFileContent => ({
  version: "1.0",
  appName: "PackInBag",
  exportedAt: "2026-10-17T00:00:00.000Z",
  bags,
  libraryPacks,
});
const counterIds = () => {
  let n = 0;
  return (kind: "bag" | "pack") => `${kind}-new-${++n}`;
};
const NOW = "2026-10-17T12:00:00.000Z";

describe("buildRestoreProgress", () => {
  it("SET-BAK-09 모든 가방 · 보관함 항목에 새 id를 정한다", () => {
    const p = buildRestoreProgress(backup([bag("b1")], [lib("L1"), lib("L2")]), counterIds());
    expect(Object.keys(p.packs)).toEqual(["L1", "L2"]);
    expect(Object.keys(p.bags)).toEqual(["b1"]);
    expect(new Set([...Object.values(p.packs), ...Object.values(p.bags)]).size).toBe(3);
    expect(p.done).toEqual([]);
  });

  it("SET-BAK-10 이어서 할 때는 지난번 id와 끝낸 목록을 그대로 쓴다", () => {
    const prev: RestoreProgress = { bags: { b1: "b-old" }, packs: { L1: "L-old" }, done: ["pack:L1"] };
    const p = buildRestoreProgress(backup([bag("b1")], [lib("L1"), lib("L2")]), counterIds(), prev);
    expect(p.bags.b1).toBe("b-old");
    expect(p.packs.L1).toBe("L-old");
    expect(p.packs.L2).toBeTruthy();
    expect(p.done).toEqual(["pack:L1"]);
    expect(p.done).not.toBe(prev.done); // 복사본
  });

  it("SET-BAK-10 같은 파일 · 같은 곳일 때만 같은 키", () => {
    const data = backup([bag("b1")], [lib("L1")]);
    expect(restoreProgressKey("uid-1", data)).toBe(restoreProgressKey("uid-1", { ...data }));
    expect(restoreProgressKey("uid-1", data)).not.toBe(restoreProgressKey("uid-2", data));
    expect(restoreProgressKey("uid-1", data)).not.toBe(restoreProgressKey("uid-1", { ...data, exportedAt: "다른 시각" }));
  });
});

describe("restoredLibraryPack", () => {
  const progress: RestoreProgress = { bags: {}, packs: { F1: "F1n", P1: "P1n", Q: "Qn", "quick-pack": "QPn" }, done: [] };

  it("SET-BAK-09 새 id · 새 parentId로, 공유 토큰 · 잠김 · 휴지통 표시는 뺀다", () => {
    const out = restoredLibraryPack(
      lib("P1", { parentId: "F1", publicShareToken: "t", locked: true, trashedAt: "x" }),
      progress,
      NOW,
    ) as unknown as Record<string, unknown>;
    expect(out).toMatchObject({ id: "P1n", parentId: "F1n", updatedAt: NOW });
    expect(out).not.toHaveProperty("publicShareToken");
    expect(out).not.toHaveProperty("locked");
    expect(out).not.toHaveProperty("trashedAt");
  });

  it("SET-BAK-09 백업에 없는 폴더 안 팩은 맨 위로", () => {
    const out = restoredLibraryPack(lib("P1", { parentId: "없는폴더" }), progress, NOW);
    expect(out).not.toHaveProperty("parentId");
  });

  it("SET-BAK-09 빠른팩은 '빠른팩 (백업)'이라는 보통 팩으로(맨 위)", () => {
    expect(isQuickPackEntry({ id: "quick-pack" })).toBe(true);
    expect(isQuickPackEntry({ id: "Q", isQuickPack: true })).toBe(true);
    expect(isQuickPackEntry({ id: "P1" })).toBe(false);
    const out = restoredLibraryPack(lib("Q", { isQuickPack: true, parentId: "F1" }), progress, NOW);
    expect(out).toMatchObject({ id: "Qn", name: BACKUP_QUICK_PACK_NAME });
    expect(out).not.toHaveProperty("isQuickPack");
    expect(out).not.toHaveProperty("parentId");
  });
});

describe("restoredBagPacks", () => {
  it("SET-BAK-09 보관함에서 불러온 가방 속 팩은 새 보관함 id로 이어진다", () => {
    const progress: RestoreProgress = { bags: {}, packs: { L1: "L1n" }, done: [] };
    const plain = lib("p2");
    const packs = restoredBagPacks(bag("b1", [lib("p1", { linkedLibraryPackId: "L1" }), plain, lib("p3", { linkedLibraryPackId: "없음" })]), progress);
    expect(packs[0].linkedLibraryPackId).toBe("L1n");
    expect(packs[1]).toBe(plain);
    expect(packs[2].linkedLibraryPackId).toBe("없음");
  });
});

describe("libraryRestoreOrder", () => {
  it("SET-BAK-09 폴더 먼저(바깥 폴더부터), 그다음 팩 · 메모는 백업 안 순서대로", () => {
    const order = libraryRestoreOrder([lib("P1"), folder("F2", "F1"), lib("P2"), folder("F1"), folder("F3")]);
    expect(order.map((p) => p.id)).toEqual(["F1", "F3", "F2", "P1", "P2"]);
  });

  it("SET-BAK-09 폴더가 서로를 부모로 가리켜도(순환) 멈추지 않는다", () => {
    const order = libraryRestoreOrder([folder("A", "B"), folder("B", "A"), lib("P")]);
    expect(order.map((p) => p.id)).toEqual(["A", "B", "P"]);
  });
});
