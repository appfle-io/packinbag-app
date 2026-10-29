"use client";

import { useMemo, useState } from "react";
import { IconCheck, IconChevronDown, IconChevronUp, IconCopy } from "@tabler/icons-react";
import type { Pack } from "@/lib/types";
import { collectEditorDocRichBlocks, type RichBlock } from "@/lib/editorDocPreview";
import { extractCleanFormattedText } from "@/lib/editorDocTextExport";
import MemoRichTextView from "@/components/MemoRichTextView";
import { Button } from "@/components/v2/ui";
import { PhotoViewer } from "@/components/v2/bag/PhotoViewer";

// 공유 보기 안의 메모(가방 메모 · 폴더 공유 속 메모) v2(2026-10-15). 다섯 덩어리까지 보이고 "전체 보기"로 펼친다
// 사진은 크게 보기만(저장 · 새 탭 · 길게 눌러 저장 없음, 2026-10-29 — 남이 올린 사진은 보기만과 같은 기준)
export function GuestMemoBlock({ pack }: { pack: Pack }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const blocks = useMemo<RichBlock[]>(() => {
    if (pack.editorDoc) {
      const b = collectEditorDocRichBlocks(pack.editorDoc);
      if (b.length > 0) return b;
    }
    return (pack.editorPreviewText ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line): RichBlock => ({ type: "paragraph", spans: [{ text: line }] }));
  }, [pack.editorDoc, pack.editorPreviewText]);
  const fullText = useMemo(() => extractCleanFormattedText(pack), [pack]);
  const long = blocks.length > 5 || fullText.length > 200;
  const shown = long && !expanded ? blocks.slice(0, 5) : blocks;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="flex flex-col gap-2">
      {shown.length === 0 ? (
        <p className="m-0 py-2 text-caption text-faint">적힌 내용이 없어요</p>
      ) : (
        <div className="text-body">
          <MemoRichTextView blocks={shown} />
        </div>
      )}
      {(pack.images?.length ?? 0) > 0 && (
        <div className="pib-v2-no-scrollbar flex gap-2 overflow-x-auto py-1">
          {pack.images!.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setViewing(i)}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={`사진 ${i + 1} 크게 보기`}
              className="size-16 shrink-0 overflow-hidden rounded-field bg-fill"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 공유한 사람 저장소의 사진 */}
              <img src={url} alt="첨부 사진" draggable={false} className="pib-v2-no-callout size-full select-none object-cover" />
            </button>
          ))}
        </div>
      )}
      {viewing !== null && pack.images && (
        <PhotoViewer images={pack.images} index={viewing} onClose={() => setViewing(null)} onNavigate={setViewing} canSave={false} />
      )}
      <div className="flex items-center gap-1">
        {long && (
          <Button
            variant="text"
            size="sm"
            className="px-2"
            onClick={() => setExpanded((v) => !v)}
            leading={expanded ? <IconChevronUp size={16} stroke={2} /> : <IconChevronDown size={16} stroke={2} />}
          >
            {expanded ? "접기" : "전체 보기"}
          </Button>
        )}
        {fullText.trim() && (
          <Button
            variant="text"
            size="sm"
            className="px-2 text-sub"
            onClick={copy}
            leading={copied ? <IconCheck size={16} stroke={2} /> : <IconCopy size={16} stroke={1.75} />}
          >
            {copied ? "복사했어요" : "복사"}
          </Button>
        )}
      </div>
    </div>
  );
}
