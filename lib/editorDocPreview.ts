// 메모팩(에디터팩)의 TipTap JSON(pack.editorDoc)을 미리보기 렌더링용 구조로 파싱하는 유틸
// (줄 단위 미리보기 collectEditorDocPreviewLines와 캔버스 그리기 renderRichMemoBlocksOnCanvas는
//  쓰는 곳이 없어 2026-10-08에 정리했다)

export interface RichSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  highlight?: string;
  color?: string;
  code?: boolean;
  href?: string;
}

interface RichTable {
  headers?: RichSpan[][];
  rows: RichSpan[][][];
}

export interface RichBlock {
  type: "heading" | "paragraph" | "bullet" | "ordered" | "task" | "blockquote" | "code" | "hr" | "table" | "toggle" | "image" | "file";
  level?: number;
  checked?: boolean;
  orderNumber?: number;
  depth?: number;
  align?: "left" | "center" | "right" | "justify";
  spans: RichSpan[];
  table?: RichTable;
  toggleOpen?: boolean;
  toggleSummarySpans?: RichSpan[];
  toggleChildren?: RichBlock[];
  src?: string;
  alt?: string;
  fileName?: string;
  fileKind?: string;
  fileExtension?: string;
  language?: string;
  isCollapsed?: boolean;
}

interface DocNode {
  type?: string;
  text?: string;
  attrs?: {
    level?: number;
    checked?: boolean;
    start?: number;
    color?: string;
    href?: string;
    open?: boolean;
    textAlign?: "left" | "center" | "right" | "justify";
    language?: string;
    isCollapsed?: boolean;
  };
  marks?: { type?: string; attrs?: { href?: string; color?: string } }[];
  content?: DocNode[];
}

// TipTap JSON에서 풍부한 서식(헤딩, 볼드, 체크박스, 인용구, 하이라이트 등)을 포함하는 블록 추출
export function collectEditorDocRichBlocks(doc: unknown): RichBlock[] {
  const blocks: RichBlock[] = [];
  let parsedDoc = doc;
  if (typeof parsedDoc === "string") {
    try {
      parsedDoc = JSON.parse(parsedDoc);
    } catch {
      return [];
    }
  }
  const root = parsedDoc as DocNode | undefined;
  if (!root || !root.content) return [];

  const extractSpans = (node: DocNode | undefined): RichSpan[] => {
    if (!node) return [];
    if (node.type === "text") {
      const marks = node.marks || [];
      const bold = marks.some((m) => m.type === "bold");
      const italic = marks.some((m) => m.type === "italic");
      const strike = marks.some((m) => m.type === "strike");
      const underline = marks.some((m) => m.type === "underline");
      const code = marks.some((m) => m.type === "code");
      const highlightMark = marks.find((m) => m.type === "highlight");
      const highlight = highlightMark ? (highlightMark.attrs?.color || "#FEF08A") : undefined;
      const colorMark = marks.find((m) => m.type === "textStyle" || m.type === "color");
      const color = colorMark?.attrs?.color;
      const linkMark = marks.find((m) => m.type === "link");
      const href = linkMark?.attrs?.href;

      return [
        {
          text: node.text || "",
          bold,
          italic,
          strike,
          underline,
          highlight,
          color,
          code,
          href,
        },
      ];
    }

    const spans: RichSpan[] = [];
    for (const child of node.content || []) {
      spans.push(...extractSpans(child));
    }
    return spans;
  };

  const processNode = (
    node: DocNode,
    listContext?: { type: "bullet" | "ordered" | "task"; order?: number; depth?: number }
  ) => {
    if (!node) return;
    const type = node.type;
    const align = node.attrs?.textAlign;
    const depth = listContext?.depth ?? 0;

    if (type === "heading") {
      const level = node.attrs?.level || 1;
      const spans = extractSpans(node);
      blocks.push({ type: "heading", level, align, spans: spans.length > 0 ? spans : [{ text: "" }], depth });
    } else if (type === "paragraph") {
      const spans = extractSpans(node);
      if (spans.length === 0 || !spans.some((s) => s.text.length > 0)) {
        // 엔터로 생성된 빈 줄 (빈 문단) 보존
        if (!listContext) {
          blocks.push({ type: "paragraph", align, spans: [{ text: "" }], depth });
        }
      } else {
        if (listContext?.type === "bullet") {
          blocks.push({ type: "bullet", align, spans, depth });
        } else if (listContext?.type === "ordered") {
          blocks.push({ type: "ordered", orderNumber: listContext.order, align, spans, depth });
        } else {
          blocks.push({ type: "paragraph", align, spans, depth });
        }
      }
    } else if (type === "toggleBlock") {
      const summaryNode = node.content?.find((c) => c.type === "toggleSummary");
      const contentNode = node.content?.find((c) => c.type === "toggleContent");
      const toggleSummarySpans = summaryNode ? extractSpans(summaryNode) : [{ text: "접기 / 펼치기" }];
      const toggleChildren = contentNode ? collectEditorDocRichBlocks(contentNode) : [];
      blocks.push({
        type: "toggle",
        toggleOpen: node.attrs?.open !== false,
        toggleSummarySpans: toggleSummarySpans.length > 0 ? toggleSummarySpans : [{ text: "" }],
        toggleChildren,
        depth,
        align,
        spans: [],
      });
    } else if (type === "toggleSummary") {
      const spans = extractSpans(node);
      if (spans.some((s) => s.text.trim().length > 0)) {
        blocks.push({
          type: "paragraph",
          spans: [{ text: "▶ ", bold: true }, ...spans],
          depth,
          align,
        });
      }
    } else if (type === "bulletList") {
      const nextDepth = (listContext?.depth ?? 0) + 1;
      for (const item of node.content || []) {
        for (const child of item.content || []) {
          processNode(child, { type: "bullet", depth: nextDepth });
        }
      }
    } else if (type === "orderedList") {
      const nextDepth = (listContext?.depth ?? 0) + 1;
      let idx = node.attrs?.start || 1;
      for (const item of node.content || []) {
        for (const child of item.content || []) {
          processNode(child, { type: "ordered", order: idx, depth: nextDepth });
        }
        idx++;
      }
    } else if (type === "taskList") {
      const nextDepth = (listContext?.depth ?? 0) + 1;
      for (const item of node.content || []) {
        const checked = !!item.attrs?.checked;
        const spans = extractSpans(item);
        blocks.push({ type: "task", checked, spans: spans.length > 0 ? spans : [{ text: "" }], depth: nextDepth });
        for (const child of item.content || []) {
          if (
            child.type === "taskList" ||
            child.type === "bulletList" ||
            child.type === "orderedList"
          ) {
            processNode(child, { type: "task", depth: nextDepth });
          }
        }
      }
    } else if (type === "table") {
      const tableRows: RichSpan[][][] = [];
      let headers: RichSpan[][] | undefined;
      for (const row of node.content || []) {
        if (row.type === "tableRow") {
          const cells: RichSpan[][] = [];
          let isHeaderRow = false;
          for (const cell of row.content || []) {
            if (cell.type === "tableHeader") isHeaderRow = true;
            cells.push(extractSpans(cell));
          }
          if (isHeaderRow && !headers) {
            headers = cells;
          } else {
            tableRows.push(cells);
          }
        }
      }
      if (tableRows.length > 0 || headers) {
        blocks.push({
          type: "table",
          spans: [],
          table: { headers, rows: tableRows },
          depth,
        });
      }
    } else if (type === "blockquote") {
      const spans = extractSpans(node);
      if (spans.some((s) => s.text.trim().length > 0)) {
        blocks.push({ type: "blockquote", spans, depth, align });
      }
    } else if (type === "codeBlock") {
      const spans = extractSpans(node);
      const language = node.attrs?.language;
      const isCollapsed = Boolean(node.attrs?.isCollapsed);
      if (spans.some((s) => s.text.trim().length > 0)) {
        blocks.push({ type: "code", spans, depth, language, isCollapsed });
      }
    } else if (type === "horizontalRule") {
      blocks.push({ type: "hr", spans: [], depth });
    } else if (type === "imageAttachment" || type === "image") {
      const attrs = (node.attrs || {}) as { src?: string; alt?: string };
      const alt = attrs.alt || "사진";
      const src = attrs.src;
      blocks.push({
        type: "image",
        src,
        alt,
        spans: [{ text: `[사진: ${alt}]` }],
        depth,
      });
    } else if (type === "fileAttachment") {
      const attrs = (node.attrs || {}) as {
        src?: string;
        fileName?: string;
        fileKind?: string;
        fileExtension?: string;
      };
      const fileName = attrs.fileName || "파일";
      const src = attrs.src;
      const fileKind = attrs.fileKind || "file";
      const fileExtension = attrs.fileExtension || "FILE";
      blocks.push({
        type: "file",
        src,
        fileName,
        fileKind,
        fileExtension,
        spans: [{ text: `[파일: ${fileName}]` }],
        depth,
      });
    } else if (node.content) {
      for (const child of node.content) {
        processNode(child, listContext);
      }
    }
  };

  for (const block of root.content) {
    processNode(block);
  }

  return blocks;
}
