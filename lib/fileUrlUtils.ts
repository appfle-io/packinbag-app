// Firebase Storage 다운로드 URL은 원본 파일명(+확장자)이 "?" 쿼리스트링 바로 앞에 그대로
// 남아있어서(lib/storageService.ts 참고), 그걸로 PDF와 이미지를 구분할 수 있다.
// 가방 이미지(BagEditorScreen)와 메모팩 첨부파일(PackNoteEditorScreen) 둘 다에서 재사용한다.
// 오프라인(포터블) 첨부는 파일을 data URL로 문서에 바로 넣는다. 주소에 확장자가 없으므로 MIME으로 종류를 정한다
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/x-hwp": "hwp",
  "application/haansofthwp": "hwp",
};

export function isDataUrl(url: string) {
  return url.startsWith("data:");
}

export function dataUrlMime(url: string): string {
  const semi = url.indexOf(";");
  const comma = url.indexOf(",");
  const end = semi > 0 && (comma < 0 || semi < comma) ? semi : comma;
  return url.slice(5, end > 0 ? end : undefined).toLowerCase();
}

export function extFromMime(mime: string): string {
  return MIME_EXT[mime] ?? (mime.split("/")[1]?.split("+")[0] ?? "");
}

// 메모팩 첨부파일이 이미지/PDF를 넘어 임의 파일형식까지 허용되면서(2026-08~) 추가된 범용 판별.
// 이미지 확장자 목록은 업로드 시 압축(compressImageFile)이 적용되는 포맷(png/jpg/jpeg/webp/gif)이거나,
// 압축 대상은 아니지만 미리보기는 그대로 해야 하는 heic/svg/bmp도 포함한다.
const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "bmp",
  "svg",
]);

export type FileKind = "image" | "pdf" | "other";

function getExtension(url: string): string {
  // 오프라인(포터블) 첨부는 data URL이라 주소에 확장자가 없다 → MIME으로 판별(10/4 수정).
  // 예전에는 사진도 "기타 파일"로 보여 미리보기·다운로드가 되지 않았다
  if (isDataUrl(url)) return extFromMime(dataUrlMime(url));
  const clean = url.split("?")[0].toLowerCase();
  const last = clean.split("/").pop() ?? "";
  const dot = last.lastIndexOf(".");
  return dot === -1 ? "" : last.slice(dot + 1);
}

export function getFileKind(url: string): FileKind {
  const ext = getExtension(url);
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return "other";
}

// "기타"(image/pdf 아닌) 파일을 지울 때 보여줄 확장자 라벨(예: "DOCX", "ZIP"). 없으면 빈 문자열.
export function getFileExtensionLabel(url: string): string {
  return getExtension(url).toUpperCase();
}

// Storage 경로에 저장된 원본 파일명을 돌려준다(lib/storageService.ts의 업로드 경로가
// `${Date.now()}-${safeName}` 형태로 저장되므로, 앞의 타임스탬프 접두사를 제거하고 보여준다).
// "기타" 파일 첨부을 목록에 파일명으로 보여줄 때 쓴다.
export function getDisplayFileName(url: string): string {
  if (isDataUrl(url)) {
    const ext = getExtension(url);
    return ext ? `파일.${ext}` : "파일";
  }
  const clean = url.split("?")[0];
  const decoded = (() => {
    try {
      return decodeURIComponent(clean);
    } catch {
      return clean;
    }
  })();
  const last = decoded.split("/").pop() || "파일";
  const match = last.match(/^\d+-(.+)$/);
  return match ? match[1] : last;
}
