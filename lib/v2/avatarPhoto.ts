// 프로필 사진 파일(2026-11-01, SET-PROF-12). Storage users/{uid}/avatar/{시각}.jpg
// 다른 멤버는 가방 memberProfiles에 찍힌 내려받기 주소(토큰)로 본다 → 규칙의 읽기는 본인만(RULE-STO-AVA-01)
import { deleteObject, getDownloadURL, listAll, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { AVATAR_SIZE, cropRect, type AvatarCrop } from "@/lib/v2/avatarCrop";

// 다시 그려 저장하므로 사진의 촬영 위치 등 EXIF는 따라가지 않는다
export async function renderAvatarJpeg(image: HTMLImageElement, crop: AvatarCrop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("사진을 읽지 못했어요");
  const { sx, sy, side } = cropRect({ w: image.naturalWidth, h: image.naturalHeight }, crop);
  ctx.fillStyle = "#fff"; // 투명 PNG가 검게 나오지 않게
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("사진을 읽지 못했어요");
  return blob;
}

export async function uploadAvatarPhoto(uid: string, blob: Blob): Promise<{ url: string; path: string }> {
  const path = `users/${uid}/avatar/${Date.now()}.jpg`;
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: "image/jpeg", cacheControl: "private, max-age=31536000, immutable" });
  return { url: await getDownloadURL(r), path };
}

// 지금 쓰는 것(keepPath)만 남기고 지운다. 실패해도 괜찮다(다음에 바꿀 때 · 탈퇴 때 다시 지움)
export async function deleteOtherAvatarPhotos(uid: string, keepPath?: string): Promise<void> {
  try {
    const res = await listAll(ref(storage, `users/${uid}/avatar`));
    await Promise.all(res.items.filter((it) => it.fullPath !== keepPath).map((it) => deleteObject(it).catch(() => {})));
  } catch {
    // 목록을 못 받으면 그대로 둔다
  }
}
