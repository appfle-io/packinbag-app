import { describe, expect, it } from "vitest";
import type { Bag, Item, Pack } from "@/lib/types";
import { doneBoxModeOf, packsWithoutDoneBox, splitDoneBox, stampCheckedAt } from "./doneBox";

const item = (id: string, checked: boolean, checkedAt?: string): Item => ({ id, type: "check", text: id, checked, checkedAt });
const bagOf = (packs: Pack[], extra: Partial<Bag> = {}): Bag =>
  ({ id: "b", name: "가방", images: [], packs, memberIds: [], ownerId: "u", inviteCode: "x", createdAt: "", updatedAt: "", ...extra }) as Bag;
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const iso = (t: number) => new Date(t).toISOString();

describe("BAG-DONE 완료함", () => {
  it("BAG-DONE-02 꺼져 있으면(없음) 아무것도 안 옮김", () => {
    const bag = bagOf([{ id: "p", name: "팩", items: [item("a", true, iso(at(2026, 11, 1)))] }]);
    expect(doneBoxModeOf(bag)).toBe("off");
    expect(splitDoneBox(bag, at(2026, 12, 1)).entries).toHaveLength(0);
  });

  it("BAG-DONE-02 바로: 시각과 상관없이 체크한 것 모두", () => {
    const later = iso(at(2026, 11, 1, 10));
    const bag = bagOf([{ id: "p", name: "팩", items: [item("a", true, later), item("b", false)] }], { doneBoxMode: "now" });
    const r = splitDoneBox(bag, at(2026, 11, 1, 9));
    expect([...r.ids]).toEqual(["a"]);
  });

  it("BAG-DONE-02 1시간 뒤 · 다음 날 새벽 4시 · 7일 뒤", () => {
    const t = at(2026, 11, 1, 22);
    const p = (): Pack[] => [{ id: "p", name: "팩", items: [item("a", true, iso(t))] }];
    const hour = bagOf(p(), { doneBoxMode: "hour" });
    expect(splitDoneBox(hour, t + 59 * 60_000).ids.size).toBe(0);
    expect(splitDoneBox(hour, t + 59 * 60_000).nextChangeAt).toBe(t + 3_600_000);
    expect(splitDoneBox(hour, t + 3_600_000).ids.size).toBe(1);
    const nd = bagOf(p(), { doneBoxMode: "nextday" });
    expect(splitDoneBox(nd, at(2026, 11, 2, 3, 59)).ids.size).toBe(0);
    expect(splitDoneBox(nd, at(2026, 11, 2, 4)).ids.size).toBe(1);
    const wk = bagOf(p(), { doneBoxMode: "week" });
    expect(splitDoneBox(wk, t + 7 * 86_400_000 - 1).ids.size).toBe(0);
  });

  it("BAG-DONE-02 D-Day 다음 날, D-Day가 없으면 다음 날로", () => {
    const t = at(2026, 11, 1, 9);
    const packs: Pack[] = [{ id: "p", name: "팩", items: [item("a", true, iso(t))] }];
    const dd = bagOf(packs, { doneBoxMode: "dday", travelDate: "2026-11-05" });
    expect(splitDoneBox(dd, at(2026, 11, 6, 3)).ids.size).toBe(0);
    expect(splitDoneBox(dd, at(2026, 11, 6, 4)).ids.size).toBe(1);
    expect(doneBoxModeOf(bagOf(packs, { doneBoxMode: "dday" }))).toBe("nextday");
  });

  it("BAG-DONE-03 checkedAt이 없으면 오래전에 챙긴 것으로(바로 완료함, 맨 뒤)", () => {
    const bag = bagOf([{ id: "p", name: "팩", items: [item("old", true), item("new", true, iso(at(2026, 11, 1, 9)))] }], {
      doneBoxMode: "hour",
      lastCheckedAt: iso(at(2026, 11, 1, 9)),
    });
    expect(splitDoneBox(bag, at(2026, 11, 1, 9, 30)).entries.map((e) => e.item.id)).toEqual(["old"]);
    expect(splitDoneBox(bag, at(2026, 11, 1, 10)).entries.map((e) => e.item.id)).toEqual(["new", "old"]);
  });

  it("BAG-DONE-02 메모 · 잠긴 팩은 빼고 최근 것 먼저", () => {
    const bag = bagOf(
      [
        { id: "p", name: "팩", items: [item("old", true, iso(at(2026, 10, 1))), item("new", true, iso(at(2026, 10, 2)))] },
        { id: "h", name: "잠금", items: [item("x", true, iso(at(2026, 10, 3)))] },
        { id: "m", name: "메모", kind: "editor", items: [] },
      ],
      { doneBoxMode: "now" },
    );
    const r = splitDoneBox(bag, at(2026, 11, 1), (p) => p.id === "h");
    expect(r.entries.map((e) => e.item.id)).toEqual(["new", "old"]);
  });

  it("BAG-DONE-03 체크하면 찍고 풀면 지우고, 그대로면 같은 객체", () => {
    const prev = bagOf([{ id: "p", name: "팩", items: [item("a", false), item("b", true, "2026-10-01T00:00:00.000Z")] }]);
    const next = bagOf([{ id: "p", name: "팩", items: [item("a", true), item("b", false, "2026-10-01T00:00:00.000Z")] }]);
    const out = stampCheckedAt(prev, next, "2026-11-01T00:00:00.000Z");
    expect(out.packs[0].items[0].checkedAt).toBe("2026-11-01T00:00:00.000Z");
    expect("checkedAt" in out.packs[0].items[1]).toBe(false);
    expect(stampCheckedAt(prev, prev, "x")).toBe(prev);
    // 되돌리기로 예전 값을 넣으면 그대로 둔다
    const restored = bagOf([{ id: "p", name: "팩", items: [item("a", true, "2026-09-01T00:00:00.000Z")] }]);
    expect(stampCheckedAt(prev, restored, "z").packs[0].items[0].checkedAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("BAG-DONE-10 완료함 것은 개수에서 뺀다(잠깐 제자리 둔 것은 셈, 꺼져 있으면 그대로)", () => {
    const t = at(2026, 11, 1, 9);
    const packs: Pack[] = [
      { id: "p", name: "팩", items: [item("a", true, iso(t)), item("b", false), item("c", true, iso(t))] },
      { id: "m", name: "메모", kind: "editor", items: [] },
    ];
    const off = bagOf(packs);
    expect(packsWithoutDoneBox(off)).toBe(off.packs);
    const now = bagOf(packs, { doneBoxMode: "now" });
    expect(packsWithoutDoneBox(now)[0].items.map((i) => i.id)).toEqual(["b"]);
    expect(packsWithoutDoneBox(now, now.packs, Date.now(), new Set(["c"]))[0].items.map((i) => i.id)).toEqual(["b", "c"]);
    const hour = bagOf(packs, { doneBoxMode: "hour" });
    expect(packsWithoutDoneBox(hour, hour.packs, t + 1000)[0].items).toHaveLength(3);
    expect(packsWithoutDoneBox(hour, hour.packs, t + 3_600_000)[0].items.map((i) => i.id)).toEqual(["b"]);
  });
});
