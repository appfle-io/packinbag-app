import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { storage } from "@/lib/firebase";
import { compressImageFile } from "@/lib/imageCompression";

const MAX_UPLOAD_BYTES = 1024 * 1024; // 1MB - 이보다 크면 자동으로 압축해서 올림

export async function uploadBagImage(
  bagId: string,
  file: File
): Promise<string> {
  const toUpload = await compressImageFile(file, MAX_UPLOAD_BYTES);
  const safeName = toUpload.name.replace(/[^a-zA-Z0-9.]/g, "_");
  const path = `bags/${bagId}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, toUpload);
  return getDownloadURL(storageRef);
}

export async function deleteBagImage(url: string) {
  try {
    await deleteObject(ref(storage, url));
  } catch {
    // 이미 지워졌거나 권한 문제면 조용히 무시 (이미지 표시엔 영향 없음)
  }
}

// 메모팩(kind==='editor')에 첨부하는 사진/파일.
// 가방 안의 메모팩이면 bags/{bagId}/packs/{packId}/..., 보관함 메모팩이면 users/{uid}/packs/{packId}/... 로 저장.
export async function uploadPackImage(
  bagIdOrUid: string,
  packId: string,
  file: File,
  isBagPack = true
): Promise<string> {
  const toUpload = await compressImageFile(file, MAX_UPLOAD_BYTES);
  const safeName = toUpload.name.replace(/[^a-zA-Z0-9.]/g, "_");
  const path = isBagPack
    ? `bags/${bagIdOrUid}/packs/${packId}/${Date.now()}-${safeName}`
    : `users/${bagIdOrUid}/packs/${packId}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, toUpload);
  return getDownloadURL(storageRef);
}

// 삭제는 URL만 있으면 경로 상관없이 동일하게 동작하므로 deleteBagImage를 그대로 재사용한다.
export const deletePackImage = deleteBagImage;
