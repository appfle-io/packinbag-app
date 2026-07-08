// 사진을 올리기 전에, 지정한 용량(maxBytes)보다 크면 해상도/품질을 낮춰서
// 그 이하로 줄인다. 이미 그보다 작으면 원본을 그대로 쓴다.
// 압축 과정에서 문제가 생기면(포맷을 못 읽는 경우 등) 원본을 그대로 반환해서
// 업로드 자체가 막히지는 않게 한다.

const MAX_DIMENSION = 2000; // 원본이 과도하게 크면 먼저 해상도부터 줄인다
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4, 0.28];
const MAX_RESIZE_ATTEMPTS = 2;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽을 수 없어요"));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function compressImageFile(file: File, maxBytes: number): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= maxBytes) return file;

  try {
    const img = await loadImage(file);
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    const initialScale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    width = Math.round(width * initialScale);
    height = Math.round(height * initialScale);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    let blob: Blob | null = null;
    let resizeAttempt = 0;

    while (resizeAttempt <= MAX_RESIZE_ATTEMPTS) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      for (const quality of QUALITY_STEPS) {
        blob = await canvasToJpegBlob(canvas, quality);
        if (blob && blob.size <= maxBytes) break;
      }

      if (blob && blob.size <= maxBytes) break;

      // 품질을 최저까지 낮춰도 여전히 크면 해상도를 한 번 더 줄여서 재시도
      width = Math.round(width * 0.7);
      height = Math.round(height * 0.7);
      resizeAttempt++;
    }

    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (err) {
    console.error("[팩인백] 이미지 압축 실패, 원본으로 업로드:", err);
    return file;
  }
}
