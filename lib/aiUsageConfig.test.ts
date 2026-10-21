import { describe, expect, it } from "vitest";
import { thisWeekKstKey } from "./aiUsageConfig";

// PREM-LIM-08: 무료 AI는 한국 시간 월요일 0시에 새 주(2026-10-21)
describe("thisWeekKstKey", () => {
  it("수요일은 그 주 월요일", () => {
    expect(thisWeekKstKey(new Date("2026-10-21T03:00:00Z"))).toBe("W2026-10-19");
  });
  it("일요일 밤(KST 23:59)은 아직 지난주", () => {
    expect(thisWeekKstKey(new Date("2026-10-18T14:59:00Z"))).toBe("W2026-10-12");
  });
  it("월요일 0시(KST)부터 새 주", () => {
    expect(thisWeekKstKey(new Date("2026-10-18T15:00:00Z"))).toBe("W2026-10-19");
  });
  it("해를 넘기는 주", () => {
    expect(thisWeekKstKey(new Date("2026-01-01T00:00:00Z"))).toBe("W2025-12-29");
  });
});
