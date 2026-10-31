"use client";

// 북마크 위젯 꾸미기 편집(2026-10-18, 1.7). 설정 > 위젯 꾸미기 > 칸 누르기 / 새로 만들기.
// 맨 위 미리 보기는 고르는 즉시 바뀐다. 사진은 저장할 때 올린다(그 전에는 이 기기 안 blob 주소로 미리 보기)
// "배경화면"(2026-10-31): 빈 페이지 스크린샷 1장 → 기종 표로 위젯 칸을 그려 주고 누른 칸을 잘라 사진으로(lib/v2/wallpaperFit).
// 표에 없는 기종은 못 씀(분홍 표시로 직접 재는 방식 · 밝기 슬라이더는 어렵다고 해서 뺌, 사용자 10/31)
import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconPhoto } from "@tabler/icons-react";
import type { Bag, WidgetStyle, WidgetStyleBg, WidgetStyleInk } from "@/lib/types";
import { Button, Chip, SectionHeader, SegmentedControl, Toggle, cx } from "@/components/v2/ui";
import { useToast } from "@/components/Toast";
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
  wallpaperState,
  widgetBagStats,
} from "@/lib/v2/widgetStyles";
import {
  WALLPAPER_MARK_COLOR,
  cropWallpaper,
  defaultVeil,
  widgetSlotLayouts,
  type SlotLayout,
  type WidgetSlot,
} from "@/lib/v2/wallpaperFit";
import { SubScreen } from "./SubScreen";
import { WidgetPreview } from "./WidgetPreview";

// 화면에서 고르는 배경. "wallpaper"는 저장할 때 bg photo/solid + wallpaper 값이 된다
type BgChoice = WidgetStyleBg | "wallpaper";

const BG_OPTIONS: { value: BgChoice; label: string }[] = [
  { value: "plain", label: "기본" },
  { value: "photo", label: "사진" },
  { value: "solid", label: "단색" },
  { value: "wallpaper", label: "배경화면" },
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
  onSave: (style: WidgetStyle, photo: Blob | null) => void;
  onDelete: () => void;
}) {
  const { show } = useToast();
  const [draft, setDraft] = useState<WidgetStyle>(initial);
  const [photo, setPhoto] = useState<Blob | null>(null);
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

  const lockedToast = () => show("사진 · 단색 · 배경화면 배경은 프리미엄이에요");

  const wp = wallpaperState(draft);
  // "배경화면"을 골랐는지(스크린샷을 고르기 전에는 draft에 아직 배경화면 값이 없다)
  const [wallOn, setWallOn] = useState(wallpaperState(initial) !== null);
  const bgChoice: BgChoice = wallOn ? "wallpaper" : draft.bg;
  // 단색을 고르다 배경화면(분홍)으로 갔다 돌아오면 원래 색으로
  const solidColor = initial.color && initial.color !== WALLPAPER_MARK_COLOR ? initial.color : undefined;

  const pickBg = (bg: BgChoice) => {
    if (bg !== "plain" && !premium) {
      lockedToast();
      return;
    }
    if (bg === bgChoice) return;
    setShot(null);
    if (bg === "wallpaper") {
      setWallOn(true);
      // 예전에 맞춘 배경화면이 있던 꾸미기면 그대로 되돌린다. 아니면 스크린샷을 고를 때까지 배경은 그대로
      if (wallpaperState(initial) === "fitted") {
        setDraft((d) => ({ ...d, bg: "photo", wallpaper: initial.wallpaper, photoUrl: initial.photoUrl, zoom: 1, x: 0, y: 0 }));
        setPhoto(null);
        setPhotoSrc(null);
      }
      return;
    }
    setWallOn(false);
    patch({ bg, wallpaper: undefined, ...(bg === "solid" && draft.color === WALLPAPER_MARK_COLOR ? { color: solidColor ?? WIDGET_SWATCHES[0].hex } : {}) });
  };

  // ---- 배경화면 ----
  const [busy, setBusy] = useState(false);
  // 스크린샷 1장으로 맞추기: 고른 빈 페이지 스크린샷 · 기종 칸 · 고른 칸
  const [shot, setShot] = useState<{ file: Blob; url: string; layouts: SlotLayout[] } | null>(null);
  const [layoutKey, setLayoutKey] = useState<string | null>(null);
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const shotUrlRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current);
    },
    [],
  );
  const layout = shot?.layouts.find((l) => l.key === layoutKey) ?? shot?.layouts[0] ?? null;

  const applyCut = (cut: Blob, wallpaper: WidgetStyle["wallpaper"]) => {
    setPhoto(cut);
    if (photoSrcRef.current) URL.revokeObjectURL(photoSrcRef.current);
    const url = URL.createObjectURL(cut);
    photoSrcRef.current = url;
    setPhotoSrc(url);
    patch({ bg: "photo", wallpaper, zoom: 1, x: 0, y: 0, ...(wp === "fitted" ? {} : { dim: 0 }) });
  };

  const onShot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const layouts = widgetSlotLayouts(bitmap.width, bitmap.height);
      bitmap.close?.();
      if (!layouts) {
        show("이 아이폰은 아직 배경화면 맞추기를 쓸 수 없어요");
        return;
      }
      if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current);
      const url = URL.createObjectURL(file);
      shotUrlRef.current = url;
      setShot({ file, url, layouts });
      setLayoutKey(layouts[0].key);
      setSlotKey(null);
    } catch {
      show("사진을 읽지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const pickSlot = async (slot: WidgetSlot) => {
    if (!shot || busy) return;
    setBusy(true);
    try {
      // iOS 26+는 위젯에 옅은 흰 유리가 덮여서 그만큼 미리 어둡게 깐다(defaultVeil)
      const wallpaper = { ...slot.wallpaper, veil: defaultVeil() };
      const cut = await cropWallpaper(shot.file, wallpaper);
      if (cut === "screen") return;
      setSlotKey(slot.key);
      applyCut(cut, wallpaper);
    } catch {
      show("사진을 읽지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const pickLayout = (key: string) => {
    setLayoutKey(key);
    const slot = shot?.layouts.find((l) => l.key === key)?.slots.find((x) => x.key === slotKey);
    if (slot) void pickSlot(slot);
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

  // "직접": 웹 색 고르기(<input type="color">, 2026-10-19). iOS 앱에서는 WebKit이 같은 iOS 색 고르기 창을 띄우고,
  // 고르는 동안 값이 바뀜 때마다 미리 보기에 바로 들어간다(닫으면 그대로 적용).
  // 예전 네이티브 pickColor는 창을 X로 닫아야만 값을 돌려주고, 끌어내려 닫으면 아무것도 안 바뀌었다(SET-WID-05 · 06)
  const inkInputRef = useRef<HTMLInputElement>(null);
  const hexOf = (value: string) => value.toUpperCase();

  const swatchSelected = (hex: string) => draft.color?.toUpperCase() === hex;
  const customColor = draft.color && !WIDGET_SWATCHES.some((s) => s.hex === draft.color?.toUpperCase()) ? draft.color : null;
  const posLabel = WIDGET_POSITIONS.find((p) => p.key === draft.pos)?.label ?? "";

  const save = () => {
    if (wallOn && wp !== "fitted") {
      show(shot ? "위젯이 있는 칸을 눌러 주세요" : "빈 페이지 스크린샷을 골라 주세요");
      return;
    }
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
        <SegmentedControl label="배경" options={BG_OPTIONS} value={premium ? bgChoice : "plain"} onChange={pickBg} />
        {!premium && <p className="m-0 text-caption text-sub">사진 · 단색 · 배경화면 배경은 프리미엄이에요. 무료는 기본 바탕으로 쓸 수 있어요.</p>}
        {premium && !wallOn && draft.bg === "plain" && <p className="m-0 text-caption text-sub">앱과 같은 바탕이에요(다크 모드면 어둡게).</p>}

        {premium && wallOn && (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-caption text-sub">위젯 자리만큼 배경화면을 깔아서 투명한 것처럼 보여요.</p>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              <WallpaperStep n={1} done={!!shot || wp === "fitted"} title="빈 페이지 스크린샷 고르기">
                홈 화면을 길게 눌러 맨 오른쪽 빈 페이지로 넘긴 뒤 스크린샷을 찍어 골라요.
                <ShotButton label={shot || wp === "fitted" ? "다시 고르기" : "스크린샷 고르기"} disabled={busy} onChange={onShot} />
              </WallpaperStep>
              {shot && layout && (
                <WallpaperStep n={2} done={!!slotKey} title="위젯 자리 누르기">
                  위젯을 둔(둘) 칸을 눌러요.
                  {shot.layouts.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {shot.layouts.map((l) => (
                        <Chip key={l.key} label={l.label} selected={l.key === layout.key} onClick={() => pickLayout(l.key)} />
                      ))}
                    </div>
                  )}
                  <div className="relative w-40 overflow-hidden rounded-field border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 이 기기 안 blob 스크린샷 */}
                    <img src={shot.url} alt="" draggable={false} className="block w-full select-none" />
                    {layout.slots.map((slot) => {
                      const on = slot.key === slotKey;
                      return (
                        <button
                          key={slot.key}
                          type="button"
                          aria-label={slot.label}
                          aria-pressed={on}
                          onClick={() => void pickSlot(slot)}
                          className={cx(
                            "absolute rounded-field border-2",
                            on ? "border-brand bg-brand/40" : "border-white/90 bg-black/25 active:bg-black/40",
                          )}
                          // 기종 표의 위젯 칸(런타임)
                          style={{
                            left: `${(slot.wallpaper.x ?? 0) * 100}%`,
                            top: `${(slot.wallpaper.y ?? 0) * 100}%`,
                            width: `${(slot.wallpaper.w ?? 0) * 100}%`,
                            height: `${(slot.wallpaper.h ?? 0) * 100}%`,
                          }}
                        />
                      );
                    })}
                  </div>
                </WallpaperStep>
              )}
            </ol>
            <span className="text-micro text-faint">위젯을 옮기거나 배경화면을 바꾸면 다시 골라 주세요. 저장한 뒤 홈 화면 위젯을 길게 눌러 이 꾸미기를 골라요.</span>
          </div>
        )}

        {premium && wallOn && wp === "fitted" && (
              <label className="flex flex-col gap-2">
                <span className="flex justify-between text-caption text-sub">
                  <span>글자 쪽 어둡게</span>
                  <span>{draft.dim ?? 0}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={WIDGET_DIM_MAX}
                  step={5}
                  value={draft.dim ?? 0}
                  onChange={(e) => patch({ dim: Number(e.target.value) })}
                  className="w-full accent-brand"
                />
              </label>
        )}

        {premium && draft.bg === "photo" && !wallOn && (
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

        {premium && draft.bg === "solid" && !wallOn && (
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
            {/* 누르면 색 고르기 창. 입력칸을 동그라미 위에 투명하게 깔아 직접 누르게 한다(숨긴 칸을 스크립트로 열면 안 뜨는 브라우저가 있어서) */}
            <label
              aria-label="직접 고르기"
              className={cx(
                "relative aspect-square min-w-6 max-w-9 flex-1 cursor-pointer overflow-hidden rounded-full bg-rainbow",
                customColor && "ring-2 ring-brand ring-offset-2 ring-offset-card",
              )}
            >
              {customColor && (
                <span
                  className="pointer-events-none absolute inset-2 rounded-full border-2 border-card"
                  // 직접 고른 색(런타임)
                  style={{ background: customColor }}
                />
              )}
              <input
                type="color"
                value={draft.color ?? "#2E5E4E"}
                onChange={(e) => patch({ color: hexOf(e.target.value) })}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
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
                if (ink === "custom") {
                  // 고르자마자 색 고르기 창을 연다(안 뜨는 브라우저는 아래 "바꾸기" 줄로)
                  patch({ ink: "custom", inkColor: draft.inkColor ?? "#FFFFFF" });
                  inkInputRef.current?.click();
                } else patch({ ink });
              }}
            />
            {/* 글자색 직접 고르기 칸은 늘 그려 둔다("직접"을 누른 그 자리에서 열 수 있게). 직접이 아니면 화면에서만 숨김 */}
            <label
              className={cx(
                "relative flex cursor-pointer items-center gap-2 self-start text-caption text-sub",
                draft.ink !== "custom" && "sr-only",
              )}
            >
                <span
                  className="size-5 rounded-full border border-line"
                  // 직접 고른 글자색(런타임)
                  style={{ background: draft.inkColor ?? "#FFFFFF" }}
                />
                {draft.inkColor ?? "#FFFFFF"} · 바꾸기
                <input
                  ref={inkInputRef}
                  type="color"
                  aria-label="글자색 직접 고르기"
                  value={draft.inkColor ?? "#FFFFFF"}
                  onChange={(e) => patch({ ink: "custom", inkColor: hexOf(e.target.value) })}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
              </label>
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

// 배경화면 맞추기 단계 한 줄(번호 · 제목 · 설명 · 버튼)
function WallpaperStep({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={cx(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold",
          done ? "bg-brand text-on-brand" : "bg-fill text-sub",
        )}
      >
        {done ? <IconCheck size={14} stroke={2.5} aria-label="끝" /> : n}
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <span className="text-body font-semibold text-ink">{title}</span>
        <span className="flex flex-col items-start gap-2 text-caption text-sub">{children}</span>
      </span>
    </li>
  );
}

function ShotButton({ label, disabled, onChange }: { label: string; disabled: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label
      aria-disabled={disabled || undefined}
      className={cx(
        "flex h-10 items-center justify-center rounded-field border border-line bg-card px-4 text-caption font-semibold text-ink",
        disabled ? "pointer-events-none opacity-50" : "cursor-pointer active:bg-fill",
      )}
    >
      {label}
      <input type="file" accept="image/*" className="hidden" disabled={disabled} onChange={onChange} />
    </label>
  );
}
