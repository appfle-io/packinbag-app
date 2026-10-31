import { describe, expect, it } from "vitest";
import { defaultVeil, sameScreen, unveil, widgetSlotLayouts } from "./wallpaperFit";

describe("sameScreen", () => {
  it("같은 크기만 같은 화면", () => {
    const wp = { x: 0, y: 0, w: 0.4, h: 0.2, sw: 1206, sh: 2622 };
    expect(sameScreen(wp, 1206, 2622)).toBe(true);
    expect(sameScreen(wp, 1170, 2532)).toBe(false);
    expect(sameScreen(wp, 2622, 1206)).toBe(false);
  });
});

describe("widgetSlotLayouts", () => {
  it("16 Pro(1206×2622): 앱 이름 보임 · 숨김 두 가지, 6칸", () => {
    const l = widgetSlotLayouts(1206, 2622, false);
    expect(l?.map((x) => x.key)).toEqual(["text", "notext"]);
    expect(l?.[0].slots.map((s) => s.key)).toEqual(["tl", "tr", "ml", "mr", "bl", "br"]);
    expect(l?.[0].slots[1].wallpaper).toEqual({ x: 0.5249, y: 0.0995, w: 0.403, h: 0.1854, sw: 1206, sh: 2622 });
  });

  it("모르는 기종 · 가로 · 폭이 안 맞으면 null", () => {
    expect(widgetSlotLayouts(1000, 2000, false)).toBeNull();
    expect(widgetSlotLayouts(2622, 1206, false)).toBeNull();
    expect(widgetSlotLayouts(600, 2622, false)).toBeNull();
  });
});

describe("iOS 26+ 배치 · 밝기 맞추기", () => {
  it("iOS 26+: 13 ~ 17 Pro Max 모든 화면 크기, 2622는 실측 값", () => {
    for (const [w, h] of [[1080, 2340], [1170, 2532], [1179, 2556], [1206, 2622], [1260, 2736], [1284, 2778], [1290, 2796], [1320, 2868]]) {
      const l = widgetSlotLayouts(w, h, true);
      expect(l?.[0].slots).toHaveLength(6);
      const tr = l![0].slots[1].wallpaper;
      // 오른쪽 열이 화면 안, 왼쪽 · 오른쪽 여백이 거의 같다
      const right = Math.round(((tr.x ?? 0) + (tr.w ?? 0)) * w);
      const left = Math.round((l![0].slots[0].wallpaper.x ?? 0) * w);
      expect(Math.abs(w - right - left)).toBeLessThanOrEqual(4);
    }
    expect(widgetSlotLayouts(1206, 2622, true)?.[0].slots[1].wallpaper).toMatchObject({ x: 0.524, y: 0.103, w: 0.4221 });
    expect(widgetSlotLayouts(1000, 2000, true)).toBeNull();
  });

  it("기본 밝기: iOS 26+ 8%, 그 전 0", () => {
    expect(defaultVeil(true)).toBe(8);
    expect(defaultVeil(false)).toBe(0);
  });

  it("unveil: 흰 유리 8%를 덮으면 원래 값", () => {
    for (const v of [40, 78, 116, 162, 230]) {
      const pre = unveil(v, 8);
      expect(Math.abs(pre * 0.92 + 255 * 0.08 - v)).toBeLessThanOrEqual(1);
    }
    expect(unveil(10, 8)).toBe(0);
    expect(unveil(100, 0)).toBe(100);
  });
});
