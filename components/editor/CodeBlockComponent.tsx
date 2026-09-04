"use client";

import React, { useState } from "react";
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { IconCopy, IconCheck, IconChevronDown } from "@tabler/icons-react";
import {
  SUPPORTED_CODE_LANGUAGES,
  normalizeLanguage,
  getLanguageBadge,
} from "@/lib/lowlightSetup";

export default function CodeBlockComponent({
  node,
  updateAttributes,
  extension,
  editor,
}: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const rawLang = node.attrs.language as string | undefined;
  const currentLang = normalizeLanguage(rawLang || extension.options.defaultLanguage);
  const isEditable = editor.isEditable;

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const text = node.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLang = e.target.value;
    updateAttributes({ language: nextLang });
  };

  return (
    <NodeViewWrapper className="code-block-wrapper relative my-3 rounded-xl border border-border/80 bg-surface-2/40 dark:bg-slate-900/90 text-foreground dark:text-slate-100 overflow-hidden shadow-xs select-text">
      {/* 상단 툴바 헤더 (언어 선택 & 복사 버튼) */}
      <div
        contentEditable={false}
        className="flex items-center justify-between px-3 py-1.5 bg-surface-2/80 dark:bg-slate-800/80 border-b border-border/70 dark:border-slate-700/50 text-[11.5px] select-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {isEditable ? (
          <div className="relative inline-flex items-center gap-1 group">
            <select
              value={currentLang}
              onChange={handleLanguageChange}
              onMouseDown={(e) => e.stopPropagation()}
              className="appearance-none bg-surface dark:bg-slate-700 text-foreground dark:text-slate-200 font-mono text-[11px] font-semibold py-0.5 pl-2 pr-6 rounded-md cursor-pointer border border-border dark:border-slate-600/60 outline-none focus:ring-1 focus:ring-accent transition-colors"
              title="코드 언어 선택"
              aria-label="코드 언어 선택"
            >
              {SUPPORTED_CODE_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-surface dark:bg-slate-900 text-foreground dark:text-slate-100">
                  {lang.label} ({lang.badge})
                </option>
              ))}
            </select>
            <IconChevronDown
              size={12}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted dark:text-slate-400 pointer-events-none"
            />
          </div>
        ) : (
          <span className="px-2 py-0.5 rounded bg-surface dark:bg-slate-700/70 text-text-secondary dark:text-slate-300 font-mono text-[10.5px] font-bold tracking-wider border border-border/60 dark:border-transparent">
            {getLanguageBadge(currentLang)}
          </span>
        )}

        <button
          type="button"
          onClick={handleCopy}
          onMouseDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-text-secondary dark:text-slate-400 hover:text-foreground dark:hover:text-slate-200 hover:bg-surface dark:hover:bg-slate-700/50 transition-colors cursor-pointer text-[11px]"
          title="코드 복사"
          aria-label="코드 복사"
        >
          {copied ? (
            <>
              <IconCheck size={13} className="text-emerald-500 dark:text-emerald-400" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">복사됨</span>
            </>
          ) : (
            <>
              <IconCopy size={13} />
              <span>복사</span>
            </>
          )}
        </button>
      </div>

      {/* 코드 본문 */}
      <pre className="p-3 text-[13px] font-mono leading-relaxed overflow-x-auto whitespace-pre bg-transparent m-0">
        <NodeViewContent as="code" className={`hljs language-${currentLang}`} />
      </pre>
    </NodeViewWrapper>
  );
}
