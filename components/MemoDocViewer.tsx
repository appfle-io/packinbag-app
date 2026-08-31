"use client";

import { useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { getNoteEditorExtensions } from "@/lib/noteEditorExtensions";
import { Pack } from "@/lib/types";
import { getFileKind } from "@/lib/fileUrlUtils";
import { openExternalLink } from "@/lib/openExternalLink";
import { extractDocAttachmentUrls, migratePackImagesToDoc } from "@/lib/editorDocAttachmentUtils";
import ImageLightbox from "@/components/ImageLightbox";
import PdfPreviewModal from "@/components/PdfPreviewModal";

interface MemoDocViewerProps {
  pack: Pack;
  className?: string;
}

export default function MemoDocViewer({ pack, className = "" }: MemoDocViewerProps) {
  const extensions = useMemo(() => getNoteEditorExtensions(), []);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const initialDoc = useMemo(() => {
    if (pack.images && pack.images.length > 0) {
      const { doc } = migratePackImagesToDoc(pack.editorDoc, pack.images);
      return doc;
    }
    return pack.editorDoc || pack.editorPreviewText || "";
  }, [pack.images, pack.editorDoc, pack.editorPreviewText]);

  const editor = useEditor(
    {
      extensions,
      content: initialDoc,
      editable: false,
      immediatelyRender: false,
      editorProps: {
        handleClick: (_view, _pos, event) => {
          const target = event.target as HTMLElement | null;

          // 1. 링크 클릭
          const anchor = target?.closest("a");
          if (anchor) {
            const href = anchor.getAttribute("href");
            if (href) {
              event.preventDefault();
              openExternalLink(href);
              return true;
            }
          }

          // 2. 이미지 클릭 -> 라이트박스 열람
          const img = target?.closest<HTMLElement>("img[data-image-src], [data-image-src]");
          if (img) {
            const src = img.getAttribute("data-image-src") || (img as HTMLImageElement).src;
            if (src) {
              event.preventDefault();
              const allDocImages = extractDocAttachmentUrls(editor?.getJSON()).filter(
                (u) => getFileKind(u) === "image"
              );
              const list = allDocImages.length > 0 ? allDocImages : [src];
              const idx = list.indexOf(src);
              setLightboxImages(list);
              setLightboxIndex(idx >= 0 ? idx : 0);
              return true;
            }
          }

          // 3. 파일 카드 클릭 -> PDF 미리보기 또는 다운로드
          const fileCard = target?.closest<HTMLElement>("[data-file-src]");
          if (fileCard) {
            const src = fileCard.getAttribute("data-file-src");
            const kind = fileCard.getAttribute("data-file-kind");
            if (src) {
              event.preventDefault();
              if (kind === "pdf") {
                setPdfPreviewUrl(src);
              } else {
                openExternalLink(src);
              }
              return true;
            }
          }

          return false;
        },
      },
    },
    [initialDoc]
  );

  return (
    <div className={`w-full flex flex-col gap-4 text-foreground pib-note-editor ${className}`}>
      {/* TipTap 서식 본문 (pib-note-editor 스타일 적용) */}
      <div className="w-full text-foreground leading-relaxed text-[14.5px]">
        <EditorContent editor={editor} />
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={lightboxImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {pdfPreviewUrl && (
        <PdfPreviewModal url={pdfPreviewUrl} onClose={() => setPdfPreviewUrl(null)} />
      )}
    </div>
  );
}

