import { describe, expect, it } from "vitest";
import { reorderSubset } from "./packOrder";

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const L = (...xs: string[]) => xs.map((id) => ({ id }));

describe("reorderSubset", () => {
  it("보인 팩만 그 자리들 안에서 바꾼다", () => {
    expect(ids(reorderSubset(L("inbox", "a", "folder", "b", "c"), ["c", "a", "b"]))).toEqual(["inbox", "c", "folder", "a", "b"]);
  });

  it("시트를 연 뒤 생긴 팩은 제자리, 사라진 팩은 무시", () => {
    expect(ids(reorderSubset(L("new", "a", "c"), ["c", "b", "a"]))).toEqual(["new", "c", "a"]);
  });

  it("같은 순서면 그대로", () => {
    const list = L("a", "b");
    expect(ids(reorderSubset(list, ["a", "b"]))).toEqual(["a", "b"]);
  });

  it("중복 id는 한 번만", () => {
    expect(ids(reorderSubset(L("a", "b"), ["b", "b", "a"]))).toEqual(["b", "a"]);
  });
});
