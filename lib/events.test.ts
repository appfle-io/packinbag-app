import { describe, expect, it } from "vitest";
import { eventEyebrow, eventLinks, eventPeriodLabel, eventStatus, hasUnseenEvent, isSafeEventLink, linkHost, localDateKey, splitEvents, type AppEvent } from "./events";

const ev = (id: string, startDate: string, endDate: string, extra: Partial<AppEvent> = {}): AppEvent => ({
  id,
  title: id,
  summary: "",
  startDate,
  endDate,
  bodyType: "html",
  published: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...extra,
});

describe("eventStatus", () => {
  it("시작일 · 끝나는 날을 모두 포함한다", () => {
    expect(eventStatus(ev("a", "2026-11-01", "2026-11-30"), "2026-11-01")).toBe("active");
    expect(eventStatus(ev("a", "2026-11-01", "2026-11-30"), "2026-11-30")).toBe("active");
    expect(eventStatus(ev("a", "2026-11-01", "2026-11-30"), "2026-10-31")).toBe("upcoming");
    expect(eventStatus(ev("a", "2026-11-01", "2026-11-30"), "2026-12-01")).toBe("ended");
  });
  it("게시하지 않으면 날짜와 상관없이 숨김", () => {
    expect(eventStatus(ev("a", "2026-11-01", "2026-11-30", { published: false }), "2026-11-10")).toBe("hidden");
  });
  it("끝나는 날이 없으면 시작 뒤로 계속 진행 중(EVT-DATA-04)", () => {
    expect(eventStatus(ev("a", "2026-10-20", ""), "2030-01-01")).toBe("active");
    expect(eventStatus(ev("a", "2026-10-20", ""), "2026-10-19")).toBe("upcoming");
  });
});

describe("splitEvents", () => {
  it("진행 중은 시작이 늦은 것 먼저, 지난 것은 끝난 날이 늦은 것 먼저, 예정 · 숨김은 뺀다", () => {
    const list = [
      ev("old", "2026-09-01", "2026-09-10"),
      ev("recent-ended", "2026-10-01", "2026-10-15"),
      ev("a1", "2026-10-10", "2026-10-31"),
      ev("a2", "2026-10-18", "2026-10-25"),
      ev("future", "2026-11-01", "2026-11-30"),
      ev("hidden", "2026-10-01", "2026-10-31", { published: false }),
    ];
    const { active, ended } = splitEvents(list, "2026-10-19");
    expect(active.map((e) => e.id)).toEqual(["a2", "a1"]);
    expect(ended.map((e) => e.id)).toEqual(["recent-ended", "old"]);
  });
});

describe("labels", () => {
  it("기간 표기(올해는 연도 없이, 요일 포함)", () => {
    expect(eventPeriodLabel(ev("a", "2026-11-01", "2026-11-30"), "2026-10-19")).toBe("11월 1일(일) ~ 11월 30일(월)");
    expect(eventPeriodLabel(ev("a", "2026-12-20", "2027-01-05"), "2026-10-19")).toBe("2026년 12월 20일(일) ~ 2027년 1월 5일(화)");
  });
  it("홈 카드 작은 줄", () => {
    expect(eventEyebrow(ev("a", "2026-10-01", "2026-10-31"), "2026-10-19")).toBe("이벤트 · 10월 31일까지");
    expect(eventEyebrow(ev("a", "2026-10-01", "2026-10-19"), "2026-10-19")).toBe("이벤트 · 오늘까지");
  });
  it("끝나는 날이 없을 때 표기", () => {
    expect(eventPeriodLabel(ev("a", "2026-10-20", ""), "2026-10-20")).toBe("10월 20일(화)부터");
    expect(eventPeriodLabel(ev("a", "2026-10-20", ""), "2027-02-01")).toBe("2026년 10월 20일(화)부터");
    expect(eventEyebrow(ev("a", "2026-10-20", ""), "2026-10-20")).toBe("이벤트 · 진행 중");
  });
  it("localDateKey는 기기 날짜", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("isSafeEventLink", () => {
  it("앱 경로와 https만", () => {
    expect(isSafeEventLink("/?new=bag")).toBe(true);
    expect(isSafeEventLink("https://packinbag.seeuson.com/about")).toBe(true);
    expect(isSafeEventLink("//evil.com")).toBe(false);
    expect(isSafeEventLink("http://a.com")).toBe(false);
    expect(isSafeEventLink("javascript:alert(1)")).toBe(false);
    expect(isSafeEventLink(undefined)).toBe(false);
  });
});

describe("eventLinks", () => {
  it("links가 있으면 그것, 안전하지 않은 주소는 뺀다(EVT-VIEW-07)", () => {
    const e = ev("a", "2026-10-20", "", {
      links: [
        { label: "예스24", url: "https://www.yes24.com/x" },
        { label: "나쁜 곳", url: "javascript:alert(1)" },
        { label: "", url: "https://product.kyobobook.co.kr/y" },
      ],
    });
    expect(eventLinks(e)).toEqual([
      { label: "예스24", url: "https://www.yes24.com/x" },
      { label: "product.kyobobook.co.kr", url: "https://product.kyobobook.co.kr/y" },
    ]);
  });
  it("예전 buttonUrl 하나는 링크 1개(이름 = 도메인)", () => {
    expect(eventLinks(ev("a", "2026-10-20", "", { buttonUrl: "https://www.yes24.com/x" }))).toEqual([{ label: "yes24.com", url: "https://www.yes24.com/x" }]);
    expect(eventLinks(ev("a", "2026-10-20", ""))).toEqual([]);
  });
  it("linkHost", () => {
    expect(linkHost("https://www.yes24.com/a")).toBe("yes24.com");
    expect(linkHost("/?new=bag")).toBe("");
  });
});

describe("hasUnseenEvent", () => {
  it("진행 중 이벤트 중 안 본 게 있으면 true", () => {
    const active = [ev("a", "2026-10-01", "2026-10-31"), ev("b", "2026-10-01", "2026-10-31")];
    expect(hasUnseenEvent(active, ["a"])).toBe(true);
    expect(hasUnseenEvent(active, ["a", "b"])).toBe(false);
    expect(hasUnseenEvent([], [])).toBe(false);
  });
});
