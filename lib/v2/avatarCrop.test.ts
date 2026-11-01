import { describe, expect, it } from "vitest";
import { clampCrop, cropImageStyle, cropRect, initialCrop, panCrop, visibleAvatarUrl, zoomCrop } from "./avatarCrop";

const wide = { w: 2000, h: 1000 };

describe("SET-PROF-12 프로필 사진 자르기", () => {
  it("처음에는 가운데, 짧은 변이 틀에 꽉 참", () => {
    expect(cropRect(wide, initialCrop(wide))).toEqual({ sx: 500, sy: 0, side: 1000 });
  });

  it("끌어도 사진 밖이 보이지 않음", () => {
    const start = initialCrop(wide);
    expect(cropRect(wide, panCrop(wide, start, 10, 10))).toEqual({ sx: 0, sy: 0, side: 1000 });
    expect(cropRect(wide, panCrop(wide, start, -10, -10))).toEqual({ sx: 1000, sy: 0, side: 1000 });
  });

  it("손가락 방향으로 사진이 움직임(보는 자리는 반대)", () => {
    const moved = panCrop(wide, initialCrop(wide), 0.1, 0);
    expect(moved.cx).toBe(900);
  });

  it("확대 범위 1~4배, 가장자리에서 줄이면 안으로 밀림", () => {
    expect(zoomCrop(wide, initialCrop(wide), 9).zoom).toBe(4);
    expect(zoomCrop(wide, initialCrop(wide), 0.5).zoom).toBe(1);
    const edge = clampCrop(wide, { zoom: 4, cx: 125, cy: 125 });
    expect(zoomCrop(wide, edge, 1)).toEqual({ zoom: 1, cx: 500, cy: 500 });
  });

  it("미리 보기 자리는 잘라 낼 자리와 같음", () => {
    expect(cropImageStyle(wide, initialCrop(wide))).toEqual({ width: "200%", left: "-50%", top: "0%" });
  });
});

describe("PREM-LIM-17 프로필 사진 보이기", () => {
  it("프리미엄만 사진, 아니면 기본 캐릭터(값은 그대로)", () => {
    expect(visibleAvatarUrl("https://x/a.jpg", true)).toBe("https://x/a.jpg");
    expect(visibleAvatarUrl("https://x/a.jpg", false)).toBeNull();
    expect(visibleAvatarUrl(undefined, true)).toBeNull();
  });
});
