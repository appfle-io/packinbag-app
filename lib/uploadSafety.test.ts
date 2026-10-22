import { describe, expect, it } from "vitest";
import { isBlockedUploadFile } from "./uploadSafety";

// MEMO-ATT-11 · BAG-ATT-11: HTML · SVG · XML 첨부 막기(2026-10-22)
describe("isBlockedUploadFile", () => {
  it("사진 · PDF · 문서는 통과", () => {
    expect(isBlockedUploadFile({ name: "a.jpg", type: "image/jpeg" })).toBe(false);
    expect(isBlockedUploadFile({ name: "여행.pdf", type: "application/pdf" })).toBe(false);
    expect(isBlockedUploadFile({ name: "list.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })).toBe(false);
    expect(isBlockedUploadFile({ name: "memo.txt", type: "text/plain" })).toBe(false);
  });
  it("HTML · SVG · XML 형식은 막음", () => {
    expect(isBlockedUploadFile({ name: "x", type: "text/html" })).toBe(true);
    expect(isBlockedUploadFile({ name: "x", type: "text/html; charset=utf-8" })).toBe(true);
    expect(isBlockedUploadFile({ name: "x", type: "image/svg+xml" })).toBe(true);
    expect(isBlockedUploadFile({ name: "x", type: "application/xhtml+xml" })).toBe(true);
    expect(isBlockedUploadFile({ name: "x", type: "TEXT/XML" })).toBe(true);
  });
  it("형식이 비어도 확장자로 막음", () => {
    expect(isBlockedUploadFile({ name: "page.HTML", type: "" })).toBe(true);
    expect(isBlockedUploadFile({ name: "logo.svg", type: "" })).toBe(true);
    expect(isBlockedUploadFile({ name: "saved.mhtml", type: "" })).toBe(true);
    expect(isBlockedUploadFile({ name: "html-guide.pdf", type: "" })).toBe(false);
  });
});
