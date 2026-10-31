import { describe, expect, it, vi } from "vitest";

// 위젯 꾸미기 사진 업로드 때문에 Firebase를 부르는 파일이라, 문구 함수만 보려고 막아 둔다
vi.mock("@/lib/firebase", () => ({ storage: {} }));
vi.mock("firebase/storage", () => ({}));

import { ddayText, newWidgetStyle, normalizeWidgetStyle, wallpaperState, widgetBagStats, widgetMetaLine } from "./widgetStyles";

// 2026-11-10(화) 12:00
const NOW = new Date(2026, 10, 10, 12, 0);

describe("NAT-BMK-03 위젯 D-Day 글자(iOS PIBShared pibDDayLabel과 같음)", () => {
  it("앞 · 당일 · 지남", () => {
    expect(ddayText("2026-11-13", NOW)).toBe("D-3");
    expect(ddayText("2026-11-10", NOW)).toBe("D-Day");
    expect(ddayText("2026-11-08", NOW)).toBe("D+2");
  });

  it("당일을 1일로 세기: 당일부터 D+1, 앞은 그대로", () => {
    expect(ddayText("2026-11-13", NOW, true)).toBe("D-3");
    expect(ddayText("2026-11-10", NOW, true)).toBe("D+1");
    expect(ddayText("2026-11-08", NOW, true)).toBe("D+3");
  });

  it("날짜가 없거나 이상하면 null", () => {
    expect(ddayText(undefined, NOW)).toBeNull();
    expect(ddayText("11/13", NOW)).toBeNull();
  });
});

describe("NAT-BMK-03 위젯 가방 정보 한 줄", () => {
  const bag = {
    name: "어린이집 등원 가방",
    travelDate: "2026-11-10",
    ddayCountTodayAsDayOne: true,
    lastPackedAt: new Date(2026, 10, 9, 20, 0).toISOString(),
    packs: [
      { items: [{ checked: true }, { checked: false }, { type: "text", checked: false }] },
      { kind: "editor", items: [{ checked: false }] },
      { type: "folder", items: [{ checked: false }] },
    ],
  };

  it("체크리스트 팩의 체크 아이템만 센다(메모 · 폴더 · 글 아이템 빼고), 당일 1일 반영", () => {
    expect(widgetBagStats(bag, NOW)).toEqual({ name: "어린이집 등원 가방", dday: "D+1", done: 1, total: 2, packed: "어제 다 쌌어요" });
  });

  it("보여 줄 정보만 이어 붙인다", () => {
    const stats = widgetBagStats(bag, NOW);
    expect(widgetMetaLine(stats, { dday: true, progress: true, left: true, packed: true } as never)).toBe("1/2 챙김 · 남은 1개 · 어제 다 쌌어요");
    expect(widgetMetaLine({ ...stats, done: 2 }, { left: true } as never)).toBe("다 챙겼어요");
  });
});

describe("배경화면 바탕(2026-10-31)", () => {
  const rect = { x: 0.1, y: 0.2, w: 0.4, h: 0.18, sw: 1206, sh: 2622 };

  it("자리를 안 쟀으면 분홍 자리 표시", () => {
    const s = normalizeWidgetStyle({ ...newWidgetStyle(), bg: "solid", color: "#2E5E4E", wallpaper: {} }, true);
    expect(wallpaperState(s)).toBe("marking");
    expect(s.color).toBe("#FF00FF");
  });

  it("맞춘 사진은 크기 · 위치를 고정", () => {
    const s = normalizeWidgetStyle({ ...newWidgetStyle(), bg: "photo", photoUrl: "u", zoom: 2, x: 10, wallpaper: rect }, true);
    expect(wallpaperState(s)).toBe("fitted");
    expect([s.zoom, s.x, s.y]).toEqual([1, 0, 0]);
  });

  it("다른 배경이나 무료면 배경화면 값을 뗀다", () => {
    expect(normalizeWidgetStyle({ ...newWidgetStyle(), bg: "plain", wallpaper: rect }, true).wallpaper).toBeUndefined();
    expect(normalizeWidgetStyle({ ...newWidgetStyle(), bg: "photo", photoUrl: "u", wallpaper: rect }, false).wallpaper).toBeUndefined();
    expect(normalizeWidgetStyle({ ...newWidgetStyle(), bg: "photo", photoUrl: "u", wallpaper: { ...rect, sw: 0 } }, true).wallpaper).toBeUndefined();
  });
});
