"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { IconArrowLeft, IconCheck, IconBan, IconChevronDown, IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react";
import {
  useTheme,
  DEFAULT_CARD_COLOR_ID,
  FontScale,
  ThemeMode,
  PACK_CARD_SCALE_BASE,
  PACK_CARD_FONT_SCALE_BASE,
} from "@/components/ThemeProvider";
import { useSwipeBack } from "@/lib/useSwipeBack";
import { ACCENT_PRESETS } from "@/lib/accentColors";
import ColorPickerPopover from "@/components/ColorPickerPopover";
import PercentSlider from "@/components/PercentSlider";
import { useAuth } from "@/contexts/AuthProvider";
import { isPremiumUser } from "@/lib/premiumLimits";
import PremiumLimitModal from "@/components/PremiumLimitModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import BagCard from "@/components/BagCard";
import PackCard from "@/components/PackCard";
import type { Bag, Item, Pack, UserProfile } from "@/lib/types";
import { useCanUse3Cols } from "@/lib/useCanUse3Cols";

type Slot = "accent" | "bag" | "packGrid";

const themeModes: { key: ThemeMode; label: string; icon: typeof IconSun }[] = [
  { key: "system", label: "시스템", icon: IconDeviceDesktop },
  { key: "light", label: "라이트", icon: IconSun },
  { key: "dark", label: "다크", icon: IconMoon },
];

// 각 버튼이 실제로 그 크기로 보이는 시각적 미리보기 - 눌러보기 전에 얼마나
// 커지고 작아지는지 바로 눈으로 확인할 수 있다.
const fontScales: { key: FontScale; label: string; previewPx: number }[] = [
  { key: "sm", label: "작게", previewPx: 12 },
  { key: "md", label: "보통", previewPx: 13 },
  { key: "lg", label: "크게", previewPx: 14.5 },
];

// 라벨 옆에 붙는 작은 드롭다운 공통 스타일 (팩 설정/가방 설정 화면과 동일한 패턴)
const selectClassName = "shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[13px] outline-none";
const selectStyle: CSSProperties = { background: "var(--surface-2)", color: "var(--foreground)" };

const bagCardSizes: { key: NonNullable<UserProfile["bagCardSize"]>; label: string }[] = [
  { key: "large", label: "1열" },
  { key: "medium", label: "2열" },
  { key: "small", label: "3열" },
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
  scaleMin,
  scaleMax,
  // 카드 크기와 별도로 "글씨 크기"를 독립적으로 조절해야 하는 섹션에서만 쓰는
  // 두 번째 슬라이더. 없으면 렌더링하지 않는다.
  scale2Pct,
  onChangeScale2,
  scale2Label,
  scale2Min,
  scale2Max,
  preview,
  defaultOpen,
  // description 문구 바로 아래, 투명도/크기 슬라이더들 위에 끼워넣을 추가 컨트롤.
  // 가방 보관함 섹션의 "그리드 밀도(작게/보통/크게)" 선택박스처럼, 이 섹션에 속하지만
  // 프리셋 색상 선택과는 성격이 다른 컨트롤을 같은 접이식 카드 안에 묶을 때 쓴다.
  extraContent,
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
  scaleMin?: number;
  scaleMax?: number;
  scale2Pct?: number;
  onChangeScale2?: (pct: number) => void;
  scale2Label?: string;
  scale2Min?: number;
  scale2Max?: number;
  preview?: ReactNode;
  defaultOpen?: boolean;
  extraContent?: ReactNode;
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

        {extraContent}

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
            min={scaleMin ?? 70}
            max={scaleMax ?? 130}
            step={5}
            onChange={onChangeScale}
          />
        )}

        {scale2Pct !== undefined && onChangeScale2 && (
          <PercentSlider
            label={scale2Label ?? "글씨 크기"}
            value={scale2Pct}
            min={scale2Min ?? 70}
            max={scale2Max ?? 130}
            step={5}
            onChange={onChangeScale2}
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
    mode,
    setMode,
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
    bagCardFontScale,
    setBagCardFontScale,
    packGridColorId,
    setPackGridColor,
    packGridCustomHex,
    setCustomPackGridColor,
    packGridColorOpacity,
    setPackGridColorOpacity,
    packCardScale,
    setPackCardScale,
    packCardFontScale,
    setPackCardFontScale,
    baseOpacity,
    setBaseOpacity,
    resetThemeSettings,
  } = useTheme();
  const { show } = useToast();
  const [openPicker, setOpenPicker] = useState<Slot | null>(null);
  const [fontScaleOpen, setFontScaleOpen] = useState(true);
  const [baseOpacityOpen, setBaseOpacityOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  const { user, profile, updateBagCardSize } = useAuth();
  const canUse3Cols = useCanUse3Cols();
  const [showColorLimitModal, setShowColorLimitModal] = useState(false);

  // 화면 설정 미리보기용 예시 가방
  const sampleBag: Bag = {
    id: "preview-bag",
    name: "제주도 3박 4일 여행",
    travelDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    ddayCountTodayAsDayOne: false,
    images: [],
    memberIds: ["preview-user"],
    ownerId: "preview-user",
    inviteCode: "PREVIEW",
    createdAt: "",
    updatedAt: "",
    packs: [
      {
        id: "p1",
        name: "전자기기",
        items: [
          { id: "i1", type: "check", text: "보조배터리", checked: true },
          { id: "i2", type: "check", text: "충전 케이블", checked: false },
        ],
      },
      {
        id: "p2",
        name: "세면도구",
        items: [
          { id: "i3", type: "check", text: "칫솔/치약", checked: true },
          { id: "i4", type: "check", text: "선크림", checked: false },
        ],
      },
    ],
  };

  // 화면 설정 미리보기용 예시 팩 상태 및 인터랙션 핸들러
  const [samplePackItems, setSamplePackItems] = useState<Item[]>([
    { id: "preview-item-1", type: "check", text: "칫솔 및 치약", checked: true },
    { id: "preview-item-2", type: "check", text: "보조배터리", checked: false },
    { id: "preview-item-3", type: "text", text: "호텔 체크인 시간 확인하기" },
  ]);
  const [samplePackDisplayState, setSamplePackDisplayState] = useState<"normal" | "wide" | "collapsed">("normal");

  const samplePack: Pack = {
    id: "preview-pack",
    name: "여행 필수품",
    items: samplePackItems,
    displayState: samplePackDisplayState,
  };

  const handleToggleSampleItem = (itemId: string) => {
    setSamplePackItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleToggleAllSampleItems = (checked: boolean) => {
    setSamplePackItems((prev) =>
      prev.map((item) => (item.type === "check" ? { ...item, checked } : item))
    );
  };

  const handleChangeSampleItemText = (
    itemId: string,
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string }
  ) => {
    setSamplePackItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              text,
              bold: style?.bold ?? item.bold,
              strike: style?.strike ?? item.strike,
              color: style?.color !== undefined ? style.color : item.color,
            }
          : item
      )
    );
  };

  // 헥사코드 직접입력(커스텀 색상 피커)은 프리미엄 전용 기능. 무료 사용자는 프리셋
  // 색상만 고를 수 있고, 커스텀 원을 눌러도 피커 대신 업그레이드 안내가 뜬다.
  const openCustomPicker = (slot: Slot) => {
    if (!isPremiumUser(user?.email, profile)) {
      setShowColorLimitModal(true);
      return;
    }
    setOpenPicker(slot);
  };

  const handleReset = () => {
    resetThemeSettings();
    updateBagCardSize("medium").catch(() => {});
    setConfirmReset(false);
    show("화면 설정이 기본값으로 초기화되었어요");
  };

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1" aria-label="뒤로가기">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">화면설정</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-6">
        <div className="mb-4">
          <p className="text-[12px] font-medium text-text-secondary mb-2">화면 모드</p>
          <div className="flex rounded-lg border border-border overflow-hidden bg-surface-2 p-0.5 gap-1">
            {themeModes.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className="flex-1 py-1.5 flex items-center justify-center gap-1.5 text-[12px] font-medium rounded-md transition-colors"
                style={{
                  background: mode === key ? "var(--surface)" : "transparent",
                  color: mode === key ? "var(--foreground)" : "var(--text-muted)",
                  boxShadow: mode === key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <Icon size={14} stroke={1.75} />
                {label}
              </button>
            ))}
          </div>
        </div>

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
          preview={
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-[12px] font-medium"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                예시 버튼
              </button>
              <span
                className="rounded-md px-2.5 py-1 text-[11px] font-medium"
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
          title="가방 보관함"
          description="가방 카드의 배경 톤을 바꿔요. 왼쪽 점선 원을 고르면 기본 배경으로 돌아가요"
          extraContent={
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-text-secondary">
                  그리드 열 수 {canUse3Cols ? "(1열 / 2열 / 3열)" : "(1열 / 2열)"}
                </p>
                <p className="text-[11px] text-text-muted mt-1">
                  {canUse3Cols
                    ? "가방 보관함에서 한 줄에 보여줄 카드의 열 수를 설정해요 (1열 / 2열 / 3열)."
                    : "화면 폭 550px 미만의 스마트폰에서는 최적의 가독성을 위해 1열과 2열만 제공돼요."}
                </p>
              </div>
              <select
                value={!canUse3Cols && profile?.bagCardSize === "small" ? "medium" : profile?.bagCardSize ?? "medium"}
                onChange={(e) => updateBagCardSize(e.target.value as NonNullable<UserProfile["bagCardSize"]>).catch(() => {})}
                aria-label="가방 보관함 그리드 열 수"
                className={selectClassName}
                style={selectStyle}
              >
                {(canUse3Cols ? bagCardSizes : bagCardSizes.filter((s) => s.key !== "small")).map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          }
          selectedId={bagColorId}
          customHex={bagCustomHex}
          showDefaultOption
          onSelectPreset={setBagColor}
          onOpenCustomPicker={() => openCustomPicker("bag")}
          opacityPct={Math.round(bagColorOpacity * 100)}
          onChangeOpacity={(pct) => setBagColorOpacity(pct / 100)}
          scalePct={Math.round(bagCardScale * 100)}
          onChangeScale={(pct) => setBagCardScale(pct / 100)}
          scaleLabel="카드 여백"
          scaleMax={130}
          scale2Pct={Math.round(bagCardFontScale * 100)}
          onChangeScale2={(pct) => setBagCardFontScale(pct / 100)}
          scale2Label="글씨 크기"
          scale2Max={120}
          preview={
            <div className="mt-3 flex justify-center">
              <div className="w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2rem)/3)]">
                <BagCard
                  bag={sampleBag}
                  onClick={() => {}}
                  premium={true}
                />
              </div>
            </div>
          }
        />

        <h2 className="text-[14px] font-semibold mt-4 mb-3">팩</h2>

        <ColorSlotSection
          title="가방 속 팩카드"
          description="가방 안 팩 카드의 배경 톤을 바꿔요. 왼쪽 점선 원을 고르면 기본 배경으로 돌아가요."
          extraContent={
            <ul className="mt-2 space-y-1 text-[11px] text-text-muted list-none">
              <li>
                <span className="font-medium text-text-secondary">체크박스·여백 크기</span> — 체크박스/아이콘 크기와 짐 목록의 여백을 조절해요 (글자 크기는 안 바뀌어요)
              </li>
              <li>
                <span className="font-medium text-text-secondary">글씨 크기</span> — 제목·짐 텍스트·개수 표시의 글자만 따로 커지거나 작아져요
              </li>
            </ul>
          }
          selectedId={packGridColorId}
          customHex={packGridCustomHex}
          showDefaultOption
          onSelectPreset={setPackGridColor}
          onOpenCustomPicker={() => openCustomPicker("packGrid")}
          opacityPct={Math.round(packGridColorOpacity * 100)}
          onChangeOpacity={(pct) => setPackGridColorOpacity(pct / 100)}
          scalePct={Math.round((packCardScale / PACK_CARD_SCALE_BASE) * 100)}
          onChangeScale={(pct) => setPackCardScale((pct / 100) * PACK_CARD_SCALE_BASE)}
          scaleLabel="체크박스·여백 크기"
          scaleMin={50}
          scaleMax={130}
          scale2Pct={Math.round((packCardFontScale / PACK_CARD_FONT_SCALE_BASE) * 100)}
          onChangeScale2={(pct) => setPackCardFontScale((pct / 100) * PACK_CARD_FONT_SCALE_BASE)}
          scale2Label="글씨 크기"
          scale2Max={120}
          preview={
            <div className="mt-3 flex justify-center">
              <div className="w-full md:w-[calc((100%-1rem)/2)]">
                <PackCard
                  pack={samplePack}
                  isSyncedWithLibrary={false}
                  canDeleteFromLibrary={false}
                  onToggleItem={handleToggleSampleItem}
                  onChangeItemText={handleChangeSampleItemText}
                  onDeleteItem={() => {}}
                  onRenamePack={() => {}}
                  onToggleAll={handleToggleAllSampleItems}
                  onSaveToLibrary={() => {}}
                  onRefreshFromLibrary={() => {}}
                  onDeletePack={() => {}}
                  onChangeDisplayState={setSamplePackDisplayState}
                />
              </div>
            </div>
          }
        />

        <div className="mt-8 mb-4 flex justify-center">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="rounded-md border border-border px-4 py-2 text-[12.5px] text-text-secondary hover:text-foreground bg-surface-2 transition-colors"
          >
            화면 설정 초기화
          </button>
        </div>
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
      {showColorLimitModal && (
        <PremiumLimitModal
          message="헥사코드로 색상을 직접 입력하는 기능은 프리미엄 전용이에요. 무료에서는 프리셋 색상만 고를 수 있어요."
          onClose={() => setShowColorLimitModal(false)}
          onUnlocked={() => setShowColorLimitModal(false)}
          email={user?.email}
          profile={profile}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="화면 설정을 초기화하시겠어요?"
          message="글자 크기(보통), 강조 색상(오렌지), 투명도(30%), 여백·크기 및 그리드 밀도가 모두 기본값으로 돌아가요."
          confirmLabel="초기화"
          tone="accent"
          onCancel={() => setConfirmReset(false)}
          onConfirm={handleReset}
        />
      )}
    </div>
  );
}
