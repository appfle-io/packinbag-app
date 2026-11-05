import { describe, expect, it } from "vitest";
import { mergeEditorDocs } from "@/lib/syncMerge";

const P = (t: string) => ({ type: "paragraph", ...(t ? { content: [{ type: "text", text: t }] } : {}) });
const D = (...lines: string[]) => ({ type: "doc", content: lines.map(P) });
const lines = (d: object | undefined) =>
  ((d as { content: { content?: { text: string }[] }[] }).content ?? []).map((b) => (b.content ?? []).map((n) => n.text).join(""));

describe("mergeEditorDocs", () => {
  it("서로 다른 문단은 둘 다 산다", () => {
    expect(lines(mergeEditorDocs(D("가", "나"), D("가1", "나"), D("가", "나2")))).toEqual(["가1", "나2"]);
  });

  it("같은 문단의 다른 곳을 고치면 글자 단위로 합쳐져 줄이 늘지 않는다", () => {
    expect(lines(mergeEditorDocs(D("오늘 장보기"), D("오늘 저녁 장보기"), D("오늘 장보기 목록")))).toEqual(["오늘 저녁 장보기 목록"]);
  });

  it("같은 자리에 다르게 치면 둘 다 남는다(한쪽이 씹히지 않음)", () => {
    expect(lines(mergeEditorDocs(D("메모"), D("메모A"), D("메모B")))).toEqual(["메모AB"]);
  });

  it("같은 글자가 반복돼도 상대 글자가 사라지지 않는다", () => {
    expect(lines(mergeEditorDocs(D(""), D("11"), D("12")))).toEqual(["1112"]);
  });

  it("내가 지운 문단을 상대가 고쳤으면 상대 글이 남는다", () => {
    expect(lines(mergeEditorDocs(D("가", "나"), D("가"), D("가", "나나")))).toEqual(["가", "나나"]);
  });

  it("체크 목록 안 항목도 안쪽까지 합친다", () => {
    const item = (t: string, checked = false) => ({
      type: "taskItem",
      attrs: { checked },
      content: [P(t)],
    });
    const list = (...items: object[]) => ({ type: "doc", content: [{ type: "taskList", content: items }] });
    const merged = mergeEditorDocs(list(item("우유"), item("빵")), list(item("우유", true), item("빵")), list(item("우유"), item("빵 2개"))) as {
      content: { content: { attrs: { checked: boolean }; content: { content: { text: string }[] }[] }[] }[];
    };
    const items = merged.content[0].content;
    expect(items[0].attrs.checked).toBe(true);
    expect(items[1].content[0].content[0].text).toBe("빵 2개");
  });

  it("글자 서식이 그대로 유지된다", () => {
    const bold = (t: string, rest: string) => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: t }, { type: "text", text: rest }] }],
    });
    const merged = mergeEditorDocs(bold("굵게", " 보통"), bold("굵게!", " 보통"), bold("굵게", " 보통?"));
    expect(merged).toEqual(bold("굵게!", " 보통?"));
  });
});
