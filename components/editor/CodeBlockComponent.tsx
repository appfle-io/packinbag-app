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
    <NodeViewWrapper className="code-block-wrapper relative my-3 rounded-xl border border-slate-700/60 bg-slate-900 text-slate-100 overflow-hidden shadow-sm select-text">
      {/* 상단 툴바 헤더 (언어 선택 & 복사 버튼) */}
      <div
        contentEditable={false}
        className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/50 text-[11.5px] select-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {isEditable ? (
          <div className="relative inline-flex items-center gap-1 group">
            <select
              value={currentLang}
              onChange={handleLanguageChange}
              onMouseDown={(e) => e.stopPropagation()}
              className="appearance-none bg-slate-700/70 hover:bg-slate-700 text-slate-200 font-mono text-[11px] font-semibold py-0.5 pl-2 pr-6 rounded-md cursor-pointer border border-slate-600/50 outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              title="코드 언어 선택"
              aria-label="코드 언어 선택"
            >
              {SUPPORTED_CODE_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-slate-900 text-slate-100">
                  {lang.label} ({lang.badge})
                </option>
              ))}
            </select>
            <IconChevronDown
              size={12}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        ) : (
          <span className="px-2 py-0.5 rounded bg-slate-700/70 text-slate-300 font-mono text-[10.5px] font-bold tracking-wider">
            {getLanguageBadge(currentLang)}
          </span>
        )}

        <button
          type="button"
          onClick={handleCopy}
          onMouseDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors cursor-pointer text-[11px]"
          title="코드 복사"
          aria-label="코드 복사"
        >
          {copied ? (
            <>
              <IconCheck size={13} className="text-emerald-400" />
              <span className="text-emerald-400 font-medium">복사됨</span>
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
