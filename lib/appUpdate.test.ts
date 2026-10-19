import { describe, expect, it } from "vitest";
import { compareVersions, decideUpdate } from "./appUpdate";

describe("compareVersions", () => {
  it("자리 수가 달라도 숫자로 비교한다", () => {
    expect(compareVersions("1.7", "1.6")).toBeGreaterThan(0);
    expect(compareVersions("1.7", "1.7.0")).toBe(0);
    expect(compareVersions("1.10", "1.9")).toBeGreaterThan(0);
    expect(compareVersions("1.6.4", "1.7")).toBeLessThan(0);
  });
});

describe("decideUpdate (SET-VER-05)", () => {
  const base = { clientBuild: "a", serverBuild: "a", nativeVersion: null, storeVersion: "1.7" };

  it("웹: 빌드가 같으면 최신, 다르면 다시 불러오기", () => {
    expect(decideUpdate(base)).toBe("latest");
    expect(decideUpdate({ ...base, serverBuild: "b" })).toBe("web");
  });

  it("웹은 App Store 버전을 보지 않는다", () => {
    expect(decideUpdate({ ...base, storeVersion: "9.9" })).toBe("latest");
  });

  it("앱: 스토어가 더 새것이면 웹 배포와 상관없이 App Store", () => {
    expect(decideUpdate({ ...base, nativeVersion: "1.6" })).toBe("store");
    expect(decideUpdate({ ...base, nativeVersion: "1.6", serverBuild: "b" })).toBe("store");
  });

  it("앱: 스토어와 같거나 더 높으면(심사 전 빌드) 웹만 본다", () => {
    expect(decideUpdate({ ...base, nativeVersion: "1.7", serverBuild: "b" })).toBe("web");
    expect(decideUpdate({ ...base, nativeVersion: "1.8" })).toBe("latest");
  });

  it("스토어 버전 · 서버 빌드를 모르면 그 비교는 건너뛴다", () => {
    expect(decideUpdate({ ...base, nativeVersion: "1.6", storeVersion: null })).toBe("latest");
    expect(decideUpdate({ ...base, serverBuild: null })).toBe("latest");
  });
});
