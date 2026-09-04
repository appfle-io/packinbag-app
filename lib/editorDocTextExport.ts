import { collectEditorDocRichBlocks, RichBlock } from "@/lib/editorDocPreview";
import { Pack } from "@/lib/types";

/**
 * TipTap editorDoc 또는 팩 데이터를 줄바꿈과 체크 상태([✓] / [ ]),
 * 헤딩(#, ##), 글머리표(•), 순서 번호 등이 깔끔하게 보존된 텍스트로 변환합니다.
 */
export function extractCleanFormattedText(pack: Pack): string {
  const title = pack.name ? `${pack.name}\n\n` : "";

  if (pack.editorDoc) {
    const blocks = collectEditorDocRichBlocks(pack.editorDoc);
    if (blocks.length > 0) {
      const lines = blocks.map((block: RichBlock) => {
        const text = block.spans.map((s) => s.text).join("").trim();
        if (!text) return "";

        if (block.type === "heading") {
          const prefix = "#".repeat(block.level || 1);
          return `\n${prefix} ${text}\n`;
        }

        if (block.type === "task") {
          const checkMark = block.checked ? "[✓]" : "[ ]";
          return `${checkMark} ${text}`;
        }

        if (block.type === "bullet") {
          return `• ${text}`;
        }

        if (block.type === "ordered") {
          return `${block.orderNumber || 1}. ${text}`;
        }

        if (block.type === "blockquote") {
          return `> ${text}`;
        }

        if (block.type === "code") {
          const rawCode = block.spans.map((s) => s.text).join("");
          const lang = block.language || "";
          return `\n\`\`\`${lang}\n${rawCode}\n\`\`\`\n`;
        }

        return text;
      });

      // 연속 빈 줄 정리
      const body = lines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      return `${title}${body}`;
    }
  }

  // fallback: editorPreviewText 또는 items
  if (pack.editorPreviewText) {
    return `${title}${pack.editorPreviewText.trim()}`;
  }

  if (pack.items && pack.items.length > 0) {
    const itemLines = pack.items.map((i) => `${i.checked ? "[✓]" : "[ ]"} ${i.text}`);
    return `${title}${itemLines.join("\n")}`;
  }

  return pack.name || "";
}
