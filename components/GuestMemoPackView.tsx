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
import {
  collectEditorDocRichBlocks,
  RichBlock,
} from "@/lib/editorDocPreview";
import MemoRichTextView from "./MemoRichTextView";
import { extractCleanFormattedText } from "@/lib/editorDocTextExport";

export default function GuestMemoPackView({
  pack,
  className,
}: {
  pack: Pack;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // TipTap JSON 구조(editorDoc)에서 리치 블록 파싱, 없으면 editorPreviewText를 기반으로 생성
  const richBlocks = useMemo(() => {
    if (pack.editorDoc) {
      const b = collectEditorDocRichBlocks(pack.editorDoc);
      if (b.length > 0) return b;
    }
    if (pack.editorPreviewText) {
      return pack.editorPreviewText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((line): RichBlock => ({
          type: "paragraph",
          spans: [{ text: line }],
        }));
    }
    return [];
  }, [pack.editorDoc, pack.editorPreviewText]);

  const fullText = useMemo(() => {
    return extractCleanFormattedText(pack);
  }, [pack]);

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

  const isLongContent = richBlocks.length > 5 || fullText.length > 200;
  const displayedBlocks = isLongContent && !expanded ? richBlocks.slice(0, 5) : richBlocks;

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
        {displayedBlocks.length === 0 ? (
          <p className="text-[13px] text-slate-400 italic py-1">작성된 메모 내용이 없어요</p>
        ) : (
          <MemoRichTextView blocks={displayedBlocks} className={className} />
        )}

        {/* 5줄 초과 시 접힘 페이드 & 더보기 버튼 */}
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
