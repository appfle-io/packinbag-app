"use client";

import { useState } from "react";
import {
  IconFileText,
  IconBold,
  IconItalic,
  IconListCheck,
  IconTable,
  IconLink,
  IconPhoto,
} from "@tabler/icons-react";

import Portal from "@/components/Portal";

export default function GuideMemoDemo() {
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [memoTitle, setMemoTitle] = useState("도쿄 3박4일 여행 일정 & 맛집");
  const [memoContent, setMemoContent] = useState(
    "Day 1: 나리타 공항 도착 (14:15)\n- N'EX 타고 신주쿠역 이동\n- 저녁: 신주쿠 츠케멘 (현금 결제)\n- 도쿄도청 전망대 야경 관람"
  );

  return (
    <div className="w-full flex flex-col gap-2.5 select-none">
      <div className="p-3.5 rounded-2xl bg-white dark:bg-surface border border-border flex flex-col gap-2.5">
        {/* 메모팩 카드 */}
        <div
          onClick={() => setShowEditorModal(true)}
          className="rounded-xl border border-border bg-white dark:bg-surface-2 hover:border-accent/60 p-4 transition-all cursor-pointer flex flex-col gap-2.5 shadow-xs"
        >
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-1.5 font-bold text-[13.5px] text-foreground">
              <IconFileText size={16} className="text-accent" />
              <span>{memoTitle}</span>
            </div>
            <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-accent-soft text-accent font-medium">
              터치하여 편집
            </span>
          </div>

          <p className="text-[12px] text-text-secondary line-clamp-2 leading-relaxed">
            {memoContent}
          </p>

          <div className="pt-1 flex items-center justify-between text-[11px] text-text-muted">
            <span>서식 · 표 · 링크 지원</span>
            <span className="text-accent font-medium">편집창 열기 &rarr;</span>
          </div>
        </div>
      </div>

      {/* 실제 메모팩 에디터 팝업 모달 */}
      {showEditorModal && (
        <Portal>
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => setShowEditorModal(false)}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-surface p-4 border border-border shadow-2xl flex flex-col gap-3 max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="font-semibold text-[14px] text-foreground">메모팩 에디터</span>
                <button
                  type="button"
                  onClick={() => setShowEditorModal(false)}
                  className="text-text-muted hover:text-foreground text-[12px] p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* 에디터 툴바 */}
              <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-lg border border-border overflow-x-auto">
                <button type="button" className="p-1.5 rounded hover:bg-surface text-text-secondary cursor-pointer" title="굵게">
                  <IconBold size={15} />
                </button>
                <button type="button" className="p-1.5 rounded hover:bg-surface text-text-secondary cursor-pointer" title="기울임">
                  <IconItalic size={15} />
                </button>
                <div className="h-4 w-[1px] bg-border mx-1" />
                <button type="button" className="p-1.5 rounded hover:bg-surface text-text-secondary cursor-pointer" title="체크리스트">
                  <IconListCheck size={15} />
                </button>
                <button type="button" className="p-1.5 rounded hover:bg-surface text-text-secondary cursor-pointer" title="표(테이블)">
                  <IconTable size={15} />
                </button>
                <button type="button" className="p-1.5 rounded hover:bg-surface text-text-secondary cursor-pointer" title="링크 추가">
                  <IconLink size={15} />
                </button>
                <button type="button" className="p-1.5 rounded hover:bg-surface text-text-secondary cursor-pointer" title="사진">
                  <IconPhoto size={15} />
                </button>
              </div>

              {/* 제목 입력 */}
              <input
                type="text"
                value={memoTitle}
                onChange={(e) => setMemoTitle(e.target.value)}
                placeholder="메모 제목"
                className="w-full text-[15px] font-bold bg-transparent outline-none border-b border-border pb-2 text-foreground"
              />

              {/* 본문 텍스트 영역 */}
              <textarea
                value={memoContent}
                onChange={(e) => setMemoContent(e.target.value)}
                rows={6}
                className="w-full text-[13px] bg-surface-2/50 rounded-lg p-2.5 outline-none border border-border resize-none leading-relaxed text-foreground"
              />

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditorModal(false)}
                  className="flex-1 rounded-xl py-2 text-[13px] text-white font-medium shadow-xs bg-accent cursor-pointer"
                >
                  저장 완료
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
