// 사진을 올리기 전에, 지정한 용량(maxBytes) 및 해상도로 안전하게 압축한다.
// 다중 안전망(WebP 1차 -> JPEG 2차 -> 원본 3차)을 구축하여 어떤 환경에서도 업로드 실패를 방지한다.
// SVG, GIF(애니메이션), PDF 등은 변환 없이 원본 그대로 통과시킨다.

const MAX_DIMENSION = 1600; // 긴 변 기준 최대 1600px (선명도 유지 및 용량 최적화)
const QUALITY_STEPS = [0.82, 0.7, 0.55, 0.4];
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

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(
        (blob) => resolve(blob),
        mimeType,
        quality
      );
    } catch {
      resolve(null);
    }
  });
}

export async function compressImageFile(file: File, maxBytes: number): Promise<File> {
  // 이미지가 아니거나(PDF 등), 변환 시 깨질 수 있는 SVG/GIF는 원본 그대로 업로드
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/svg+xml" ||
    file.type === "image/gif"
  ) {
    return file;
  }

  // 브라우저 환경이 아니면 원본 반환
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  try {
    const img = await loadImage(file);
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    // 이미 해상도가 작고 용량도 400KB 이하이면 그대로 사용
    if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && file.size <= 400 * 1024) {
      return file;
    }

    const initialScale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    width = Math.round(width * initialScale);
    height = Math.round(height * initialScale);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    let blob: Blob | null = null;
    let usedMime = "image/webp";
    let resizeAttempt = 0;

    while (resizeAttempt <= MAX_RESIZE_ATTEMPTS) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // 1. WebP 포맷으로 압축 시도
      for (const quality of QUALITY_STEPS) {
        blob = await canvasToBlob(canvas, "image/webp", quality);
        if (blob && blob.type === "image/webp" && blob.size <= maxBytes) {
          usedMime = "image/webp";
          break;
        }
      }

      // 2. WebP 미지원 브라우저이거나 변환 실패 시 JPEG로 2차 폴백
      if (!blob || blob.type !== "image/webp") {
        for (const quality of QUALITY_STEPS) {
          blob = await canvasToBlob(canvas, "image/jpeg", quality);
          if (blob && blob.size <= maxBytes) {
            usedMime = "image/jpeg";
            break;
          }
        }
      }

      if (blob && blob.size <= maxBytes) break;

      // 품질을 낮춰도 여전히 목표 용량을 초과하면 해상도를 30% 줄여 재시도
      width = Math.round(width * 0.7);
      height = Math.round(height * 0.7);
      resizeAttempt++;
    }

    // 압축 결과가 없거나 원본보다 오히려 커진 경우 원본 사용
    if (!blob || blob.size >= file.size) return file;

    const ext = usedMime === "image/webp" ? ".webp" : ".jpg";
    const newName = file.name.replace(/\.[^.]+$/, "") + ext;
    return new File([blob], newName, { type: usedMime });
  } catch (err) {
    // 3. 어떤 에러가 발생해도 원본 파일을 반환하여 업로드 자체가 실패하지 않도록 보장
    console.warn("[팩인백] 이미지 압축 실패, 원본으로 업로드합니다:", err);
    return file;
  }
}
