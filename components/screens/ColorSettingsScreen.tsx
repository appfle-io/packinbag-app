"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { IconArrowLeft, IconCheck, IconBan, IconChevronDown } from "@tabler/icons-react";
import { useTheme, DEFAULT_CARD_COLOR_ID, FontScale } from "@/components/ThemeProvider";
import { useSwipeBack } from "@/lib/useSwipeBack";
import { ACCENT_PRESETS } from "@/lib/accentColors";
import ColorPickerPopover from "@/components/ColorPickerPopover";
import PercentSlider from "@/components/PercentSlider";
import { useAuth } from "@/contexts/AuthProvider";
import { isPremiumUser } from "@/lib/premiumLimits";
import PremiumLimitModal from "@/components/PremiumLimitModal";

type Slot = "accent" | "bag" | "packGrid" | "packLibrary";

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

// 제목은 항상 보이고, 탭하면 그 아래 내용이 펼쳐지는 공용 헤더 버튼.
// 세로 패딩과 구분선을 넣어서 터치 영역을 넉넉하게 확보하고, 연속된 섹션끼리도
// 시각적으로 구분되게 한다.
function SectionHeaderButton({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 border-b border-border"
    >
      <span className="text-[13px] text-text-secondary">{title}</span>
      <IconChevronDown
        size={16}
        stroke={1.75}
        color="var(--text-muted)"
        style={{
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 150ms ease",
        }}
      />
    </button>
  );
}

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
  defaultOpen,
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
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="mb-1">
      <SectionHeaderButton title={title} open={open} onToggle={() => setOpen((o) => !o)} />
      {open && (
      <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
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
      )}
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
    packLibraryColorId,
    setPackLibraryColor,
    packLibraryCustomHex,
    setCustomPackLibraryColor,
    packLibraryColorOpacity,
    setPackLibraryColorOpacity,
    packLibraryCardScale,
    setPackLibraryCardScale,
    baseOpacity,
    setBaseOpacity,
  } = useTheme();
  const [openPicker, setOpenPicker] = useState<Slot | null>(null);
  const [fontScaleOpen, setFontScaleOpen] = useState(true);
  const [baseOpacityOpen, setBaseOpacityOpen] = useState(true);
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  const { user, profile } = useAuth();
  const [showColorLimitModal, setShowColorLimitModal] = useState(false);

  // 헥사코드 직접입력(커스텀 색상 피커)은 프리미엄 전용 기능. 무료 사용자는 프리셋
  // 색상만 고를 수 있고, 커스텀 원을 눌러도 피커 대신 업그레이드 안내가 뜬다.
  const openCustomPicker = (slot: Slot) => {
    if (!isPremiumUser(user?.email, profile)) {
      setShowColorLimitModal(true);
      return;
    }
    setOpenPicker(slot);
  };

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">화면설정</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-6">
        <div className="mb-1">
          <SectionHeaderButton
            title="글자 크기"
            open={fontScaleOpen}
            onToggle={() => setFontScaleOpen((o) => !o)}
          />
          {fontScaleOpen && (
          <div className="mt-3 flex rounded-lg border border-border overflow-hidden">
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
          )}
        </div>

        <ColorSlotSection
          title="강조 색상"
          description="맨 오른쪽 원을 누르면 색상 팔레트나 헥스코드(#ffffff)로 직접 고를 수 있어요"
          selectedId={accentId}
          customHex={customHex}
          showDefaultOption={false}
          onSelectPreset={setAccent}
          onOpenCustomPicker={() => openCustomPicker("accent")}
          defaultOpen
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

        <div className="mb-1">
          <SectionHeaderButton
            title="기본 투명도"
            open={baseOpacityOpen}
            onToggle={() => setBaseOpacityOpen((o) => !o)}
          />
          {baseOpacityOpen && (
          <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
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
          )}
        </div>

        <h2 className="text-[14px] font-semibold mt-10 mb-3">가방</h2>

        <ColorSlotSection
          title="가방 카드"
          description="가방 카드의 배경 톤을 바꿔요. 왼쪽 점선 원을 고르면 기본 배경으로 돌아가요"
          selectedId={bagColorId}
          customHex={bagCustomHex}
          showDefaultOption
          onSelectPreset={setBagColor}
          onOpenCustomPicker={() => openCustomPicker("bag")}
          opacityPct={Math.round(bagColorOpacity * 100)}
          onChangeOpacity={(pct) => setBagColorOpacity(pct / 100)}
          scalePct={Math.round(bagCardScale * 100)}
          onChangeScale={(pct) => setBagCardScale(pct / 100)}
          scaleLabel="내용 크기"
          preview={
            <div className="mt-3 flex justify-center">
              {/* 실제 홈 화면의 grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 그리드에서
                  카드 한 칸이 차지하는 폭을 그대로 calc()로 계산해서 쓴다 (빈 칸을
                  채우는 방식 대신 폭 자체를 계산하면 가운데 정렬도 자연스럽게 된다). */}
              <div
                className="aspect-square rounded-xl border border-border shadow-sm flex flex-col p-[calc(12px*var(--bag-card-scale,1))] md:p-[calc(16px*var(--bag-card-scale,1))] w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2rem)/3)]"
                style={{ background: "var(--bag-card-bg)" }}
              >
                <div className="flex items-start justify-between gap-1.5 shrink-0">
                  <span className="text-[calc(13px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(14px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] font-medium">
                    예시 가방
                  </span>
                  <span
                    className="text-[calc(10px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(11px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] font-medium rounded-full px-1.5 py-0.5 shrink-0"
                    style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                  >
                    D-3
                  </span>
                </div>
                <p className="text-[calc(11px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary mt-1.5">
                  전자기기, 세면도구
                </p>
                <p className="text-[calc(11px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--bag-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary mt-auto">
                  0/12
                </p>
              </div>
            </div>
          }
        />

        <ColorSlotSection
          title="가방 속 팩카드"
          description="가방 안 팩 카드의 배경 톤을 바꿔요. 왼쪽 점선 원을 고르면 기본 배경으로 돌아가요"
          selectedId={packGridColorId}
          customHex={packGridCustomHex}
          showDefaultOption
          onSelectPreset={setPackGridColor}
          onOpenCustomPicker={() => openCustomPicker("packGrid")}
          opacityPct={Math.round(packGridColorOpacity * 100)}
          onChangeOpacity={(pct) => setPackGridColorOpacity(pct / 100)}
          scalePct={Math.round(packCardScale * 100)}
          onChangeScale={(pct) => setPackCardScale(pct / 100)}
          scaleLabel="카드 크기"
          preview={
            <div className="mt-3 flex justify-center">
              {/* 모바일에서는 실제처럼 폭 100%(세로 스택), md 이상에서는 실제 2열
                  그리드(grid-cols-2 gap-4)와 동일한 폭을 calc()로 계산해서 쓴다. */}
              <div
                className="rounded-xl border border-border shadow-sm flex flex-col p-[calc(14px*var(--pack-card-scale,1))] md:p-[calc(20px*var(--pack-card-scale,1))] w-full md:w-[calc((100%-1rem)/2)]"
                style={{ background: "var(--pack-card-bg)" }}
              >
                <span className="text-[calc(17px*var(--pack-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(18px*var(--pack-card-scale,1)*var(--font-scale-factor,1))] font-medium truncate">
                  예시 팩
                </span>
                <div className="flex flex-col justify-center gap-2 h-[calc(180px*var(--pack-card-scale,1))] md:h-[calc(228px*var(--pack-card-scale,1))] mt-1.5">
                  {["칫솔", "치약"].map((label) => (
                    <div key={label} className="flex items-center gap-2">
                      <span
                        className="shrink-0 rounded"
                        style={{
                          border: "1.5px solid var(--border-strong)",
                          width: "calc(18px*var(--pack-card-scale,1))",
                          height: "calc(18px*var(--pack-card-scale,1))",
                        }}
                      />
                      <span className="text-[calc(15px*var(--pack-card-scale,1)*var(--font-scale-factor,1))]">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="pt-2 mt-1.5 border-t border-border text-[calc(14px*var(--pack-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary shrink-0">
                  2개
                </p>
              </div>
            </div>
          }
        />

        <h2 className="text-[14px] font-semibold mt-4 mb-3">팩</h2>

        <ColorSlotSection
          title="팩 라이브러리 타일"
          description="팩 탭 목록의 타일 배경 톤을 바꿔요. 왼쪽 점선 원을 고르면 기본 배경으로 돌아가요"
          selectedId={packLibraryColorId}
          customHex={packLibraryCustomHex}
          showDefaultOption
          onSelectPreset={setPackLibraryColor}
          onOpenCustomPicker={() => openCustomPicker("packLibrary")}
          opacityPct={Math.round(packLibraryColorOpacity * 100)}
          onChangeOpacity={(pct) => setPackLibraryColorOpacity(pct / 100)}
          scalePct={Math.round(packLibraryCardScale * 100)}
          onChangeScale={(pct) => setPackLibraryCardScale(pct / 100)}
          scaleLabel="내용 크기"
          preview={
            <div className="mt-3 flex justify-center">
              <div
                className="aspect-square rounded-xl border border-border shadow-sm flex flex-col p-[calc(12px*var(--pack-library-card-scale,1))] md:p-[calc(16px*var(--pack-library-card-scale,1))] w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2rem)/3)]"
                style={{ background: "var(--pack-library-card-bg)" }}
              >
                <span className="text-[calc(13px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(14px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] font-medium">
                  예시 팩
                </span>
                <p className="text-[calc(11px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary mt-1.5">
                  칫솔, 치약
                </p>
                <p className="text-[calc(11px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] md:text-[calc(12px*var(--pack-library-card-scale,1)*var(--font-scale-factor,1))] text-text-secondary mt-auto">
                  2개
                </p>
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
      {openPicker === "packLibrary" && (
        <ColorPickerPopover
          initialHex={packLibraryCustomHex}
          onChange={setCustomPackLibraryColor}
          onClose={() => setOpenPicker(null)}
        />
      )}
      {showColorLimitModal && (
        <PremiumLimitModal
          message="헥사코드로 색상을 직접 입력하는 기능은 프리미엄 전용이에요. 무료에서는 프리셋 색상만 고를 수 있어요."
          onClose={() => setShowColorLimitModal(false)}
          onUnlocked={() => setShowColorLimitModal(false)}
        />
      )}
    </div>
  );
}
