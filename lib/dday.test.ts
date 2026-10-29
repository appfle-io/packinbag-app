import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysUntil, formatDDayLabel } from "./dday";

// 2026-11-10(화) 12:00
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0));
});
afterEach(() => vi.useRealTimers());

describe("BAG-MORE-02a · HOME-SUM-04 D-Day 배지", () => {
  it("남은 날: 기기 날짜 기준(오늘 0, 지나면 음수)", () => {
    expect(daysUntil("2026-11-13")).toBe(3);
    expect(daysUntil("2026-11-10")).toBe(0);
    expect(daysUntil("2026-11-08")).toBe(-2);
  });

  it("기본: D-N · D-DAY · 다음 날부터 D+1", () => {
    expect(formatDDayLabel("2026-11-13")).toBe("D-3");
    expect(formatDDayLabel("2026-11-10")).toBe("D-DAY");
    expect(formatDDayLabel("2026-11-09")).toBe("D+1");
  });

  it("당일을 1일로 세기: 당일 D+1, 다음 날 D+2", () => {
    expect(formatDDayLabel("2026-11-13", true)).toBe("D-3");
    expect(formatDDayLabel("2026-11-10", true)).toBe("D+1");
    expect(formatDDayLabel("2026-11-09", true)).toBe("D+2");
  });

  it("날짜가 없으면 null", () => {
    expect(formatDDayLabel(undefined)).toBeNull();
  });
});
