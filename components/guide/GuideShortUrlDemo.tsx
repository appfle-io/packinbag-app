"use client";

import { useState } from "react";
import {
  IconCopy,
  IconCheck,
  IconEye,
  IconPencil,
} from "@tabler/icons-react";

type UrlTab = "short" | "custom";

export default function GuideShortUrlDemo() {
  const [activeTab, setActiveTab] = useState<UrlTab>("short");
  const [copied, setCopied] = useState(false);
  const [customAlias, setCustomAlias] = useState("hawaii2026");

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      {/* 서브 탭 */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface-2/60 border border-border/40 text-[12px]">
        <button
          type="button"
          onClick={() => setActiveTab("short")}
          className={`flex items-center justify-center py-2 px-2 rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === "short"
              ? "bg-surface text-accent shadow-xs font-bold"
              : "text-text-muted hover:text-foreground"
          }`}
        >
          <span>Short URL (단축 링크)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("custom")}
          className={`flex items-center justify-center py-2 px-2 rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === "custom"
              ? "bg-surface text-accent shadow-xs font-bold"
              : "text-text-muted hover:text-foreground"
          }`}
        >
          <span>Custom URL (나만의 별칭)</span>
        </button>
      </div>

      {activeTab === "short" && (
        <div className="p-3.5 rounded-2xl border border-border bg-white dark:bg-surface flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-foreground">긴 링크 1초 단축</span>
          </div>

          <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-white dark:bg-surface-2 border border-border shadow-xs text-[12px]">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-muted">원본 링크 (긴 URL)</span>
              <div className="p-2 rounded-md bg-surface-2 border border-border text-[11px] font-mono text-text-secondary truncate">
                https://smartstore.naver.com/item/products/9876543210?param=travel_ready
              </div>
            </div>

            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[11px] font-medium text-text-muted">생성된 Short URL</span>
              <div className="flex items-center justify-between p-2 rounded-md bg-surface-2 border border-border">
                <span className="text-[12px] font-mono font-semibold text-accent truncate">
                  packinbag.app/s/8k2f
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                    copied
                      ? "bg-accent text-white shadow-2xs"
                      : "bg-surface hover:bg-surface-2 border border-border text-foreground shadow-2xs"
                  }`}
                >
                  {copied ? <IconCheck size={12} stroke={2.5} /> : <IconCopy size={12} />}
                  <span>{copied ? "복사 완료" : "복사"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "custom" && (
        <div className="p-3.5 rounded-2xl border border-border bg-white dark:bg-surface flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-foreground">나만의 고유 별칭 링크</span>
          </div>

          <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-white dark:bg-surface-2 border border-border shadow-xs text-[12px]">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-muted">커스텀 별칭 입력</span>
              <div className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-md bg-surface-2 border border-border">
                <span className="text-[12px] text-text-muted font-mono">packinbag.app/c/</span>
                <input
                  type="text"
                  value={customAlias}
                  onChange={(e) => setCustomAlias(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="alias"
                  className="flex-1 text-[12px] font-mono font-semibold text-accent outline-none bg-transparent"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-md bg-surface-2 border border-border flex items-center justify-between text-[11.5px]">
              <div className="flex items-center gap-1.5 text-text-secondary">
                <IconEye size={14} className="text-accent" />
                <span>누적 클릭 수: <strong className="text-foreground font-semibold font-mono">142회</strong></span>
              </div>
              <div className="flex items-center gap-1 text-text-muted">
                <IconPencil size={13} />
                <span>목적지 URL 상시 수정 가능</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
