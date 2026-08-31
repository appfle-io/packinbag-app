import { getFileKind, getDisplayFileName, getFileExtensionLabel } from "./fileUrlUtils";

/**
 * TipTap 문서(JSON) 내에 삽입된 모든 이미지 및 파일 첨부 URL(Firebase Storage URL 등)을 추출한다.
 * 팩 삭제 시 Storage 고아 파일 일괄 정리 등에 사용된다.
 */
export function extractDocAttachmentUrls(doc: unknown): string[] {
  if (!doc || typeof doc !== "object") return [];
  const urls: string[] = [];

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as {
      type?: string;
      attrs?: { src?: string; [key: string]: unknown };
      content?: unknown[];
    };

    if (
      (n.type === "imageAttachment" || n.type === "image" || n.type === "fileAttachment") &&
      typeof n.attrs?.src === "string" &&
      n.attrs.src
    ) {
      urls.push(n.attrs.src);
    }

    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
    }
  };

  walk(doc);
  return Array.from(new Set(urls));
}

/**
 * 기존 pack.images에 저장되어 있던 첨부파일 목록을 에디터 본문(editorDoc) 최상단으로 마이그레이션한다.
 * 이미 본문에 존재하는 파일은 중복 추가되지 않으며, 누락된 항목만 최상단 블록으로 안전하게 주입한다.
 */
export function migratePackImagesToDoc(
  doc: unknown,
  images: string[] | undefined | null
): { doc: Record<string, unknown>; migrated: boolean } {
  const imageList = (images ?? []).filter(Boolean);
  
  // 기본 문서 구조 확보
  let docObj: Record<string, unknown>;
  if (doc && typeof doc === "object") {
    docObj = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
  } else if (typeof doc === "string" && doc.trim().startsWith("{")) {
    try {
      docObj = JSON.parse(doc) as Record<string, unknown>;
    } catch {
      docObj = { type: "doc", content: [] };
    }
  } else {
    docObj = { type: "doc", content: [] };
  }

  if (!Array.isArray(docObj.content)) {
    docObj.content = [];
  }

  if (imageList.length === 0) {
    return { doc: docObj, migrated: false };
  }

  const existingUrls = new Set(extractDocAttachmentUrls(docObj));
  const toInject = imageList.filter((url) => !existingUrls.has(url));

  if (toInject.length === 0) {
    return { doc: docObj, migrated: false };
  }

  // 새로 주입할 노드들 생성
  const newNodes = toInject.map((url) => {
    const kind = getFileKind(url);
    if (kind === "image") {
      return {
        type: "imageAttachment",
        attrs: {
          src: url,
          alt: getDisplayFileName(url) || "첨부 이미지",
        },
      };
    } else {
      return {
        type: "fileAttachment",
        attrs: {
          src: url,
          fileName: getDisplayFileName(url) || "첨부 파일",
          fileKind: kind === "pdf" ? "pdf" : "file",
          fileExtension: getFileExtensionLabel(url) || "FILE",
        },
      };
    }
  });

  // 문서 최상단에 주입
  const currentContent = docObj.content as unknown[];
  docObj.content = [...newNodes, ...currentContent];

  return { doc: docObj, migrated: true };
}
