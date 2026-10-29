import { describe, expect, it } from "vitest";
import type { Bag, Item, Pack } from "@/lib/types";
import { buildNativeLibrary, buildNativeSummary } from "./nativeSummary";

const item = (id: string, extra: Partial<Item> = {}): Item => ({ id, type: "check", text: id, checked: false, ...extra });
const pack = (id: string, items: Item[], extra: Partial<Pack> = {}): Pack => ({ id, name: id, items, ...extra });
const bag = (id: string, packs: Pack[], extra: Partial<Bag> = {}): Bag =>
  ({ id, name: id, packs, ownerId: "me", updatedAt: "2026-11-01T00:00:00.000Z", ...extra }) as Bag;
const NOW = new Date("2026-11-10T03:00:00.000Z");

describe("NAT-SUM 가방 요약", () => {
  it("NAT-SUM-02 체크 아이템만, 메모 · 폴더 팩 · 글 아이템 빼고", () => {
    const s = buildNativeSummary(
      [bag("b1", [pack("p1", [item("a"), item("t", { type: "text" })]), pack("m", [], { kind: "editor" }), pack("f", [], { type: "folder" })])],
      "me",
      NOW,
    );
    expect(s.bags[0].packs).toEqual([{ id: "p1", name: "p1", items: [{ id: "a", text: "a", checked: false }] }]);
  });

  it("NAT-SUM-03 휴지통 · 보관 · 잠근 가방 빼고, 고정한 가방이 먼저", () => {
    const s = buildNativeSummary(
      [
        bag("recent", [], { lastCheckedAt: "2026-11-09T00:00:00.000Z" }),
        bag("pinned", []),
        bag("trash", [], { trashedByOwnerAt: "2026-11-01T00:00:00.000Z" }),
        bag("archived", []),
        bag("locked", []),
      ],
      "me",
      NOW,
      { pinnedBagIds: ["pinned"], archivedBagIds: ["archived"], lockedBagIds: ["locked"] },
    );
    expect(s.bags.map((b) => b.id)).toEqual(["pinned", "recent"]);
    expect(s.bags[0].pinned).toBe(true);
  });

  it("NAT-SUM-04 미분류가 맨 앞, 빈 미분류는 뺀다 · 잠근 팩은 뺀다", () => {
    const s = buildNativeSummary(
      [
        bag("b1", [pack("p1", [item("a")]), pack("inbox", [item("b")], { isInbox: true }), pack("secret", [item("c")])]),
        bag("b2", [pack("inbox2", [], { isInbox: true }), pack("p2", [])]),
      ],
      "me",
      NOW,
      { lockedPackKeys: ["b1/secret"] },
    );
    const b1 = s.bags.find((b) => b.id === "b1")!;
    const b2 = s.bags.find((b) => b.id === "b2")!;
    expect(b1.packs.map((p) => p.id)).toEqual(["inbox", "p1"]);
    expect(b2.packs.map((p) => p.id)).toEqual(["p2"]);
  });

  it("D-Day · 당일 1일 · 다 싼 날은 있을 때만 키를 넣는다(예전 앱은 모르는 키를 무시)", () => {
    const s = buildNativeSummary(
      [
        bag("on", [], { travelDate: "2026-11-10", ddayCountTodayAsDayOne: true, lastPackedAt: "2026-11-09T11:00:00.000Z" }),
        bag("off", [], { travelDate: "2026-11-10", ddayCountTodayAsDayOne: false }),
      ],
      "me",
      NOW,
    );
    const on = s.bags.find((b) => b.id === "on")!;
    const off = s.bags.find((b) => b.id === "off")!;
    expect(on).toMatchObject({ travelDate: "2026-11-10", ddayDayOne: true, lastPackedAt: "2026-11-09T11:00:00.000Z" });
    expect("ddayDayOne" in off).toBe(false);
    expect("lastPackedAt" in off).toBe(false);
  });
});

describe("NAT-SUM 보관함 검색 목록", () => {
  it("폴더 · 휴지통 · 잠근 팩 빼고 최근 순, 메모는 개수 없이", () => {
    const list = buildNativeLibrary(
      [
        pack("old", [item("a"), item("t", { type: "text" })], { updatedAt: "2026-11-01" }),
        pack("note", [], { kind: "editor", updatedAt: "2026-11-05" }),
        pack("folder", [], { type: "folder", updatedAt: "2026-11-09" }),
        pack("trash", [], { trashedAt: "2026-11-08", updatedAt: "2026-11-08" }),
        pack("locked", [], { updatedAt: "2026-11-07" }),
      ],
      ["locked"],
    );
    expect(list).toEqual([
      { id: "note", name: "note", kind: "note" },
      { id: "old", name: "old", kind: "checklist", count: 1 },
    ]);
  });
});
