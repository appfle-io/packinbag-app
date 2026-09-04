"use client";

import Portal from "@/components/Portal";

import { useMemo, useState } from "react";
import { IconSparkles, IconX } from "@tabler/icons-react";
import {
  SAMPLE_BAG_TEMPLATES,
  SAMPLE_CATEGORIES,
  SampleCategory,
  sampleItemCount,
} from "@/lib/sampleBags";
import { ImportedBagResult } from "@/lib/types";
import AiHashtagModal from "@/components/AiHashtagModal";
import { OverlayLayerProvider, useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { useAuth } from "@/contexts/AuthProvider";

export default function SampleBagSheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (result: ImportedBagResult) => void;
}) {
  const { isOfflineMode } = useAuth();
  const [category, setCategory] = useState<SampleCategory | "all">("all");
  const [showAiHashtag, setShowAiHashtag] = useState(false);
  const ambientLayer = useOverlayLayer();
  const resolvedZIndex = ambientLayer + POPOVER_OFFSET;
  useEscapeToClose(onClose);

  const filtered = useMemo(
    () =>
      category === "all"
        ? SAMPLE_BAG_TEMPLATES
        : SAMPLE_BAG_TEMPLATES.filter((t) => t.category === category),
    [category]
  );

  return (
    <Portal>
      <OverlayLayerProvider value={resolvedZIndex}>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: resolvedZIndex, background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md max-h-[80vh] rounded-2xl bg-surface p-4 flex flex-col gap-3 overflow-hidden"
        >
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[16px] font-medium">샘플로 시작하기</span>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <button
              onClick={() => setCategory("all")}
              className="shrink-0 rounded-full px-3 py-1.5 text-[12px]"
              style={{
                background: category === "all" ? "var(--accent)" : "var(--surface-2)",
                color: category === "all" ? "#fff" : "var(--foreground)",
              }}
            >
              전체
            </button>
            {SAMPLE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className="shrink-0 rounded-full px-3 py-1.5 text-[12px]"
                style={{
                  background: category === c.id ? "var(--accent)" : "var(--surface-2)",
                  color: category === c.id ? "#fff" : "var(--foreground)",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            <div className="grid grid-cols-2 gap-2.5 pb-1">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="flex flex-col items-start gap-1 rounded-xl border border-border p-3 text-left"
                >
                  <span className="text-[22px]">{t.icon}</span>
                  <span className="text-[13px] font-medium">{t.title}</span>
                  <span className="text-[11px] text-text-muted">
                    짐 {sampleItemCount(t)}개
                  </span>
                </button>
              ))}
            </div>
          </div>

          {!isOfflineMode && (
            <button
              onClick={() => setShowAiHashtag(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-medium shrink-0"
              style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
            >
              <IconSparkles size={15} stroke={1.75} />
              원하는 게 없나요? 해시태그로 AI에게 만들어달라기
            </button>
          )}
        </div>
      </div>

      {!isOfflineMode && showAiHashtag && (
        <AiHashtagModal
          onClose={() => setShowAiHashtag(false)}
          onResult={(result) => {
            setShowAiHashtag(false);
            onSelect(result);
          }}
        />
      )}
      </OverlayLayerProvider>
    </Portal>
  );
}
