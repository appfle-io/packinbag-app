"use client";

import { useState } from "react";
import {
  IconLink,
  IconCopy,
  IconCheck,
  IconEye,
  IconPencil,
  IconSparkles,
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
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === "short"
              ? "bg-surface text-foreground shadow-2xs font-semibold"
              : "text-text-muted hover:text-foreground"
          }`}
        >
          <IconLink size={14} className={activeTab === "short" ? "text-accent" : ""} />
          <span>Short URL (단축 링크)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("custom")}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === "custom"
              ? "bg-surface text-foreground shadow-2xs font-semibold"
              : "text-text-muted hover:text-foreground"
          }`}
        >
          <IconSparkles size={14} className={activeTab === "custom" ? "text-accent" : ""} />
          <span>Custom URL (나만의 별칭)</span>
        </button>
      </div>

      {activeTab === "short" && (
        <div className="p-3.5 rounded-2xl border border-border/80 bg-surface-2 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-foreground">복잡하고 긴 링크 1초 단축</span>
          </div>

          <p className="text-[11.5px] text-text-secondary leading-relaxed">
            쇼핑몰, 예약 사이트, 티켓 링크 등 길고 복잡한 URL을 깔끔하고 안전한 단축 링크로 변환하여 짐이나 메모에 쏙 담을 수 있습니다.
          </p>

          <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-surface border border-border shadow-xs text-[12px]">
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
        <div className="p-3.5 rounded-2xl border border-border/80 bg-surface-2 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-foreground">기억하기 쉬운 나만의 고유 별칭 링크</span>
          </div>

          <p className="text-[11.5px] text-text-secondary leading-relaxed">
            원하는 단어(예: hawaii2026, pos-wbs)로 직관적인 맞춤 URL을 생성하고, 누적 클릭 수 확인 및 언제든 이동할 목적지 링크를 변경할 수 있습니다.
          </p>

          <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-surface border border-border shadow-xs text-[12px]">
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
