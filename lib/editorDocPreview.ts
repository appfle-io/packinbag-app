// 메모팩(에디터팩)의 TipTap JSON(pack.editorDoc)을 미리보기 및 캔버스 렌더링용 구조로 파싱하는 유틸

export interface PreviewSpan {
  text: string;
  href?: string;
}

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

export interface RichBlock {
  type: "heading" | "paragraph" | "bullet" | "ordered" | "task" | "blockquote" | "code" | "hr";
  level?: number;
  checked?: boolean;
  orderNumber?: number;
  spans: RichSpan[];
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
  };
  marks?: { type?: string; attrs?: { href?: string; color?: string } }[];
  content?: DocNode[];
}

// 단순 텍스트 줄바꿈용 블록 타입들
const LINE_BREAK_TYPES = new Set([
  "paragraph",
  "heading",
  "listItem",
  "taskItem",
  "tableCell",
  "tableHeader",
  "toggleSummary",
  "codeBlock",
]);

export function collectEditorDocPreviewLines(doc: unknown): PreviewSpan[][] {
  const lines: PreviewSpan[][] = [];
  let current: PreviewSpan[] = [];

  let parsedDoc = doc;
  if (typeof parsedDoc === "string") {
    try {
      parsedDoc = JSON.parse(parsedDoc);
    } catch {
      return [];
    }
  }

  const flushLine = () => {
    if (current.length > 0) {
      lines.push(current);
      current = [];
    }
  };

  const walk = (node: DocNode | undefined) => {
    if (!node) return;
    if (node.type === "text") {
      const linkMark = node.marks?.find((m) => m?.type === "link");
      const text = node.text ?? "";
      if (text) current.push({ text, href: linkMark?.attrs?.href });
      return;
    }
    if (node.type === "hardBreak") {
      flushLine();
      return;
    }
    const children = node.content ?? [];
    for (const child of children) walk(child);
    if (node.type && LINE_BREAK_TYPES.has(node.type)) flushLine();
  };

  const root = parsedDoc as DocNode | undefined;
  for (const block of root?.content ?? []) {
    walk(block);
    flushLine();
  }

  return lines.filter((line) => line.some((span) => span.text.trim().length > 0));
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

  const processNode = (node: DocNode, listContext?: { type: "bullet" | "ordered" | "task"; order?: number }) => {
    if (!node) return;
    const type = node.type;

    if (type === "heading") {
      const level = node.attrs?.level || 1;
      const spans = extractSpans(node);
      if (spans.some((s) => s.text.trim().length > 0)) {
        blocks.push({ type: "heading", level, spans });
      }
    } else if (type === "paragraph") {
      const spans = extractSpans(node);
      if (spans.some((s) => s.text.trim().length > 0)) {
        if (listContext?.type === "bullet") {
          blocks.push({ type: "bullet", spans });
        } else if (listContext?.type === "ordered") {
          blocks.push({ type: "ordered", orderNumber: listContext.order, spans });
        } else {
          blocks.push({ type: "paragraph", spans });
        }
      }
    } else if (type === "toggleSummary") {
      const spans = extractSpans(node);
      if (spans.some((s) => s.text.trim().length > 0)) {
        blocks.push({
          type: "paragraph",
          spans: [{ text: "▶ ", bold: true }, ...spans],
        });
      }
    } else if (type === "bulletList") {
      for (const item of node.content || []) {
        for (const child of item.content || []) {
          processNode(child, { type: "bullet" });
        }
      }
    } else if (type === "orderedList") {
      let idx = node.attrs?.start || 1;
      for (const item of node.content || []) {
        for (const child of item.content || []) {
          processNode(child, { type: "ordered", order: idx });
        }
        idx++;
      }
    } else if (type === "taskList") {
      for (const item of node.content || []) {
        const checked = !!item.attrs?.checked;
        const spans = extractSpans(item);
        if (spans.some((s) => s.text.trim().length > 0)) {
          blocks.push({ type: "task", checked, spans });
        }
      }
    } else if (type === "blockquote") {
      const spans = extractSpans(node);
      if (spans.some((s) => s.text.trim().length > 0)) {
        blocks.push({ type: "blockquote", spans });
      }
    } else if (type === "codeBlock") {
      const spans = extractSpans(node);
      if (spans.some((s) => s.text.trim().length > 0)) {
        blocks.push({ type: "code", spans });
      }
    } else if (type === "horizontalRule") {
      blocks.push({ type: "hr", spans: [] });
    } else if (node.content) {
      for (const child of node.content) {
        processNode(child);
      }
    }
  };

  for (const block of root.content) {
    processNode(block);
  }

  return blocks;
}

// 텍스트를 정확한 픽셀 단위로 측정하여 maxPxWidth 이내로 자르고 말줄임표(...)를 붙이는 함수
function truncateTextToFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxPxWidth: number
): { text: string; width: number } {
  if (maxPxWidth <= 0) return { text: "", width: 0 };
  const fullW = ctx.measureText(text).width;
  if (fullW <= maxPxWidth) return { text, width: fullW };

  const ellipsisW = ctx.measureText("...").width;
  if (ellipsisW > maxPxWidth) return { text: "", width: 0 };

  let low = 0;
  let high = text.length;
  let best = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = text.slice(0, mid) + "...";
    const w = ctx.measureText(candidate).width;
    if (w <= maxPxWidth) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const resultText = best || "...";
  return { text: resultText, width: ctx.measureText(resultText).width };
}

// RichBlock들을 캔버스에 서식을 완벽히 적용하여 그리는 헬퍼 함수 (오버플로우 100% 방지)
export function renderRichMemoBlocksOnCanvas({
  ctx,
  blocks,
  startX,
  startY,
  maxWidth,
  botLimitY,
  theme,
}: {
  ctx: CanvasRenderingContext2D;
  blocks: RichBlock[];
  startX: number;
  startY: number;
  maxWidth: number;
  botLimitY: number;
  theme: "boarding" | "receipt" | "polaroid";
}): number {
  let curY = startY;
  const isMono = theme === "receipt";
  const maxX = startX + maxWidth;

  for (const block of blocks) {
    if (curY + 22 > botLimitY) break;

    // 구분선
    if (block.type === "hr") {
      ctx.save();
      ctx.strokeStyle = isMono ? "#78716C" : "rgba(148, 163, 184, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, curY + 6);
      ctx.lineTo(maxX, curY + 6);
      ctx.stroke();
      ctx.restore();
      curY += 16;
      continue;
    }

    // 블록별 폰트/위치 기본값 세팅
    let baseFontSize = 13.5;
    let isHeading = false;
    let headingLevel = 1;
    let blockIndent = 0;
    let blockPrefix = "";
    let prefixColor = isMono ? "#1C1917" : "#475569";

    if (block.type === "heading") {
      isHeading = true;
      headingLevel = block.level || 1;
      baseFontSize = headingLevel === 1 ? 16.5 : headingLevel === 2 ? 15 : 14;
      curY += 4;
    } else if (block.type === "task") {
      blockPrefix = block.checked ? "[✓] " : "[ ] ";
      prefixColor = block.checked ? (isMono ? "#78716C" : "#10B981") : (isMono ? "#1C1917" : "#64748B");
      blockIndent = 22;
    } else if (block.type === "bullet") {
      blockPrefix = "• ";
      prefixColor = isMono ? "#1C1917" : (theme === "boarding" ? "#2563EB" : "#0284C7");
      blockIndent = 14;
    } else if (block.type === "ordered") {
      blockPrefix = `${block.orderNumber || 1}. `;
      prefixColor = isMono ? "#1C1917" : "#0F172A";
      blockIndent = 18;
    } else if (block.type === "blockquote") {
      blockIndent = 12;
    } else if (block.type === "code") {
      blockIndent = 8;
    }

    // 인용구 좌측 세로 바 그리기
    if (block.type === "blockquote") {
      ctx.save();
      ctx.fillStyle = isMono ? "#78716C" : (theme === "boarding" ? "#F59E0B" : "#0284C7");
      const barH = 18;
      ctx.fillRect(startX, curY - 13, 3, barH);
      ctx.restore();
    }

    // 코드 블록 연한 배경 그리기
    if (block.type === "code") {
      ctx.save();
      ctx.fillStyle = isMono ? "rgba(0, 0, 0, 0.05)" : "rgba(15, 23, 42, 0.05)";
      ctx.fillRect(startX, curY - 14, maxWidth, 20);
      ctx.restore();
    }

    // 접두사(체크박스, 불릿, 번호) 그리기
    if (blockPrefix) {
      ctx.save();
      ctx.fillStyle = prefixColor;
      ctx.font = isMono
        ? `bold ${baseFontSize}px 'Courier New', monospace`
        : `bold ${baseFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(blockPrefix, startX, curY);
      ctx.restore();
    }

    // 인라인 스팬 렌더링 (단어/글자 단위 줄바꿈 및 서식 적용)
    let lineX = startX + blockIndent;
    let wrappedLineCount = 0;
    const maxWrapLines = 2; // 한 블록당 최대 2줄까지 줄바꿈 허용

    for (const span of block.spans) {
      if (curY + 20 > botLimitY) break;

      const isBold = span.bold || isHeading;
      const isItalic = span.italic || block.type === "blockquote";
      const isCode = span.code || block.type === "code";
      const isTaskChecked = block.type === "task" && block.checked;

      const fontFam = isMono || isCode
        ? "'Courier New', monospace"
        : "-apple-system, BlinkMacSystemFont, sans-serif";
      const fontStyle = isItalic ? "italic " : "";
      const fontWeight = isBold ? "bold " : "500 ";
      ctx.font = `${fontStyle}${fontWeight}${baseFontSize}px ${fontFam}`;

      // 색상 결정
      let textColor = isMono ? "#1C1917" : "#334155";
      if (span.color && !isMono) {
        textColor = span.color;
      } else if (span.href && !isMono) {
        textColor = "#2563EB";
      } else if (isHeading && !isMono) {
        textColor = theme === "boarding" ? "#1E3A8A" : "#0F172A";
      } else if (isTaskChecked) {
        textColor = isMono ? "#78716C" : "#94A3B8";
      }

      let remainingText = span.text;

      while (remainingText.length > 0) {
        const remainingW = maxX - lineX;

        if (remainingW <= 10) {
          // 현재 줄이 꽉 참 -> 다음 줄로 줄바꿈 (허용 한도 내)
          if (wrappedLineCount < maxWrapLines - 1 && curY + 40 <= botLimitY) {
            curY += isHeading ? 24 : 20;
            lineX = startX + blockIndent;
            wrappedLineCount++;
            continue;
          } else {
            // 더 이상 줄바꿈 불가 -> 종료
            break;
          }
        }

        const fullSpanW = ctx.measureText(remainingText).width;

        if (fullSpanW <= remainingW) {
          // 전체 텍스트가 현재 줄에 쏙 들어감
          if (span.highlight && !isMono) {
            ctx.save();
            ctx.fillStyle = span.highlight.startsWith("#") || span.highlight.startsWith("rgb")
              ? span.highlight
              : "rgba(254, 240, 138, 0.85)";
            ctx.fillRect(lineX - 1, curY - baseFontSize + 2, fullSpanW + 2, baseFontSize + 2);
            ctx.restore();
          }

          ctx.fillStyle = textColor;
          ctx.fillText(remainingText, lineX, curY);

          if (span.strike || isTaskChecked) {
            ctx.save();
            ctx.strokeStyle = textColor;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(lineX, curY - baseFontSize * 0.35);
            ctx.lineTo(lineX + fullSpanW, curY - baseFontSize * 0.35);
            ctx.stroke();
            ctx.restore();
          }

          if (span.underline || (span.href && !isMono)) {
            ctx.save();
            ctx.strokeStyle = textColor;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(lineX, curY + 2);
            ctx.lineTo(lineX + fullSpanW, curY + 2);
            ctx.stroke();
            ctx.restore();
          }

          lineX += fullSpanW;
          remainingText = "";
        } else {
          // 넘치는 경우: 줄바꿈이 가능하면 가능한 만큼 자르고 다음 줄로, 아니면 말줄임(...)
          if (wrappedLineCount < maxWrapLines - 1 && curY + 40 <= botLimitY) {
            // 이번 줄에 들어갈 수 있는 최대 글자 수 탐색
            let fitLen = 0;
            for (let i = 1; i <= remainingText.length; i++) {
              if (ctx.measureText(remainingText.slice(0, i)).width > remainingW) {
                break;
              }
              fitLen = i;
            }

            if (fitLen > 0) {
              const part = remainingText.slice(0, fitLen);
              const partW = ctx.measureText(part).width;

              if (span.highlight && !isMono) {
                ctx.save();
                ctx.fillStyle = span.highlight.startsWith("#") || span.highlight.startsWith("rgb")
                  ? span.highlight
                  : "rgba(254, 240, 138, 0.85)";
                ctx.fillRect(lineX - 1, curY - baseFontSize + 2, partW + 2, baseFontSize + 2);
                ctx.restore();
              }

              ctx.fillStyle = textColor;
              ctx.fillText(part, lineX, curY);

              if (span.strike || isTaskChecked) {
                ctx.save();
                ctx.strokeStyle = textColor;
                ctx.lineWidth = 1.3;
                ctx.beginPath();
                ctx.moveTo(lineX, curY - baseFontSize * 0.35);
                ctx.lineTo(lineX + partW, curY - baseFontSize * 0.35);
                ctx.stroke();
                ctx.restore();
              }

              remainingText = remainingText.slice(fitLen);
            }

            curY += isHeading ? 24 : 20;
            lineX = startX + blockIndent;
            wrappedLineCount++;
          } else {
            // 마지막 줄이므로 남은 폭에 맞춰 완벽히 truncate
            const { text: truncText, width: truncW } = truncateTextToFit(ctx, remainingText, remainingW);
            if (truncText) {
              if (span.highlight && !isMono) {
                ctx.save();
                ctx.fillStyle = span.highlight.startsWith("#") || span.highlight.startsWith("rgb")
                  ? span.highlight
                  : "rgba(254, 240, 138, 0.85)";
                ctx.fillRect(lineX - 1, curY - baseFontSize + 2, truncW + 2, baseFontSize + 2);
                ctx.restore();
              }

              ctx.fillStyle = textColor;
              ctx.fillText(truncText, lineX, curY);

              if (span.strike || isTaskChecked) {
                ctx.save();
                ctx.strokeStyle = textColor;
                ctx.lineWidth = 1.3;
                ctx.beginPath();
                ctx.moveTo(lineX, curY - baseFontSize * 0.35);
                ctx.lineTo(lineX + truncW, curY - baseFontSize * 0.35);
                ctx.stroke();
                ctx.restore();
              }
            }
            remainingText = "";
            break;
          }
        }
      }
    }

    curY += isHeading ? 25 : 21;
  }

  return curY;
}

