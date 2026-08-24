"use client";

import { useMemo } from "react";
import { RichBlock, RichSpan, collectEditorDocRichBlocks } from "@/lib/editorDocPreview";
import { openExternalLink } from "@/lib/openExternalLink";

interface MemoRichTextViewProps {
  blocks?: RichBlock[];
  doc?: unknown;
  previewText?: string;
  className?: string;
  onLinkClick?: (href: string) => void;
}

export default function MemoRichTextView({
  blocks: propBlocks,
  doc,
  previewText,
  className = "",
  onLinkClick,
}: MemoRichTextViewProps) {
  const blocks = useMemo(() => {
    if (propBlocks && propBlocks.length > 0) return propBlocks;
    if (doc) {
      const parsed = collectEditorDocRichBlocks(doc);
      if (parsed.length > 0) return parsed;
    }
    if (previewText) {
      return previewText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((text): RichBlock => ({
          type: "paragraph",
          spans: [{ text }],
        }));
    }
    return [];
  }, [propBlocks, doc, previewText]);

  if (blocks.length === 0) {
    return null;
  }

  const renderSpans = (spans: RichSpan[], parentTaskChecked?: boolean) => {
    return spans.map((span, idx) => {
      let content: React.ReactNode = span.text;

      if (span.code) {
        content = (
          <code className="px-1 py-0.5 rounded bg-surface-2 font-mono text-[11.5px] text-accent border border-border/50">
            {content}
          </code>
        );
      }

      if (span.highlight) {
        const bg =
          span.highlight.startsWith("#") || span.highlight.startsWith("rgb")
            ? span.highlight
            : "rgba(254, 240, 138, 0.4)";
        content = (
          <mark
            className="px-1 py-0.5 rounded text-inherit"
            style={{ backgroundColor: bg }}
          >
            {content}
          </mark>
        );
      }

      if (span.href) {
        content = (
          <a
            href={span.href}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onLinkClick) {
                onLinkClick(span.href!);
              } else {
                openExternalLink(span.href!);
              }
            }}
            className="underline underline-offset-2 text-accent hover:opacity-80 font-medium cursor-pointer"
          >
            {content}
          </a>
        );
      }

      const classes = [
        span.bold ? "font-bold" : "",
        span.italic ? "italic" : "",
        span.strike || parentTaskChecked ? "line-through opacity-70" : "",
        span.underline && !span.href ? "underline underline-offset-2" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <span
          key={idx}
          className={classes || undefined}
          style={span.color ? { color: span.color } : undefined}
        >
          {content}
        </span>
      );
    });
  };

  return (
    <div className={`space-y-1 text-[13px] leading-[1.6] ${className}`}>
      {blocks.map((block, bIdx) => {
        if (block.type === "hr") {
          return <hr key={bIdx} className="border-border my-2 border-dashed" />;
        }

        if (block.type === "heading") {
          const level = block.level || 1;
          if (level === 1) {
            return (
              <h3
                key={bIdx}
                className="text-[15px] font-bold text-foreground mt-2 mb-1 first:mt-0"
              >
                {renderSpans(block.spans)}
              </h3>
            );
          }
          if (level === 2) {
            return (
              <h4
                key={bIdx}
                className="text-[14px] font-bold text-foreground mt-1.5 mb-0.5 first:mt-0"
              >
                {renderSpans(block.spans)}
              </h4>
            );
          }
          return (
            <h5
              key={bIdx}
              className="text-[13.5px] font-bold text-foreground mt-1 mb-0.5 first:mt-0"
            >
              {renderSpans(block.spans)}
            </h5>
          );
        }

        if (block.type === "task") {
          return (
            <div key={bIdx} className="flex items-start gap-1.5 my-0.5">
              {block.checked ? (
                <span className="shrink-0 text-emerald-600 dark:text-emerald-400 font-bold text-[12.5px] select-none font-mono">
                  [✓]
                </span>
              ) : (
                <span className="shrink-0 text-text-muted font-bold text-[12.5px] select-none font-mono">
                  [ ]
                </span>
              )}
              <div className={block.checked ? "text-text-muted" : "text-text-secondary"}>
                {renderSpans(block.spans, block.checked)}
              </div>
            </div>
          );
        }

        if (block.type === "bullet") {
          return (
            <div key={bIdx} className="flex items-start gap-1.5 my-0.5">
              <span className="shrink-0 text-accent font-bold text-[13px] select-none">•</span>
              <div className="text-text-secondary">{renderSpans(block.spans)}</div>
            </div>
          );
        }

        if (block.type === "ordered") {
          return (
            <div key={bIdx} className="flex items-start gap-1.5 my-0.5">
              <span className="shrink-0 font-bold text-foreground text-[12.5px] select-none font-mono">
                {block.orderNumber || 1}.
              </span>
              <div className="text-text-secondary">{renderSpans(block.spans)}</div>
            </div>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={bIdx}
              className="border-l-3 border-amber-500 dark:border-amber-400 pl-2.5 my-1 text-text-secondary italic bg-amber-500/5 py-1 rounded-r-md"
            >
              {renderSpans(block.spans)}
            </blockquote>
          );
        }

        if (block.type === "table" && block.table) {
          return (
            <div
              key={bIdx}
              className="overflow-x-auto my-2 rounded-lg border border-border/80 text-[11.5px] leading-tight"
            >
              <table className="w-full border-collapse text-left">
                {block.table.headers && (
                  <thead>
                    <tr className="bg-surface-2/80 border-b border-border/80">
                      {block.table.headers.map((hSpans, hIdx) => (
                        <th
                          key={hIdx}
                          className="p-1.5 font-bold text-foreground border-r last:border-r-0 border-border/60 whitespace-nowrap"
                        >
                          {renderSpans(hSpans)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {block.table.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-b last:border-b-0 border-border/40 hover:bg-surface-2/30"
                    >
                      {row.map((cellSpans, cIdx) => (
                        <td
                          key={cIdx}
                          className="p-1.5 text-text-secondary border-r last:border-r-0 border-border/40 whitespace-pre-wrap"
                        >
                          {renderSpans(cellSpans)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "code") {
          return (
            <pre
              key={bIdx}
              className="bg-surface-2 border border-border/60 rounded-lg p-2 my-1 font-mono text-[12px] text-foreground overflow-x-auto"
            >
              {renderSpans(block.spans)}
            </pre>
          );
        }

        return (
          <p key={bIdx} className="m-0 text-text-secondary break-words">
            {renderSpans(block.spans)}
          </p>
        );
      })}
    </div>
  );
}
