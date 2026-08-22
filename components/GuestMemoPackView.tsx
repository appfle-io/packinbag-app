"use client";

import { useMemo, useState } from "react";
import {
  IconNotes,
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconPhoto,
} from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { collectEditorDocPreviewLines, PreviewSpan } from "@/lib/editorDocPreview";

// URL 문자열을 자동으로 <a> 태그로 파싱하는 정규식
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderTextWithLinks(text: string, keyPrefix: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, index) => {
    if (URL_REGEX.test(part)) {
      return (
        <a
          key={`${keyPrefix}-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-80 break-all font-medium"
        >
          <span>{part}</span>
          <IconExternalLink size={12} className="shrink-0 inline" />
        </a>
      );
    }
    return <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
}

export default function GuestMemoPackView({ pack }: { pack: Pack }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // TipTap JSON 구조(editorDoc)에서 텍스트 라인 파싱, 없으면 editorPreviewText를 기반으로 생성
  const parsedLines = useMemo(() => {
    if (pack.editorDoc) {
      const lines = collectEditorDocPreviewLines(pack.editorDoc);
      if (lines.length > 0) return lines;
    }
    if (pack.editorPreviewText) {
      return pack.editorPreviewText.split("\n").map((line): PreviewSpan[] => [{ text: line }]);
    }
    return [];
  }, [pack.editorDoc, pack.editorPreviewText]);

  const fullText = useMemo(() => {
    if (parsedLines.length > 0) {
      return parsedLines.map((line) => line.map((s) => s.text).join("")).join("\n");
    }
    return pack.editorPreviewText || "";
  }, [parsedLines, pack.editorPreviewText]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fullText) return;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const isLongContent = parsedLines.length > 4 || fullText.length > 180;
  const displayedLines = isLongContent && !expanded ? parsedLines.slice(0, 4) : parsedLines;

  return (
    <div className="space-y-2">
      {/* 메모 상단 툴바 / 정보 */}
      <div className="flex items-center justify-between text-[12px] text-slate-400 dark:text-slate-500 pt-0.5">
        <div className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
          <IconNotes size={14} />
          <span>메모/문서</span>
        </div>
        {fullText.trim().length > 0 && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-[11px] font-medium"
            title="메모 복사"
          >
            {copied ? (
              <>
                <IconCheck size={12} className="text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">복사완료</span>
              </>
            ) : (
              <>
                <IconCopy size={12} />
                <span>복사</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 메모 본문 카드 */}
      <div className="relative rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/80 p-3.5 transition-all">
        {parsedLines.length === 0 ? (
          <p className="text-[13px] text-slate-400 italic py-1">작성된 메모 내용이 없어요</p>
        ) : (
          <div className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-200 space-y-1.5 whitespace-pre-wrap break-words">
            {displayedLines.map((line, li) => (
              <p key={li} className="m-0">
                {line.map((span, si) =>
                  span.href ? (
                    <a
                      key={si}
                      href={span.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-80 break-all font-medium"
                    >
                      <span>{span.text}</span>
                      <IconExternalLink size={12} className="shrink-0 inline" />
                    </a>
                  ) : (
                    renderTextWithLinks(span.text, `${li}-${si}`)
                  )
                )}
              </p>
            ))}
          </div>
        )}

        {/* 4줄 초과 시 접힘 페이드 & 더보기 버튼 */}
        {isLongContent && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity"
            >
              <span>{expanded ? "간략히 접기" : "전체 내용 더보기"}</span>
              {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </button>
          </div>
        )}
      </div>

      {/* 첨부 이미지 목록이 있을 경우 표시 */}
      {pack.images && pack.images.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {pack.images.map((imgUrl, idx) => (
            <a
              key={idx}
              href={imgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 group"
            >
              <img
                src={imgUrl}
                alt="첨부파일"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <IconPhoto size={16} className="text-white" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
