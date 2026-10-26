import { describe, expect, it } from "vitest";
import type { Bag, Item, Pack } from "@/lib/types";
import { isReminderEmpty, normalizeReminder, planBagNotifications, reminderSummary } from "./reminderPlan";

const item = (id: string, text: string, extra: Partial<Item> = {}): Item => ({ id, type: "check", text, checked: false, ...extra });
const pack = (id: string, name: string, items: Item[], extra: Partial<Pack> = {}): Pack => ({ id, name, items, ...extra });
const bag = (packs: Pack[], extra: Partial<Bag> = {}): Bag => ({ id: "b1", name: "제주 여행", travelDate: "2026-11-20", packs, ...extra }) as Bag;
// 2026-11-10(화) 12:00
const NOW = new Date(2026, 10, 10, 12, 0);

describe("NAT-NOTI 가방 알림 문구", () => {
  const b = bag([
    pack("p1", "옷", [item("i1", "티셔츠"), item("i2", "바지", { checked: true })]),
    pack("p2", "서류", [item("i3", "여권", { assigneeUid: "me" }), item("i4", "충전기", { assigneeUid: "me" })]),
  ]);

  it("D-N: 남은 개수 · 팩별 · 내가 맡은 것", () => {
    const [n] = planBagNotifications([b], { b1: { ddayOffsets: [1] } }, NOW, {}, "me");
    expect(n.title).toBe("제주 여행");
    expect(n.body).toBe("D-1 · 3개 남았어요 (옷 1 · 서류 2) · 내가 맡은 것: 여권, 충전기");
    expect(n.packId).toBeUndefined();
    expect(n.at).toEqual(new Date(2026, 10, 19, 9, 0));
  });

  it("다 챙기면 다 챙겼어요 · 당일 문구", () => {
    const done = bag([pack("p1", "옷", [item("i1", "티셔츠", { checked: true })])]);
    const plan = planBagNotifications([done], { b1: { ddayOffsets: [3, 0] } }, NOW);
    expect(plan.map((p) => p.body)).toEqual(["D-3 · 다 챙겼어요", "오늘 출발 · 다 챙겼어요. 그대로 출발하세요"]);
  });

  it("잠근 가방은 제목 · 이름을 가린다", () => {
    const [n] = planBagNotifications([b], { b1: { ddayOffsets: [1] } }, NOW, { bagIds: ["b1"] }, "me");
    expect(n.title).toBe("잠근 가방");
    expect(n.body).toBe("D-1 · 3개 남았어요 · 내가 맡은 것 2개");
  });
});

describe("NAT-NOTI 팩 알림", () => {
  const b = bag([pack("p1", "외출팩", [item("i1", "기저귀"), item("i2", "물티슈"), item("i3", "손수건")]), pack("p2", "옷", [item("i4", "양말")])]);

  it("반복: 그 팩만, 누르면 그 팩", () => {
    const plan = planBagNotifications([b], { b1: { packs: { p1: { repeatDays: [3], repeatTime: "07:30" } } } }, NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      packId: "p1",
      title: "제주 여행 · 외출팩",
      body: "챙길 시간이에요 · 3개 남았어요: 기저귀, 물티슈 외 1개",
      weekly: { weekday: 3, hour: 7, minute: 30 },
    });
  });

  it("같은 시각의 가방 알림에서는 그 팩을 뺀다", () => {
    const plan = planBagNotifications([b], { b1: { ddayOffsets: [2], packs: { p1: { ddayOffsets: [2] } } } }, NOW);
    const bagOne = plan.find((p) => !p.packId)!;
    expect(bagOne.body).toBe("D-2 · 1개 남았어요 (옷 1)");
  });

  it("사라진 팩은 건너뛴다", () => {
    expect(planBagNotifications([b], { b1: { packs: { gone: { repeatDays: [1] } } } }, NOW)).toEqual([]);
  });
});

describe("NAT-NOTI 아이템 마감", () => {
  const b = bag([
    pack("p1", "서류", [
      item("i1", "여권 사본 출력", { dueDate: "2026-11-18" }),
      item("i2", "환전", { dueDate: "2026-11-18", assigneeUid: "other" }),
      item("i3", "유심", { dueDate: "2026-11-18", checked: true }),
    ]),
  ]);

  it("설정이 없으면 전날 · 당일 09:00, 남이 맡은 것 · 체크한 것은 뺀다", () => {
    const plan = planBagNotifications([b], undefined, NOW, {}, "me");
    expect(plan.map((p) => [p.body, p.itemId, p.at])).toEqual([
      ["내일까지: 여권 사본 출력", "i1", new Date(2026, 10, 17, 9, 0)],
      ["오늘까지: 여권 사본 출력", "i1", new Date(2026, 10, 18, 9, 0)],
    ]);
    expect(plan[0].title).toBe("제주 여행 · 서류");
  });

  it("같은 시각 여러 개는 하나로 묶는다", () => {
    const two = bag([
      pack("p1", "서류", [item("i1", "여권 사본 출력", { dueDate: "2026-11-18" })]),
      pack("p2", "준비", [item("i2", "환전", { dueDate: "2026-11-18" }), item("i3", "유심 주문", { dueDate: "2026-11-18" })]),
    ]);
    const plan = planBagNotifications([two], { b1: { itemDue: { offsets: [0] } } }, NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ title: "제주 여행", body: "오늘까지 3개: 여권 사본 출력, 환전 외 1개", packId: undefined, itemId: undefined });
  });

  it("끄면(빈 배열) 안 울린다", () => {
    expect(planBagNotifications([b], { b1: { itemDue: { offsets: [] } } }, NOW)).toEqual([]);
  });
});

describe("NAT-NOTI 저장 정리", () => {
  it("기본값 · 빈 팩 · 사라진 팩은 저장하지 않는다", () => {
    expect(
      normalizeReminder({ itemDue: { offsets: [0, 1], time: "09:00" }, packs: { p1: {}, gone: { repeatDays: [1] } } }, ["p1"]),
    ).toBeNull();
    expect(normalizeReminder({ itemDue: { offsets: [] } }, [])).toEqual({ itemDue: { offsets: [], time: "09:00" } });
    expect(normalizeReminder({ packs: { p1: { repeatDays: [2, 1] } } }, ["p1"])).toEqual({
      packs: { p1: { repeatDays: [1, 2], repeatTime: "07:30" } },
    });
  });

  it("비었는지 · 요약", () => {
    expect(isReminderEmpty({ packs: { p1: { ddayOffsets: [1] } } })).toBe(false);
    const b = bag([pack("p1", "옷", [item("i1", "x", { dueDate: "2026-11-18" })])]);
    expect(reminderSummary({ ddayOffsets: [1], packs: { p1: { repeatDays: [1, 2, 3, 4, 5] } } }, true, b)).toBe("출발 전날 09:00 · 팩 1개 · 마감");
  });
});
