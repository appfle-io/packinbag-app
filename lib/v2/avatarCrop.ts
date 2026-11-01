// 프로필 사진 자르기 계산(2026-11-01, SET-PROF-12). 화면 · 파일과 상관없는 순수 함수만.
// 값은 원본 사진 픽셀 기준: 틀(정사각형)에 들어오는 부분의 가운데(cx · cy)와 확대(zoom, 1 = 짧은 변이 틀에 꽉 참)

export const AVATAR_SIZE = 256;
export const AVATAR_ZOOM_MIN = 1;
export const AVATAR_ZOOM_MAX = 4;

export interface ImageSize {
  w: number;
  h: number;
}

export interface AvatarCrop {
  zoom: number;
  cx: number;
  cy: number;
}

// 틀에 들어오는 한 변의 길이(원본 픽셀)
export function cropSide(size: ImageSize, zoom: number): number {
  return Math.min(size.w, size.h) / zoom;
}

const between = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// 사진 밖이 틀에 보이지 않게 맞춘다
export function clampCrop(size: ImageSize, crop: AvatarCrop): AvatarCrop {
  const zoom = between(crop.zoom, AVATAR_ZOOM_MIN, AVATAR_ZOOM_MAX);
  const half = cropSide(size, zoom) / 2;
  return { zoom, cx: between(crop.cx, half, size.w - half), cy: between(crop.cy, half, size.h - half) };
}

export function initialCrop(size: ImageSize): AvatarCrop {
  return { zoom: AVATAR_ZOOM_MIN, cx: size.w / 2, cy: size.h / 2 };
}

// 끌기. dx · dy는 틀 폭 대비 비율(손가락을 오른쪽으로 끌면 사진이 오른쪽으로 → 보는 자리는 왼쪽으로)
export function panCrop(size: ImageSize, crop: AvatarCrop, dx: number, dy: number): AvatarCrop {
  const side = cropSide(size, crop.zoom);
  return clampCrop(size, { ...crop, cx: crop.cx - dx * side, cy: crop.cy - dy * side });
}

export function zoomCrop(size: ImageSize, crop: AvatarCrop, zoom: number): AvatarCrop {
  return clampCrop(size, { ...crop, zoom });
}

// 원본에서 잘라 낼 정사각형(canvas drawImage의 sx · sy · s)
export function cropRect(size: ImageSize, crop: AvatarCrop): { sx: number; sy: number; side: number } {
  const side = cropSide(size, crop.zoom);
  return { sx: crop.cx - side / 2, sy: crop.cy - side / 2, side };
}

// 미리 보기 <img>의 자리(틀 폭 대비 %). 틀이 어떤 크기든 그대로 맞는다
export function cropImageStyle(size: ImageSize, crop: AvatarCrop): { width: string; left: string; top: string } {
  const { sx, sy, side } = cropRect(size, crop);
  return { width: `${(size.w / side) * 100}%`, left: `${(-sx / side) * 100}%`, top: `${(-sy / side) * 100}%` };
}

// 이용권이 끝나면 저장값은 두고 화면 · 멤버에게만 기본 캐릭터로(PREM-LIM-17)
export function visibleAvatarUrl(avatarUrl: string | null | undefined, premium: boolean): string | null {
  return premium && avatarUrl ? avatarUrl : null;
}
