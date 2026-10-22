import { describe, expect, it } from "vitest";
import { isBlockedAppInternalUrl } from "./linkSafety";

// MEMO-LINK-12: Capacitor 내부 경로 링크는 열지 않음(2026-10-22)
describe("isBlockedAppInternalUrl", () => {
  it("일반 링크는 통과", () => {
    expect(isBlockedAppInternalUrl("https://www.yes24.com/Product/Goods/1")).toBe(false);
    expect(isBlockedAppInternalUrl("packinbag.seeuson.com/c/우리집")).toBe(false);
    expect(isBlockedAppInternalUrl("")).toBe(false);
  });
  it("내부 프록시 경로는 막음", () => {
    expect(isBlockedAppInternalUrl("https://packinbag.seeuson.com/_capacitor_http_interceptor_?u=https://x.y")).toBe(true);
    expect(isBlockedAppInternalUrl("/_capacitor_http_interceptor_")).toBe(true);
    expect(isBlockedAppInternalUrl("capacitor://localhost/_capacitor_file_/a")).toBe(true);
  });
  it("대소문자 · % 인코딩으로 숨겨도 막음", () => {
    expect(isBlockedAppInternalUrl("https://a.b/_CAPACITOR_HTTP_INTERCEPTOR_")).toBe(true);
    expect(isBlockedAppInternalUrl("https://a.b/%5Fcapacitor%5Fhttp_interceptor_")).toBe(true);
  });
  it("잘못된 % 인코딩이어도 오류 없이 판단", () => {
    expect(isBlockedAppInternalUrl("https://a.b/%E0%A4%A")).toBe(false);
    expect(isBlockedAppInternalUrl("https://a.b/_capacitor_%E0%A4%A")).toBe(true);
  });
});
