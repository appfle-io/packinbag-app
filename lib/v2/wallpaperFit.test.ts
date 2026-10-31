import { describe, expect, it } from "vitest";
import { defaultVeil, iosMajor, sameScreen, unveil, widgetSlotLayouts } from "./wallpaperFit";

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
    const l = widgetSlotLayouts(1206, 2622);
    expect(l?.map((x) => x.key)).toEqual(["text", "notext"]);
    expect(l?.[0].slots.map((s) => s.key)).toEqual(["tl", "tr", "ml", "mr", "bl", "br"]);
    expect(l?.[0].slots[1].wallpaper).toEqual({ x: 0.5249, y: 0.0995, w: 0.403, h: 0.1854, sw: 1206, sh: 2622 });
  });

  it("모르는 기종 · 가로 · 폭이 안 맞으면 null", () => {
    expect(widgetSlotLayouts(1000, 2000)).toBeNull();
    expect(widgetSlotLayouts(2622, 1206)).toBeNull();
    expect(widgetSlotLayouts(600, 2622)).toBeNull();
  });
});

describe("iOS 26+ 배치 · 밝기 맞추기", () => {
  it("iOS 27이면 잰 값(2622)만, 모르는 기종은 null", () => {
    const l = widgetSlotLayouts(1206, 2622, 27);
    expect(l?.[0].slots[1].wallpaper).toMatchObject({ x: 0.524, y: 0.103, w: 0.4221 });
    expect(widgetSlotLayouts(1179, 2556, 26)).toBeNull();
    expect(widgetSlotLayouts(1179, 2556, 18)).not.toBeNull();
  });

  it("UA에서 iOS 버전 · 기본 밝기", () => {
    expect(iosMajor("Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)")).toBe(27);
    expect(iosMajor("Mozilla/5.0 (Macintosh)")).toBeNull();
    expect(defaultVeil(27)).toBe(8);
    expect(defaultVeil(18)).toBe(0);
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
