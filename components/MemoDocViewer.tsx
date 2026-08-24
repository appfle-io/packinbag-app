"use client";

import { useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { getNoteEditorExtensions } from "@/lib/noteEditorExtensions";
import { Pack } from "@/lib/types";
import { getFileKind, getFileExtensionLabel } from "@/lib/fileUrlUtils";
import { openExternalLink } from "@/lib/openExternalLink";
import { IconFileText } from "@tabler/icons-react";

interface MemoDocViewerProps {
  pack: Pack;
  className?: string;
}

export default function MemoDocViewer({ pack, className = "" }: MemoDocViewerProps) {
  const extensions = useMemo(() => getNoteEditorExtensions(), []);

  const editor = useEditor(
    {
      extensions,
      content: pack.editorDoc || pack.editorPreviewText || "",
      editable: false,
      immediatelyRender: false,
    },
    [pack.editorDoc, pack.editorPreviewText]
  );

  const images = pack.images || [];

  return (
    <div className={`w-full flex flex-col gap-4 text-foreground pib-note-editor ${className}`}>
      {/* 첨부 이미지/파일 갤러리 */}
      {images.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
          {images.map((src, idx) => {
            const kind = getFileKind(src);
            const isImg = kind === "image";
            return (
              <div
                key={idx}
                className="relative h-28 w-28 sm:h-32 sm:w-32 shrink-0 rounded-xl overflow-hidden border border-border bg-surface-2 shadow-xs"
              >
                {isImg ? (
                  <img
                    src={src}
                    alt={`첨부 이미지 ${idx + 1}`}
                    className="h-full w-full object-cover cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => openExternalLink(src)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => openExternalLink(src)}
                    className="h-full w-full flex flex-col items-center justify-center gap-1 text-text-secondary hover:text-foreground transition-colors p-2"
                  >
                    <IconFileText size={26} />
                    <span className="text-[10px] font-mono uppercase truncate max-w-full font-semibold">
                      {getFileExtensionLabel(src) || "FILE"}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TipTap 서식 본문 (pib-note-editor 스타일 적용) */}
      <div className="w-full text-foreground leading-relaxed text-[14.5px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
