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

// 가방 "안"의 메모팩(kind==='editor')에 첨부하는 사진/PDF. 경로를 bags/{bagId}/packs/{packId}/...
// 로 둬서, storage.rules가 가방 이미지와 동일한 멤버 검증 함수(isMemberOf)를 그대로
// 재사용할 수 있게 한다(가방 하위 트리 안이라 가방 멤버십만 확인하면 되기 때문).
export async function uploadPackImage(
  bagId: string,
  packId: string,
  file: File
): Promise<string> {
  const toUpload = await compressImageFile(file, MAX_UPLOAD_BYTES);
  const safeName = toUpload.name.replace(/[^a-zA-Z0-9.]/g, "_");
  const path = `bags/${bagId}/packs/${packId}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, toUpload);
  return getDownloadURL(storageRef);
}

// 삭제는 URL만 있으면 경로 상관없이 동일하게 동작하므로 deleteBagImage를 그대로 재사용한다.
export const deletePackImage = deleteBagImage;
