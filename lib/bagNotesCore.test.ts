import { describe, expect, it } from "vitest";
import type { Bag, Pack } from "@/lib/types";
import {
  NOTE_SEARCH_TEXT_MAX,
  hydrateBag,
  noteSummary,
  parseNoteData,
  rawOf,
  splitBagForSave,
  splitPacksPlain,
  type BagNote,
} from "@/lib/bagNotesCore";

// _secrets/docs/spec/memo.md MEMO-NOTE, bag.md BAG-SAVE-07 ~ 10: 가방 안 메모 본문 분리

const doc = (...paragraphs: string[]) => ({
  type: "doc",
  content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});
const image = (src: string) => ({ type: "imageAttachment", attrs: { src } });

// 테스트에 필요한 필드만 채운다
const memo = (id: string, extra: Record<string, unknown> = {}) => ({ id, kind: "editor", name: id, items: [], ...extra }) as unknown as Pack;
const checklist = (id: string) => ({ id, name: id, items: [] }) as unknown as Pack;
const bagOf = (...packs: Pack[]) => ({ id: "bag-1", name: "가방", packs }) as unknown as Bag;
const note = (d: object | undefined): BagNote => ({ doc: d, raw: rawOf(d), rev: 1 });

describe("noteSummary", () => {
  it("MEMO-NOTE-01 미리보기 · 검색용 글 · 첨부 주소를 만든다", () => {
    const d = { type: "doc", content: [...doc("첫 문단", "둘째 문단").content, image("https://x/a.png")] };
    const s = noteSummary(memo("m1", { images: ["https://x/old.png", "https://x/a.png"] }), d);
    expect(s.editorPreviewText).toBe("첫 문단 둘째 문단");
    expect(s.searchText).toBe("첫 문단 둘째 문단");
    expect(s.attachmentUrls).toEqual(["https://x/old.png", "https://x/a.png"]); // 겹치는 주소는 하나만
  });

  it("MEMO-NOTE-01 검색용 글은 앞 2,000자까지", () => {
    const s = noteSummary(memo("m1"), doc("가".repeat(NOTE_SEARCH_TEXT_MAX + 500)));
    expect(s.searchText).toHaveLength(NOTE_SEARCH_TEXT_MAX);
  });

  it("MEMO-NOTE-01 본문이 없으면 예전 미리보기를 그대로 둔다", () => {
    const s = noteSummary(memo("m1", { editorPreviewText: "예전 미리보기" }), undefined);
    expect(s.editorPreviewText).toBe("예전 미리보기");
    expect(s.searchText).toBe("");
  });
});

describe("splitBagForSave", () => {
  it("MEMO-NOTE-01 가방 문서에서는 본문을 떼고 요약 + noteSeparated만 남긴다", () => {
    const { stripped } = splitBagForSave(bagOf(memo("m1", { editorDoc: doc("안녕") }), checklist("c1")), null);
    const [m, c] = stripped.packs as unknown as Record<string, unknown>[];
    expect(m).not.toHaveProperty("editorDoc");
    expect(m).toMatchObject({ noteSeparated: true, editorPreviewText: "안녕", searchText: "안녕" });
    expect(c).toEqual(checklist("c1")); // 체크리스트 팩은 그대로
  });

  it("MEMO-NOTE-02 서버 본문을 모르면(known=null) 본문이 붙은 메모는 모두 쓰고, 지우지는 않는다", () => {
    const { noteWrites, noteDeletes } = splitBagForSave(
      bagOf(memo("m1", { editorDoc: doc("a") }), memo("m2", { editorDoc: doc("b") })),
      null,
    );
    expect(noteWrites.map((w) => w.packId)).toEqual(["m1", "m2"]);
    expect(noteDeletes).toEqual([]);
  });

  it("MEMO-NOTE-02 바뀐 본문만 쓴다", () => {
    const known = new Map([
      ["m1", rawOf(doc("그대로"))],
      ["m2", rawOf(doc("예전"))],
    ]);
    const { noteWrites } = splitBagForSave(
      bagOf(memo("m1", { editorDoc: doc("그대로") }), memo("m2", { editorDoc: doc("새 글") })),
      known,
    );
    expect(noteWrites).toEqual([{ packId: "m2", raw: rawOf(doc("새 글")) }]);
  });

  it("MEMO-NOTE-02 알던 메모가 가방에서 사라졌으면 그 notes를 지운다", () => {
    const known = new Map([
      ["m1", rawOf(doc("a"))],
      ["gone", rawOf(doc("b"))],
    ]);
    const { noteDeletes } = splitBagForSave(bagOf(memo("m1", { editorDoc: doc("a") })), known);
    expect(noteDeletes).toEqual(["gone"]);
  });

  it("MEMO-NOTE-03 본문이 아직 안 붙은 메모(도착 전)는 쓰지도 지우지도 않고 요약을 그대로 둔다", () => {
    const before = memo("m1", { editorPreviewText: "요약", noteSeparated: true });
    const known = new Map([["m1", rawOf(doc("서버 본문"))]]);
    const { stripped, noteWrites, noteDeletes } = splitBagForSave(bagOf(before), known);
    expect(stripped.packs[0]).toBe(before);
    expect(noteWrites).toEqual([]);
    expect(noteDeletes).toEqual([]);
  });
});

describe("hydrateBag", () => {
  it("MEMO-SYNC-02 notes의 본문을 메모팩에 채운다", () => {
    const bag = bagOf(memo("m1"), checklist("c1"));
    const out = hydrateBag(bag, new Map([["m1", note(doc("본문"))]]));
    expect(out.packs[0].editorDoc).toEqual(doc("본문"));
    expect(out.packs[1]).toBe(bag.packs[1]);
  });

  it("MEMO-SYNC-06 이미 같은 본문이면 가방 객체를 그대로 돌려준다(다시 그리지 않게)", () => {
    const bag = bagOf(memo("m1", { editorDoc: doc("본문") }));
    expect(hydrateBag(bag, new Map([["m1", note(doc("본문"))]]))).toBe(bag);
  });

  it("MEMO-SYNC-02 notes가 없거나 비었으면 그대로", () => {
    const bag = bagOf(memo("m1"));
    expect(hydrateBag(bag, null)).toBe(bag);
    expect(hydrateBag(bag, new Map())).toBe(bag);
  });
});

describe("splitPacksPlain", () => {
  it("MEMO-NOTE-05 본문이 JSON 문자열이어도 떼어 낸다", () => {
    const { packs, notes } = splitPacksPlain([memo("m1", { editorDoc: JSON.stringify(doc("문자열 본문")) }), checklist("c1")]);
    expect(notes).toEqual([{ packId: "m1", raw: rawOf(doc("문자열 본문")) }]);
    expect(packs[0]).not.toHaveProperty("editorDoc");
    expect(packs[0]).toMatchObject({ noteSeparated: true, searchText: "문자열 본문" });
  });

  it("MEMO-NOTE-05 본문이 없거나 깨진 문자열이면 그 팩은 그대로", () => {
    const empty = memo("m1");
    const broken = memo("m2", { editorDoc: "{깨짐" });
    const { packs, notes } = splitPacksPlain([empty, broken]);
    expect(packs).toEqual([empty, broken]);
    expect(notes).toEqual([]);
  });
});

describe("parseNoteData", () => {
  it("MEMO-NOTE-05 notes 문서를 읽는다(문자열 · 객체 · 깨진 값)", () => {
    expect(parseNoteData({ doc: JSON.stringify(doc("a")), rev: 3 })).toMatchObject({ doc: doc("a"), rev: 3 });
    expect(parseNoteData({ doc: doc("b") })).toMatchObject({ doc: doc("b"), rev: 0 });
    expect(parseNoteData({ doc: "{깨짐" }).doc).toBeUndefined();
  });
});
