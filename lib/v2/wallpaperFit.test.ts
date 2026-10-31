import { describe, expect, it } from "vitest";
import { findMarkRect, sameScreen } from "./wallpaperFit";

// width×height 회색 화면에 분홍 칸들을 칠한다(text: 칸 안 가운데 줄을 흰 글자로 가림)
function screen(width: number, height: number, boxes: { x: number; y: number; w: number; h: number; text?: boolean }[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([90, 120, 140, 255], i);
  for (const b of boxes) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        const textRow = b.text && y > b.y + b.h * 0.6 && y < b.y + b.h * 0.75;
        data.set(textRow ? [255, 255, 255, 255] : [255, 0, 255, 255], (y * width + x) * 4);
      }
    }
  }
  return data;
}

describe("findMarkRect", () => {
  it("분홍 칸을 비율로 찾는다(글자가 조금 가려도)", () => {
    const r = findMarkRect(screen(100, 200, [{ x: 10, y: 20, w: 40, h: 40, text: true }]), 100, 200);
    expect(r).toEqual({ x: 0.1, y: 0.1, w: 0.4, h: 0.2, sw: 100, sh: 200 });
  });

  it("분홍이 없으면 null", () => {
    expect(findMarkRect(screen(50, 100, []), 50, 100)).toBeNull();
  });

  it("분홍 칸이 둘이면 null", () => {
    expect(findMarkRect(screen(100, 200, [{ x: 5, y: 10, w: 30, h: 30 }, { x: 60, y: 120, w: 30, h: 30 }]), 100, 200)).toBeNull();
  });

  it("너무 작거나 정사각형이 아니면 null", () => {
    expect(findMarkRect(screen(100, 200, [{ x: 5, y: 10, w: 5, h: 5 }]), 100, 200)).toBeNull();
    expect(findMarkRect(screen(100, 200, [{ x: 5, y: 10, w: 80, h: 30 }]), 100, 200)).toBeNull();
  });
});

describe("sameScreen", () => {
  it("같은 크기만 같은 화면", () => {
    const wp = { x: 0, y: 0, w: 0.4, h: 0.2, sw: 1206, sh: 2622 };
    expect(sameScreen(wp, 1206, 2622)).toBe(true);
    expect(sameScreen(wp, 1170, 2532)).toBe(false);
    expect(sameScreen(wp, 2622, 1206)).toBe(false);
  });
});
