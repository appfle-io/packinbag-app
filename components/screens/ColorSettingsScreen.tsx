"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { IconArrowLeft, IconCheck, IconBan } from "@tabler/icons-react";
import { useTheme, DEFAULT_CARD_COLOR_ID, FontScale } from "@/components/ThemeProvider";
import { ACCENT_PRESETS } from "@/lib/accentColors";
import ColorPickerPopover from "@/components/ColorPickerPopover";
import PercentSlider from "@/components/PercentSlider";

type Slot = "accent" | "bag" | "packGrid";

const fontScales: { key: FontScale; label: string; previewPx: number }[] = [
  { key: "sm", label: "작게", previewPx: 12 },
  { key: "md", label: "보통", previewPx: 13 },
  { key: "lg", label: "크게", previewPx: 14.5 },
];

// 투명도 변화를 눈으로 비교할 수 있도록 미리보기 뒤에 깔아주는 좌우 2색 배경.
// 왼쪽은 밝은 배경, 오른쪽은 살짝 어두운 배경이라 그 경계를 가로지르는 예시를
// 보면 투명도가 낮을수록 왼쪽/오른쪽 색이 다르게 비쳐 보이는 걸 바로 알 수 있다.
const SPLIT_BG: CSSProperties = {
  backgroundImage: "linear-gradient(to right, var(--background) 50%, var(--border-strong) 50%)",
};

function ColorSlotSection({
  title,
  description,
  selectedId,
  customHex,
  showDefaultOption,
  onSelectPreset,
  onOpenCustomPicker,
  opacityPct,
  onChangeOpacity,
  scalePct,
  onChangeScale,
  scaleLabel,
  preview,
}: {
  title: string;
  description: string;
  selectedId: string;
  customHex: string;
  showDefaultOption: boolean;
  onSelectPreset: (id: string) => void;
  onOpenCustomPicker: () => void;
  opacityPct?: number;
  onChangeOpacity?: (pct: number) => void;
  scalePct?: number;
  onChangeScale?: (pct: number) => void;
  scaleLabel?: string;
  preview?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <p className="text-[12px] text-text-secondary mb-2">{title}</p>
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {showDefaultOption && (
            <button
              onClick={() => onSelectPreset(DEFAULT_CARD_COLOR_ID)}
              aria-label="기본"
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border border-dashed border-border-strong bg-surface-2"
            >
              {selectedId === DEFAULT_CARD_COLOR_ID ? (
                <IconCheck size={14} stroke={2.5} color="var(--text-secondary)" />
              ) : (
                <IconBan size={14} stroke={1.75} color="var(--text-muted)" />
              )}
            </button>
          )}

          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset.id)}
              aria-label={preset.label}
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: preset.swatch }}
            >
              {selectedId === preset.id && (
                <IconCheck size={14} stroke={2.5} color="#fff" />
              )}
            </button>
          ))}

          <div className="w-px h-6 bg-border shrink-0 mx-0.5" />

          <div className="relative shrink-0">
            <button
              onClick={onOpenCustomPicker}
              aria-label="커스텀 색상 선택"
              className="h-8 w-8 rounded-full flex items-center justify-center"
              style={{
                background:
                  selectedId === "custom"
                    ? customHex
                    : "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
              }}
            >
              {selectedId === "custom" && (
                <IconCheck size={14} stroke={2.5} color="#fff" />
              )}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-text-muted mt-2.5">{description}</p>

        {opacityPct !== undefined && onChangeOpacity && (
          <PercentSlider
            label="투명도"
            value={opacityPct}
            min={0}
            max={100}
            step={5}
            onChange={onChangeOpacity}
          />
        )}

        {scalePct !== undefined && onChangeScale && (
          <PercentSlider
            label={scaleLabel ?? "크기"}
            value={scalePct}
            min={70}
            max={130}
            step={5}
            onChange={onChangeScale}
          />
        )}

        {preview}
      </div>
    </div>
  );
}

export default function ColorSettingsScreen({ onBack }: { onBack: () => void }) {
  const {
    fontScale,
    setFontScale,
    accentId,
    setAccent,
    customHex,
    setCustomAccent,
    bagColorId,
    setBagColor,
    bagCustomHex,
    setCustomBagColor,
    bagColorOpacity,
    setBagColorOpacity,
    bagCardScale,
    setBagCardScale,
    packGridColorId,
    setPackGridColor,
    packGridCustomHex,
    setCustomPackGridColor,
    packGridColorOpacity,
    setPackGridColorOpacity,
    packCardScale,
    setPackCardScale,
    baseOpacity,
    setBaseOpacity,
  } = useTheme();
  const [openPicker, setOpenPicker] = useState<Slot | null>(null);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">화면설정</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="mb-6">
          <p className="text-[12px] text-text-secondary mb-2">글자 크기</p>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {fontScales.map(({ key, label, previewPx }) => (
              <button
                key={key}
                onClick={() => setFontScale(key)}
                className="flex-1 py-2"
                style={{
                  background: fontScale === key ? "var(--accent)" : "var(--surface-2)",
                  color: fontScale === key ? "#fff" : "var(--foreground)",
                  fontSize: previewPx,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ColorSlotSection
          title="강조 색상"
          description="맨 오른쪽 원을 누르면 색상 팔레트나 헥스코드(#ffffff)로 직접 고를 수 있어요"
          selectedId={accentId}
          customHex={customHex}
          showDefaultOption={false}
          onSelectPreset={setAccent}
          onOpenCustomPicker={() => setOpenPicker("accent")}
          preview={
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                예시 버튼
              </button>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
              >
                D-3
              </span>
            </div>
          }
        />

        <div className="mb-6">
          <p className="text-[12px] text-text-secondary mb-2">기본 투명도</p>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-[11px] text-text-muted">
              하단 메뉴, 필터 버튼, 짐(체크항목·텍스트) 배경, 설정 메뉴의 선택 안 된 버튼
              배경 등에 공통으로 적용돼요
            </p>
            <PercentSlider
              label="투명도"
              value={Math.round(baseOpacity * 100)}
              min={0}
              max={100}
              step={5}
              onChange={(pct) => setBaseOpacity(pct / 100)}
            />
            <div className="mt-3 rounded-lg p-2" style={SPLIT_BG}>
              <div
                className="rounded-md px-3 py-2 text-[12px] text-text-secondary text-center"
                style={{ background: "var(--surface-2)" }}
              >
                예시 배경 (정렬 버튼, 짐 배경 등)
              </div>
            </div>
          </div>
        </div>

        <ColorSlotSection
          title="가방 그리드"
          description="가방 카드의 배경 톤을 바꿔요. 왼쪽 점선 원을 고르면 기본 배경으로 돌아가요"
          selectedId={bagColorId}
          customHex={bagCustomHex}
          showDefaultOption
          onSelectPreset={setBagColor}
          onOpenCustomPicker={() => setOpenPicker("bag")}
          opacityPct={Math.round(bagColorOpacity * 100)}
          onChangeOpacity={(pct) => setBagColorOpacity(pct / 100)}
          scalePct={Math.round(bagCardScale * 100)}
          onChangeScale={(pct) => setBagCardScale(pct / 100)}
          scaleLabel="가방 크기"
          preview={
            <div className="mt-3 rounded-lg p-2" style={SPLIT_BG}>
              <div
                className="rounded-xl border border-border shadow-sm flex flex-col gap-1 w-[136px] p-[calc(12px*var(--bag-card-scale,1))] md:p-[calc(16px*var(--bag-card-scale,1))]"
                style={{ background: "var(--bag-card-bg)" }}
              >
                <span className="text-[calc(13px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(14px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] font-medium">
                  예시 가방
                </span>
                <span className="text-[calc(11px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary">
                  전자기기, 세면도구
                </span>
              </div>
            </div>
          }
        />

        <ColorSlotSection
          title="팩 그리드"
          description="가방 안 팩 카드의 배경 톤을 바꿔요. 왼쪽 점선 원을 고르면 기본 배경으로 돌아가요"
          selectedId={packGridColorId}
          customHex={packGridCustomHex}
          showDefaultOption
          onSelectPreset={setPackGridColor}
          onOpenCustomPicker={() => setOpenPicker("packGrid")}
          opacityPct={Math.round(packGridColorOpacity * 100)}
          onChangeOpacity={(pct) => setPackGridColorOpacity(pct / 100)}
          scalePct={Math.round(packCardScale * 100)}
          onChangeScale={(pct) => setPackCardScale(pct / 100)}
          scaleLabel="팩 크기"
          preview={
            <div className="mt-3 rounded-lg p-2" style={SPLIT_BG}>
              <div
                className="rounded-xl border border-border shadow-sm flex flex-col gap-1 w-[136px] p-[calc(14px*var(--pack-card-scale,1))] md:p-[calc(20px*var(--pack-card-scale,1))]"
                style={{ background: "var(--pack-card-bg)" }}
              >
                <span className="text-[calc(17px*var(--pack-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(18px*var(--pack-card-scale,1)*var(--font-scale-factor,1))] font-medium truncate">
                  예시 팩
                </span>
                <span className="text-[calc(14px*var(--pack-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary">
                  2개
                </span>
              </div>
            </div>
          }
        />
      </div>

      {openPicker === "accent" && (
        <ColorPickerPopover
          initialHex={customHex}
          onChange={setCustomAccent}
          onClose={() => setOpenPicker(null)}
        />
      )}
      {openPicker === "bag" && (
        <ColorPickerPopover
          initialHex={bagCustomHex}
          onChange={setCustomBagColor}
          onClose={() => setOpenPicker(null)}
        />
      )}
      {openPicker === "packGrid" && (
        <ColorPickerPopover
          initialHex={packGridCustomHex}
          onChange={setCustomPackGridColor}
          onClose={() => setOpenPicker(null)}
        />
      )}
    </div>
  );
}
