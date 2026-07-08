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
