"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconPackage,
  IconCopy,
  IconCheck,
  IconArrowRight,
  IconNotes,
  IconPlus,
} from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import MemoDocViewer from "@/components/MemoDocViewer";

interface GuestMemoArticleViewProps {
  pack: Pack;
  token: string;
}

export default function GuestMemoArticleView({ pack, token }: GuestMemoArticleViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyText = async () => {
    const text = pack.editorPreviewText || pack.name;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <main className="h-screen w-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* 상단 미니멀 브랜드 헤더 */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <IconNotes size={16} />
            </div>
            <span className="font-bold text-[15px] tracking-tight">PackInBag</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[12.5px] font-medium text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              {copied ? <IconCheck size={14} className="text-emerald-500" /> : <IconCopy size={14} />}
              <span>{copied ? "복사됨" : "본문 복사"}</span>
            </button>

            <Link
              href={`/?importPack=${token}`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold transition-colors shadow-xs"
            >
              <IconPlus size={14} stroke={2.5} />
              <span>내 가방에 담기</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 중앙 아티클 문서 영역 (시원한 max-w-4xl 폭 적용) */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 flex flex-col gap-5 pb-32">
        {/* 문서 헤더 카드 */}
        <div className="flex flex-col gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              메모팩 문서
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {pack.name || "제목 없는 메모"}
          </h1>
        </div>

        {/* 문서 본문 서식 렌더러 (TipTap Rich Document) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-sm">
          <MemoDocViewer pack={pack} />
        </div>
      </div>

      {/* 하단 플로팅 바 */}
      <footer className="fixed bottom-0 inset-x-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <IconPackage size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold truncate text-slate-900 dark:text-white">
                {pack.name}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                팩인백에서 나만의 여행 짐과 메모를 관리해보세요
              </p>
            </div>
          </div>

          <Link
            href={`/?importPack=${token}`}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold transition-all shrink-0 shadow-sm"
          >
            <span>내 팩으로 가져오기</span>
            <IconArrowRight size={15} />
          </Link>
        </div>
      </footer>
    </main>
  );
}
