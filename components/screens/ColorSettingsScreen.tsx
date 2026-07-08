"use client";

import { useState } from "react";
import { IconArrowLeft, IconCheck, IconBan } from "@tabler/icons-react";
import { useTheme, DEFAULT_CARD_COLOR_ID } from "@/components/ThemeProvider";
import { ACCENT_PRESETS } from "@/lib/accentColors";
import ColorPickerPopover from "@/components/ColorPickerPopover";

type Slot = "accent" | "bag" | "packGrid";

function ColorSlotSection({
  title,
  description,
  selectedId,
  customHex,
  showDefaultOption,
  onSelectPreset,
  onOpenCustomPicker,
}: {
  title: string;
  description: string;
  selectedId: string;
  customHex: string;
  showDefaultOption: boolean;
  onSelectPreset: (id: string) => void;
  onOpenCustomPicker: () => void;
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
      </div>
    </div>
  );
}

export default function ColorSettingsScreen({ onBack }: { onBack: () => void }) {
  const {
    accentId,
    setAccent,
    customHex,
    setCustomAccent,
    bagColorId,
    setBagColor,
    bagCustomHex,
    setCustomBagColor,
    packGridColorId,
    setPackGridColor,
    packGridCustomHex,
    setCustomPackGridColor,
  } = useTheme();
  const [openPicker, setOpenPicker] = useState<Slot | null>(null);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">색상</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <ColorSlotSection
          title="강조 색상"
          description="맨 오른쪽 원을 누르면 색상 팔레트나 헥스코드(#ffffff)로 직접 고를 수 있어요"
          selectedId={accentId}
          customHex={customHex}
          showDefaultOption={false}
          onSelectPreset={setAccent}
          onOpenCustomPicker={() => setOpenPicker("accent")}
        />

        <ColorSlotSection
          title="가방 색상"
          description="가방 카드의 배경 톤을 바꿔요. 왼쪽 점선 원을 고르면 기본 배경으로 돌아가요"
          selectedId={bagColorId}
          customHex={bagCustomHex}
          showDefaultOption
          onSelectPreset={setBagColor}
          onOpenCustomPicker={() => setOpenPicker("bag")}
        />

        <ColorSlotSection
          title="팩 그리드 색상"
          description="가방 안 팩 카드의 배경 톤을 바꿔요. 왼쪽 점선 원을 고르면 기본 배경으로 돌아가요"
          selectedId={packGridColorId}
          customHex={packGridCustomHex}
          showDefaultOption
          onSelectPreset={setPackGridColor}
          onOpenCustomPicker={() => setOpenPicker("packGrid")}
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
