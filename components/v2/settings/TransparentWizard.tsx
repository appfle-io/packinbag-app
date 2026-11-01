"use client";

// 투명 위젯 맞추기(1.12, 2026-11-01). 설정 > 위젯 > [투명 위젯 맞추기]. 설명 그림은 위, 한 줄 + 버튼 하나는 아래(사용자 "같이 하는 방식").
// 1/3 맨 오른쪽 빈 페이지로 → 2/3 스크린샷 찍어 고르기 → 3/3 위젯 자리 확인(앱 이름 보임 · 숨김 배치가 둘인 기종은 그림 버튼으로 물음)
//   → "어느 위젯에 쓸까요?" 팩 위젯: 조각을 이 기기에 저장하고(saveHomeWallpaper) 팩 위젯 안내로 / 가방 바로가기: 칸 누르기 → 꾸미기 저장.
// 1 · 2단계는 이 기기에 1시간 기억(앱을 나갔다 와도 그 단계). 스크린샷은 메모리에만 있어 3단계는 기억하지 않는다
import { useEffect, useRef, useState } from "react";
import { IconArrowRight, IconBookmark, IconCheck, IconChecklist, IconChevronRight, IconPhoto } from "@tabler/icons-react";
import type { WidgetStyle } from "@/lib/types";
import { Button, Chip, cx } from "@/components/v2/ui";
import { useToast } from "@/components/Toast";
import { useOnlineGuard } from "@/components/v2/shell/useOnlineGuard";
import { saveHomeWallpaper, type HomeWallpaperState } from "@/lib/v2/nativeBridge";
import {
  cropWallpaper,
  cropWallpaperPieces,
  defaultVeil,
  homeWallpaperPieces,
  widgetSlotLayouts,
  type SlotLayout,
  type WidgetSlot,
} from "@/lib/v2/wallpaperFit";
import { SAMPLE_WIDGET_BAG, WIDGET_NAME_MAX, newWidgetStyle } from "@/lib/v2/widgetStyles";
import { SubScreen } from "./SubScreen";
import { WidgetPreview } from "./WidgetPreview";
import { useWidgetStyleSave } from "./useWidgetStyleSave";

type Step = 1 | 2 | 3 | "bookmark";

const MEMORY_KEY = "pib_tw_step";
const MEMORY_MS = 60 * 60 * 1000;

function readStep(): Step {
  try {
    const raw = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? "null") as { step?: number; at?: number } | null;
    if (raw && raw.step === 2 && typeof raw.at === "number" && Date.now() - raw.at < MEMORY_MS) return 2;
  } catch {
    // 못 읽으면 처음부터
  }
  return 1;
}

function rememberStep(step: Step | null) {
  try {
    if (step === 1 || step === 2) localStorage.setItem(MEMORY_KEY, JSON.stringify({ step, at: Date.now() }));
    else localStorage.removeItem(MEMORY_KEY);
  } catch {
    // 저장 못 해도 진행에는 지장 없음
  }
}

const ROW_NAME: Record<string, string> = { t: "위", m: "가운데", b: "아래" };
const COL_NAME: Record<string, string> = { l: "왼쪽", r: "오른쪽" };
const slotName = (key: string) => `${ROW_NAME[key[0]]} ${COL_NAME[key[1]]}`;

export function TransparentWizard({
  onClose,
  state,
  bagStats,
  onFitted,
  onPack,
  onBookmarkSaved,
}: {
  onClose: () => void;
  // null = 이 앱 빌드는 팩 위젯 투명을 못 씀
  state: HomeWallpaperState | null;
  bagStats?: typeof SAMPLE_WIDGET_BAG;
  onFitted: (state: HomeWallpaperState) => void;
  onPack: () => void;
  onBookmarkSaved: () => void;
}) {
  const { show } = useToast();
  const { guard } = useOnlineGuard();
  const { saving, canAdd, limitMessage, save } = useWidgetStyleSave();
  const [step, setStepRaw] = useState<Step>(readStep);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<{ file: Blob; url: string; layouts: SlotLayout[] } | null>(null);
  const [layoutKey, setLayoutKey] = useState<string | null>(null);
  const shotUrlRef = useRef<string | null>(null);
  // 가방 바로가기: 고른 칸 · 잘라 낸 사진
  const [cut, setCut] = useState<{ slot: WidgetSlot; blob: Blob; url: string; wallpaper: WidgetStyle["wallpaper"] } | null>(null);
  const cutUrlRef = useRef<string | null>(null);
  const [name, setName] = useState("");
  // 새 꾸미기 바탕(id는 화면을 열 때 한 번)
  const [base] = useState(newWidgetStyle);

  useEffect(() => {
    return () => {
      if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current);
      if (cutUrlRef.current) URL.revokeObjectURL(cutUrlRef.current);
    };
  }, []);

  const setStep = (s: Step) => {
    setStepRaw(s);
    rememberStep(s);
  };

  const close = () => {
    rememberStep(null);
    onClose();
  };

  const back = () => {
    if (step === 1) close();
    else if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else setStep(3);
  };

  const layout = shot?.layouts.find((l) => l.key === layoutKey) ?? shot?.layouts[0] ?? null;

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
        show("이 아이폰은 아직 투명 위젯을 쓸 수 없어요");
        return;
      }
      if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current);
      const url = URL.createObjectURL(file);
      shotUrlRef.current = url;
      setShot({ file, url, layouts });
      setLayoutKey(layouts[0].key);
      setCut(null);
      setStep(3);
    } catch {
      show("사진을 읽지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  // 팩 위젯용 조각을 이 기기에 저장(앱이 못 쓰면 건너뜀)
  const fit = async (): Promise<boolean> => {
    if (!shot || !layout || state === null) return state === null;
    try {
      const pieces = await cropWallpaperPieces(shot.file, homeWallpaperPieces(layout), defaultVeil());
      onFitted(await saveHomeWallpaper(pieces));
      return true;
    } catch (err) {
      console.error("[팩인백] 투명 위젯 저장 실패:", err);
      show("투명 위젯을 맞추지 못했어요");
      return false;
    }
  };

  const goPack = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await fit();
    setBusy(false);
    if (!ok) return;
    rememberStep(null);
    show("맞췄어요. 팩 위젯 편집을 따라 해 주세요");
    onPack();
  };

  const goBookmark = async () => {
    if (busy) return;
    setBusy(true);
    // 팩 위젯 조각도 같이 맞춰 둔다(실패해도 가방 바로가기는 이어 감)
    await fit();
    setBusy(false);
    setStep("bookmark");
  };

  const pickSlot = async (slot: WidgetSlot) => {
    if (!shot || busy) return;
    setBusy(true);
    try {
      // iOS 26+는 위젯에 옅은 흰 유리가 덮여서 그만큼 미리 어둡게 깐다(defaultVeil)
      const wallpaper = { ...slot.wallpaper, veil: defaultVeil() };
      const blob = await cropWallpaper(shot.file, wallpaper);
      if (blob === "screen") return;
      if (cutUrlRef.current) URL.revokeObjectURL(cutUrlRef.current);
      const url = URL.createObjectURL(blob);
      cutUrlRef.current = url;
      setCut({ slot, blob, url, wallpaper });
      setName((n) => (!n || n.startsWith("투명 · ") ? `투명 · ${slotName(slot.key)}` : n));
    } catch {
      show("사진을 읽지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const draft: WidgetStyle | null = cut
    ? { ...base, name: name.trim() || `투명 · ${slotName(cut.slot.key)}`, bg: "photo", wallpaper: cut.wallpaper, zoom: 1, x: 0, y: 0, dim: 0 }
    : null;
  const saveBookmark = () => {
    if (!cut || !draft) {
      show("위젯을 둔 칸을 눌러 주세요");
      return;
    }
    if (!canAdd) {
      show(limitMessage);
      return;
    }
    guard(() =>
      void save(draft, cut.blob).then((ok) => {
        if (!ok) return;
        rememberStep(null);
        onBookmarkSaved();
      }),
    );
  };

  const total = 3;
  const n = step === "bookmark" ? 3 : step;

  return (
    <SubScreen
      title={step === "bookmark" ? "가방 바로가기에 쓰기" : "투명 위젯 맞추기"}
      onBack={back}
      actions={step !== "bookmark" ? <span className="px-2 text-body font-semibold text-sub">{n} / {total}</span> : undefined}
      headerExtra={
        step !== "bookmark" ? (
          <div className="grid grid-cols-3 gap-2 px-5 pb-2">
            {[1, 2, 3].map((i) => (
              <span key={i} className={cx("h-1 rounded-full", i <= n ? "bg-brand" : "bg-line")} />
            ))}
          </div>
        ) : undefined
      }
      bodyClassName="gap-5"
      footer={
        step === 1 ? (
          <Button block onClick={() => setStep(2)}>
            빈 페이지로 갔어요
          </Button>
        ) : step === 2 ? (
          <label
            aria-disabled={busy || undefined}
            className={cx(
              "flex h-12 w-full items-center justify-center gap-2 rounded-card bg-ink text-body font-semibold text-on-ink",
              busy ? "pointer-events-none opacity-50" : "cursor-pointer active:opacity-80",
            )}
          >
            <IconPhoto size={20} stroke={2} aria-hidden="true" />
            {busy ? "읽는 중…" : "찍은 스크린샷 고르기"}
            <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => void onShot(e)} />
          </label>
        ) : step === "bookmark" ? (
          <Button block disabled={saving || busy || !cut} onClick={saveBookmark}>
            {saving ? "저장 중" : "꾸미기로 저장"}
          </Button>
        ) : undefined
      }
    >
      {step === 1 && (
        <>
          <Picture>
            <div className="flex items-center gap-3">
              <MiniPhone>
                <div className="grid grid-cols-4 gap-2 px-3 pt-6">
                  {[-5, 4, -4, 5, 4, -5].map((r, i) => (
                    <span key={i} className={cx("relative h-4 rounded-control bg-white/85", r > 0 ? "rotate-3" : "-rotate-3")}>
                      <span className="absolute -left-1 -top-1 size-2 rounded-full bg-faint" />
                    </span>
                  ))}
                </div>
                <span className="absolute left-10 top-28 size-8 rounded-full border-2 border-white bg-white/35" />
                <PageDots active={0} />
              </MiniPhone>
              <IconArrowRight size={28} stroke={2.5} className="text-brand" aria-hidden="true" />
              <MiniPhone>
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-field border-2 border-dashed border-white px-3 py-1 text-micro font-bold text-white">빈 페이지</span>
                </span>
                <PageDots active={2} />
              </MiniPhone>
            </div>
            <div className="flex gap-8 text-caption font-semibold text-brand">
              <span>① 빈 곳 길게 누르기</span>
              <span>② 맨 오른쪽까지</span>
            </div>
          </Picture>
          <Say title={"홈 화면을 길게 눌러\n맨 오른쪽 빈 페이지로 가요"}>아이콘이 흔들리면 왼쪽으로 계속 밀어요.</Say>
          <p className="m-0 text-center text-micro text-faint">앱을 나갔다 와도 이 단계에서 기다려요</p>
        </>
      )}

      {step === 2 && (
        <>
          <Picture>
            <div className="flex items-center gap-3">
              <span className="flex w-20 flex-col items-end gap-1 text-caption font-bold text-brand">
                음량 높이기
                <IconArrowRight size={22} stroke={2} aria-hidden="true" />
              </span>
              <span className="relative h-64 w-32">
                <span className="absolute -left-1 top-16 h-8 w-1 rounded-full bg-brand" />
                <span className="absolute -left-1 top-28 h-8 w-1 rounded-full bg-faint" />
                <span className="absolute -right-1 top-20 h-12 w-1 rounded-full bg-brand" />
                <span className="pib-tw-wall absolute inset-0 overflow-hidden rounded-widget border-4 border-ink">
                  <span className="absolute inset-0 flex items-center justify-center bg-white/35 text-caption font-bold text-ink">찰칵</span>
                </span>
              </span>
              <span className="flex w-20 flex-col items-start gap-1 text-caption font-bold text-brand">
                측면 버튼
                <IconArrowRight size={22} stroke={2} className="rotate-180" aria-hidden="true" />
              </span>
            </div>
            <span className="text-caption font-semibold text-brand">두 버튼을 같이 눌렀다 떼요</span>
          </Picture>
          <Say title={"그 빈 페이지에서\n스크린샷을 찍어요"}>아이콘이 흔들리는 그대로 찍어도 돼요. 찍고 팩인백으로 돌아와요.</Say>
        </>
      )}

      {step === 3 && shot && layout && (
        <>
          <Picture row>
            <Shot url={shot.url}>
              {layout.slots.map((slot) => (
                <span
                  key={slot.key}
                  className="absolute rounded-field border-2 border-dashed border-white transition-all duration-160"
                  // 기종 표의 위젯 칸(런타임)
                  style={slotStyle(slot)}
                />
              ))}
            </Shot>
            <div className="flex flex-1 flex-col gap-2">
              {shot.layouts.length > 1 && shot.layouts.some((l) => l.key === "notext") ? (
                <>
                  <span className="whitespace-pre-line text-body font-bold text-ink">{"홈 화면 아이콘 아래\n앱 이름이 보이나요?"}</span>
                  {shot.layouts.map((l) => {
                    const on = l.key === layout.key;
                    const named = l.key !== "notext";
                    return (
                      <button
                        key={l.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setLayoutKey(l.key)}
                        className={cx(
                          "flex min-h-13 items-center gap-3 rounded-field px-3 py-2 text-left",
                          on ? "border-2 border-brand bg-card" : "border border-line-strong bg-card/50",
                        )}
                      >
                        <span className="flex items-start gap-1" aria-hidden="true">
                          {[0, 1].map((i) => (
                            <span key={i} className="flex flex-col items-center gap-1">
                              <span className={named ? "size-4 rounded-control bg-brand/50" : "size-5 rounded-control bg-brand/50"} />
                              {named && <span className="h-1 w-3 rounded-full bg-faint" />}
                            </span>
                          ))}
                        </span>
                        <span className="flex flex-col">
                          <span className="text-body font-bold text-ink">{named ? "보여요" : "안 보여요"}</span>
                          <span className="text-micro text-sub">{named ? "기본 아이콘" : "아이콘 크게"}</span>
                        </span>
                      </button>
                    );
                  })}
                  <span className="text-micro text-sub">고르면 점선이 바로 옮겨 가요</span>
                </>
              ) : shot.layouts.length > 1 ? (
                <>
                  <span className="text-body font-bold text-ink">어느 아이폰인가요?</span>
                  <span className="flex flex-wrap gap-2">
                    {shot.layouts.map((l) => (
                      <Chip key={l.key} label={l.label || l.key} selected={l.key === layout.key} onClick={() => setLayoutKey(l.key)} />
                    ))}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1 text-body font-bold text-brand">
                    <IconCheck size={20} stroke={2.5} aria-hidden="true" />
                    맞췄어요
                  </span>
                  <span className="text-caption text-sub">점선이 홈 화면의 위젯 자리예요</span>
                </>
              )}
            </div>
          </Picture>

          <Say title="어느 위젯에 쓸까요?">한 번 맞추면 이 아이폰의 위젯 모두에 써요.</Say>
          <div className="flex flex-col gap-3">
            <Choice
              icon={<IconChecklist size={22} stroke={2} />}
              title="팩 위젯"
              sub={state === null ? "앱을 업데이트하면 쓸 수 있어요" : "홈 화면에서 위젯 편집을 따라 해요"}
              disabled={busy || state === null}
              onClick={() => void goPack()}
            />
            <Choice
              icon={<IconBookmark size={22} stroke={2} />}
              title="가방 바로가기"
              sub="위젯을 둔 칸을 눌러 꾸미기로 저장해요"
              dark
              disabled={busy}
              onClick={() => void goBookmark()}
            />
          </div>
          <Button variant="text" size="sm" className="self-center" onClick={() => setStep(2)}>
            다른 스크린샷 고르기
          </Button>
        </>
      )}

      {step === "bookmark" && shot && layout && (
        <>
          <Say title="위젯을 둔 칸을 눌러요">누르면 오른쪽에 바로 보여요</Say>
          <Picture row>
            <Shot url={shot.url}>
              {layout.slots.map((slot) => {
                const on = slot.key === cut?.slot.key;
                return (
                  <button
                    key={slot.key}
                    type="button"
                    aria-label={slotName(slot.key)}
                    aria-pressed={on}
                    onClick={() => void pickSlot(slot)}
                    className={cx(
                      "absolute rounded-field",
                      on ? "border-4 border-white bg-brand/40" : "border-2 border-dashed border-white/90 bg-black/10 active:bg-black/30",
                    )}
                    // 기종 표의 위젯 칸(런타임)
                    style={slotStyle(slot)}
                  />
                );
              })}
            </Shot>
            <div className="flex flex-1 flex-col items-center gap-2 pt-2">
              {draft && cut ? (
                <WidgetPreview style={draft} stats={bagStats ?? SAMPLE_WIDGET_BAG} photoSrc={cut.url} className="w-full" />
              ) : (
                <span className="flex aspect-square w-full items-center justify-center rounded-widget border-2 border-dashed border-line-strong text-caption text-sub">
                  칸을 눌러요
                </span>
              )}
              <span className="text-caption font-bold text-brand">{cut ? slotName(cut.slot.key) : " "}</span>
              <span className="text-micro text-sub">미리 보기</span>
            </div>
          </Picture>
          <label className="flex flex-col gap-2">
            <span className="text-caption font-semibold text-sub">꾸미기 이름</span>
            <input
              value={name}
              maxLength={WIDGET_NAME_MAX}
              placeholder="투명 · 위 왼쪽"
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-field border border-line bg-card px-3 text-body text-ink"
            />
          </label>
          <p className="m-0 whitespace-pre-line text-center text-caption text-sub">{"저장한 뒤 홈 화면의 가방 바로가기를 길게 눌러\n이 꾸미기를 골라요"}</p>
        </>
      )}
    </SubScreen>
  );
}

function slotStyle(slot: WidgetSlot): React.CSSProperties {
  return {
    left: `${(slot.wallpaper.x ?? 0) * 100}%`,
    top: `${(slot.wallpaper.y ?? 0) * 100}%`,
    width: `${(slot.wallpaper.w ?? 0) * 100}%`,
    height: `${(slot.wallpaper.h ?? 0) * 100}%`,
  };
}

// 설명 그림 칸(위)
function Picture({ row, children }: { row?: boolean; children: React.ReactNode }) {
  return (
    <section
      className={cx(
        "flex rounded-widget bg-brand-soft px-4 py-5",
        row ? "items-start justify-center gap-4" : "flex-col items-center gap-4",
      )}
    >
      {children}
    </section>
  );
}

// 한 줄 설명(아래)
function Say({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-1">
      <h2 className="m-0 whitespace-pre-line text-heading font-bold text-ink">{title}</h2>
      <p className="m-0 text-body text-sub">{children}</p>
    </div>
  );
}

function MiniPhone({ children }: { children: React.ReactNode }) {
  return <div className="pib-tw-wall relative h-60 w-28 overflow-hidden rounded-widget border-4 border-ink">{children}</div>;
}

function PageDots({ active }: { active: number }) {
  return (
    <span className="absolute inset-x-0 bottom-3 flex justify-center gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i === active ? "size-1 rounded-full bg-white" : "size-1 rounded-full bg-white/45"} />
      ))}
    </span>
  );
}

function Shot({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="relative w-40 shrink-0 overflow-hidden rounded-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- 이 기기 안 blob 스크린샷 */}
      <img src={url} alt="" draggable={false} className="block w-full select-none" />
      {children}
    </div>
  );
}

function Choice({
  icon,
  title,
  sub,
  dark,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  dark?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-16 items-center gap-3 rounded-card border border-line bg-card px-4 py-3 text-left active:bg-fill disabled:opacity-50"
    >
      <span
        className={cx(
          "flex size-10 shrink-0 items-center justify-center rounded-field",
          dark ? "bg-brand text-on-brand" : "bg-fill text-brand",
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex flex-1 flex-col">
        <span className="text-body-lg font-bold text-ink">{title}</span>
        <span className="text-caption text-sub">{sub}</span>
      </span>
      <IconChevronRight size={20} stroke={2} className="text-faint" aria-hidden="true" />
    </button>
  );
}
