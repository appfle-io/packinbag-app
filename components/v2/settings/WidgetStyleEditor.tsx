"use client";

// 북마크 위젯 꾸미기 편집(2026-10-18, 1.7). 설정 > 위젯 꾸미기 > 칸 누르기 / 새로 만들기.
// 맨 위 미리 보기는 고르는 즉시 바뀐다. 사진은 저장할 때 올린다(그 전에는 이 기기 안 blob 주소로 미리 보기)
import { useEffect, useMemo, useRef, useState } from "react";
import { IconPhoto } from "@tabler/icons-react";
import type { Bag, WidgetStyle, WidgetStyleBg, WidgetStyleInk } from "@/lib/types";
import { Button, Chip, SectionHeader, SegmentedControl, Toggle, cx } from "@/components/v2/ui";
import { useToast } from "@/components/Toast";
import { pickNativeColor } from "@/lib/v2/nativeBridge";
import {
  SAMPLE_WIDGET_BAG,
  WIDGET_DIM_MAX,
  WIDGET_NAME_MAX,
  WIDGET_POSITIONS,
  WIDGET_SHOW_FIELDS,
  WIDGET_SWATCHES,
  WIDGET_ZOOM_MAX,
  WIDGET_ZOOM_MIN,
  clamp,
  clampOffset,
  widgetBagStats,
} from "@/lib/v2/widgetStyles";
import { SubScreen } from "./SubScreen";
import { WidgetPreview } from "./WidgetPreview";

const BG_OPTIONS: { value: WidgetStyleBg; label: string }[] = [
  { value: "plain", label: "기본" },
  { value: "photo", label: "사진" },
  { value: "solid", label: "단색" },
  { value: "none", label: "배경 제거" },
];

const INK_OPTIONS: { value: WidgetStyleInk; label: string }[] = [
  { value: "auto", label: "자동" },
  { value: "white", label: "흰색" },
  { value: "black", label: "검정" },
  { value: "custom", label: "직접" },
];

const CELL_ALIGN: Record<string, string> = { l: "items-start", c: "items-center", r: "items-end" };

export function WidgetStyleEditor({
  initial,
  isNew,
  premium,
  bags,
  saving,
  onBack,
  onSave,
  onDelete,
}: {
  initial: WidgetStyle;
  isNew: boolean;
  premium: boolean;
  bags: Bag[];
  saving: boolean;
  onBack: () => void;
  onSave: (style: WidgetStyle, photo: File | null) => void;
  onDelete: () => void;
}) {
  const { show } = useToast();
  const [draft, setDraft] = useState<WidgetStyle>(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  // 고른 사진의 blob 주소. 고를 때 만들고(예전 것은 놓아 줌), 화면을 닫을 때 놓아 준다
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const photoSrcRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (photoSrcRef.current) URL.revokeObjectURL(photoSrcRef.current);
    },
    [],
  );
  const previewBags = useMemo(() => bags.filter((b) => !b.trashedByOwnerAt).slice(0, 4), [bags]);
  const [bagId, setBagId] = useState<string | null>(previewBags[0]?.id ?? null);
  const previewBag = previewBags.find((b) => b.id === bagId) ?? null;
  const stats = previewBag ? widgetBagStats(previewBag) : SAMPLE_WIDGET_BAG;

  const patch = (p: Partial<WidgetStyle>) => setDraft((d) => ({ ...d, ...p }));

  const lockedToast = () => show("사진 · 단색 · 배경 제거는 프리미엄이에요");

  const pickBg = (bg: WidgetStyleBg) => {
    if (bg !== "plain" && !premium) {
      lockedToast();
      return;
    }
    patch({ bg });
  };

  const onPhotoPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      show("사진만 고를 수 있어요");
      return;
    }
    setPhoto(file);
    if (photoSrcRef.current) URL.revokeObjectURL(photoSrcRef.current);
    const url = URL.createObjectURL(file);
    photoSrcRef.current = url;
    setPhotoSrc(url);
    patch({ bg: "photo", zoom: 1, x: 0, y: 0 });
  };

  const zoom = draft.zoom ?? 1;
  const hasPhoto = !!photoSrc || !!draft.photoUrl;

  // ---- 끌어서 위치 맞추기(사진을 크게 했을 때만 움직인다) ----
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, x: draft.x ?? 0, y: draft.y ?? 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const size = frameRef.current?.getBoundingClientRect().width ?? 0;
    if (!d || size <= 0) return;
    patch({
      x: clampOffset(d.x + ((e.clientX - d.sx) / size) * 100, zoom),
      y: clampOffset(d.y + ((e.clientY - d.sy) / size) * 100, zoom),
    });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const setZoom = (value: number) => {
    const z = clamp(value / 100, WIDGET_ZOOM_MIN, WIDGET_ZOOM_MAX);
    patch({ zoom: z, x: clampOffset(draft.x ?? 0, z), y: clampOffset(draft.y ?? 0, z) });
  };

  // "직접": iOS 색 고르기 창(실시간 현황과 같은 창). 불투명도는 쓰지 않는다
  const pickColor = async (current: string | undefined, apply: (hex: string) => void) => {
    const res = await pickNativeColor(current ?? "#2E5E4E", 1);
    if (res) apply(res.color.toUpperCase());
    else show("앱을 최신 버전으로 업데이트하면 색을 직접 고를 수 있어요");
  };

  const swatchSelected = (hex: string) => draft.color?.toUpperCase() === hex;
  const customColor = draft.color && !WIDGET_SWATCHES.some((s) => s.hex === draft.color?.toUpperCase()) ? draft.color : null;
  const posLabel = WIDGET_POSITIONS.find((p) => p.key === draft.pos)?.label ?? "";

  const save = () => {
    if (draft.bg === "photo" && !hasPhoto) {
      show("사진을 골라 주세요");
      return;
    }
    onSave(draft, draft.bg === "photo" ? photo : null);
  };

  return (
    <SubScreen
      title={isNew ? "새 꾸미기" : "꾸미기 편집"}
      onBack={onBack}
      actions={
        <Button size="sm" disabled={saving} onClick={save}>
          {saving ? "저장 중" : "저장"}
        </Button>
      }
      bodyClassName="gap-6"
    >
      {/* 미리 보기 */}
      <section className="flex flex-col items-center gap-3">
        <WidgetPreview style={{ ...draft, bg: premium ? draft.bg : "plain" }} stats={stats} photoSrc={photoSrc} className="w-41" />
        {previewBags.length > 1 && (
          <div className="pib-v2-no-scrollbar flex max-w-full gap-2 overflow-x-auto">
            {previewBags.map((b) => (
              <Chip key={b.id} label={b.name || "가방"} selected={b.id === bagId} onClick={() => setBagId(b.id)} />
            ))}
          </div>
        )}
        <span className="text-micro text-faint">미리 볼 가방이에요. 위젯마다 가방은 위젯 편집에서 골라요</span>
      </section>

      {/* 이름 */}
      <section className="flex flex-col gap-2">
        <SectionHeader>이름</SectionHeader>
        <input
          value={draft.name}
          maxLength={WIDGET_NAME_MAX}
          placeholder="예: 제주 바다"
          onChange={(e) => patch({ name: e.target.value })}
          className="h-11 rounded-field border border-line bg-card px-3 text-body text-ink"
        />
      </section>

      {/* 배경 */}
      <section className="flex flex-col gap-3">
        <SectionHeader>배경</SectionHeader>
        <SegmentedControl label="배경" options={BG_OPTIONS} value={premium ? draft.bg : "plain"} onChange={pickBg} />
        {!premium && <p className="m-0 text-caption text-sub">사진 · 단색 · 배경 제거는 프리미엄이에요. 무료는 기본 바탕으로 쓸 수 있어요.</p>}
        {premium && draft.bg === "plain" && <p className="m-0 text-caption text-sub">앱과 같은 바탕이에요(다크 모드면 어둡게).</p>}
        {premium && draft.bg === "none" && (
          <p className="m-0 text-caption text-sub">
            바탕 없이 투명하게 두어요. 홈 화면 배경화면에 따라 글자가 잘 보이도록 글자색을 골라 주세요.
          </p>
        )}

        {premium && draft.bg === "photo" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div
                ref={frameRef}
                role="img"
                aria-label="사진 위치. 끌어서 옮겨요"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="relative aspect-square w-36 shrink-0 cursor-grab touch-none overflow-hidden rounded-widget bg-fill"
              >
                {hasPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 자르기 미리 보기(transform)라 next/image를 쓰지 않는다
                  <img
                    src={photoSrc ?? draft.photoUrl}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 size-full select-none object-cover"
                    // 사용자가 맞춘 크기 · 위치(런타임)
                    style={{ transform: `translate(${draft.x ?? 0}%, ${draft.y ?? 0}%) scale(${zoom})` }}
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-faint">
                    <IconPhoto size={28} stroke={1.5} aria-hidden="true" />
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <label className="flex h-10 cursor-pointer items-center justify-center rounded-field border border-line bg-card px-3 text-caption font-semibold text-ink active:bg-fill">
                  사진 고르기
                  <input type="file" accept="image/*" className="hidden" onChange={onPhotoPicked} />
                </label>
                <Button variant="secondary" size="sm" disabled={!hasPhoto} onClick={() => patch({ zoom: 1, x: 0, y: 0 })}>
                  처음 위치로
                </Button>
                <span className="text-micro text-faint">크게 한 뒤 끌어서 맞춰요</span>
              </div>
            </div>
            <label className="flex flex-col gap-2">
              <span className="flex justify-between text-caption text-sub">
                <span>크기</span>
                <span>{Math.round(zoom * 100)}%</span>
              </span>
              <input
                type="range"
                min={WIDGET_ZOOM_MIN * 100}
                max={WIDGET_ZOOM_MAX * 100}
                step={5}
                value={Math.round(zoom * 100)}
                disabled={!hasPhoto}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-brand"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="flex justify-between text-caption text-sub">
                <span>글자 쪽 어둡게</span>
                <span>{draft.dim ?? 40}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={WIDGET_DIM_MAX}
                step={5}
                value={draft.dim ?? 40}
                onChange={(e) => patch({ dim: Number(e.target.value) })}
                className="w-full accent-brand"
              />
            </label>
          </div>
        )}

        {premium && draft.bg === "solid" && (
          // 샘플은 늘 한 줄: 폭이 좁으면 동그라미가 같이 작아진다. 맨 오른쪽은 직접 고르기
          <div role="radiogroup" aria-label="단색" className="flex flex-nowrap items-center gap-2">
            {WIDGET_SWATCHES.map((s) => (
              <button
                key={s.hex}
                type="button"
                role="radio"
                aria-checked={swatchSelected(s.hex)}
                aria-label={s.label}
                onClick={() => patch({ color: s.hex })}
                className={cx(
                  "aspect-square min-w-6 max-w-9 flex-1 rounded-full border border-line",
                  swatchSelected(s.hex) && "ring-2 ring-brand ring-offset-2 ring-offset-card",
                )}
                // 견본 색(데이터)
                style={{ background: s.hex }}
              />
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={!!customColor}
              aria-label="직접 고르기"
              onClick={() => void pickColor(draft.color, (hex) => patch({ color: hex }))}
              className={cx(
                "relative aspect-square min-w-6 max-w-9 flex-1 rounded-full bg-rainbow",
                customColor && "ring-2 ring-brand ring-offset-2 ring-offset-card",
              )}
            >
              {customColor && (
                <span
                  className="absolute inset-2 rounded-full border-2 border-card"
                  // 직접 고른 색(런타임)
                  style={{ background: customColor }}
                />
              )}
            </button>
          </div>
        )}
      </section>

      {/* 글자 */}
      <section className="flex flex-col gap-3">
        <SectionHeader>글자</SectionHeader>
        {premium && draft.bg !== "plain" && (
          <div className="flex flex-col gap-2">
            <span className="text-caption text-sub">글자색</span>
            <SegmentedControl
              label="글자색"
              options={INK_OPTIONS}
              value={draft.ink}
              onChange={(ink) => {
                if (ink === "custom") void pickColor(draft.inkColor, (hex) => patch({ ink: "custom", inkColor: hex }));
                else patch({ ink });
              }}
            />
            {draft.ink === "custom" && draft.inkColor && (
              <button
                type="button"
                onClick={() => void pickColor(draft.inkColor, (hex) => patch({ inkColor: hex }))}
                className="flex items-center gap-2 self-start text-caption text-sub"
              >
                <span
                  className="size-5 rounded-full border border-line"
                  // 직접 고른 글자색(런타임)
                  style={{ background: draft.inkColor }}
                />
                {draft.inkColor} · 바꾸기
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-4">
          {/* 위젯 모양 그대로의 3×3 칸. 누른 칸으로 글자가 가고, 가로 위치에 따라 정렬도 바뀐다 */}
          <div role="radiogroup" aria-label="글자 위치" className="grid aspect-square w-32 shrink-0 grid-cols-3 gap-1 rounded-widget bg-fill p-2">
            {WIDGET_POSITIONS.map((p) => {
              const on = draft.pos === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={p.label}
                  onClick={() => patch({ pos: p.key })}
                  className={cx("flex items-center justify-center rounded-field", on ? "bg-brand" : "bg-card")}
                >
                  <span className={cx("flex w-5 flex-col gap-1", CELL_ALIGN[p.key[1]])}>
                    <span className={cx("block h-0.5 w-5 rounded-full", on ? "bg-on-brand" : "bg-line-strong")} />
                    <span className={cx("block h-0.5 w-3 rounded-full", on ? "bg-on-brand" : "bg-line-strong")} />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-body font-semibold text-brand">{posLabel}</span>
            <span className="text-caption text-sub">칸을 누르면 그 자리로 가요. 가운데 줄은 가운데 정렬이에요</span>
          </div>
        </div>
      </section>

      {/* 보여 줄 정보 */}
      <section className="flex flex-col">
        <SectionHeader>보여 줄 정보</SectionHeader>
        {WIDGET_SHOW_FIELDS.map((f) => (
          <Toggle
            key={f.key}
            checked={!!draft.show[f.key]}
            onChange={(on) => patch({ show: { ...draft.show, [f.key]: on } })}
            label={f.label}
            description={f.hint}
          />
        ))}
        <p className="m-0 pt-2 text-micro text-faint">아무것도 고르지 않으면 배경만 보여요. 작은 위젯이라 많이 켜면 이름이 한 줄로 줄어요.</p>
      </section>

      {!isNew && (
        <Button variant="danger" block disabled={saving} onClick={onDelete}>
          이 꾸미기 지우기
        </Button>
      )}
    </SubScreen>
  );
}
