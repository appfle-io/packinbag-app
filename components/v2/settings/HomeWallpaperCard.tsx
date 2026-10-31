"use client";

// 팩 위젯 배경화면(1.11, 2026-11-01). 설정 > 위젯 꾸미기 맨 아래.
// 이 아이폰의 빈 페이지 스크린샷 1장 → 위젯이 놓일 수 있는 자리마다 잘라(작게 6 · 중간 3 · 크게 2, lib/v2/wallpaperFit)
// 네이티브 App Group에 둔다(기기마다 배경화면이 달라 서버에 안 올림). 팩 위젯(작게 · 중간 · 크게)을 길게 눌러
// 위젯 편집 → 배경 "배경화면" + "배경화면 위치"를 고르면 그 조각이 깔린다. 예전 빌드(메서드 없음)에서는 칸을 숨긴다
import { useEffect, useState } from "react";
import { Button, Chip, cx } from "@/components/v2/ui";
import { useToast } from "@/components/Toast";
import { clearHomeWallpaper, homeWallpaperState, saveHomeWallpaper } from "@/lib/v2/nativeBridge";
import { cropWallpaperPieces, defaultVeil, homeWallpaperPieces, widgetSlotLayouts, type SlotLayout } from "@/lib/v2/wallpaperFit";

type State = { set: boolean; setAt?: number };

export function HomeWallpaperCard({ premium }: { premium: boolean }) {
  const { show } = useToast();
  // undefined = 아직 모름, null = 이 앱 빌드는 못 씀
  const [state, setState] = useState<State | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  // 앱 이름 보임 · 숨김처럼 배치가 둘 이상인 기종(iOS 18 이하)은 고른 뒤 맞춘다
  const [pending, setPending] = useState<{ file: File; layouts: SlotLayout[] } | null>(null);

  useEffect(() => {
    let alive = true;
    void homeWallpaperState().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;

  const apply = async (file: Blob, layout: SlotLayout) => {
    setBusy(true);
    try {
      const pieces = await cropWallpaperPieces(file, homeWallpaperPieces(layout), defaultVeil());
      setState(await saveHomeWallpaper(pieces));
      setPending(null);
      show("배경화면을 맞췄어요. 팩 위젯을 길게 눌러 배경과 위치를 골라 주세요");
    } catch (err) {
      console.error("[팩인백] 팩 위젯 배경화면 저장 실패:", err);
      show("배경화면을 맞추지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const onShot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    let layouts: SlotLayout[] | null = null;
    try {
      const bitmap = await createImageBitmap(file);
      layouts = widgetSlotLayouts(bitmap.width, bitmap.height);
      bitmap.close?.();
    } catch {
      show("사진을 읽지 못했어요");
      return;
    }
    if (!layouts) {
      show("이 아이폰은 아직 배경화면 맞추기를 쓸 수 없어요");
      return;
    }
    if (layouts.length > 1) setPending({ file, layouts });
    else void apply(file, layouts[0]);
  };

  const clear = async () => {
    setBusy(true);
    try {
      setState(await clearHomeWallpaper());
      show("배경화면을 지웠어요. 배경화면을 고른 위젯은 기본 바탕이 돼요");
    } catch {
      show("지우지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const at = state.setAt ? new Date(state.setAt) : null;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-card p-4">
      <span className="flex flex-col gap-1">
        <span className="text-body font-semibold text-ink">팩 위젯 배경화면</span>
        <span className="text-caption text-sub">
          팩 위젯(작게 · 중간 · 크게)이 홈 화면에 비쳐 보이게 해요. 위젯을 다 치운 빈 페이지 스크린샷을 한 번 고른 뒤, 위젯을 길게 눌러
          위젯 편집에서 배경 &quot;배경화면&quot;과 위치(위젯 왼쪽 위가 있는 칸)를 골라요.
        </span>
      </span>
      {!premium ? (
        <span className="text-caption text-faint">프리미엄에서 쓸 수 있어요</span>
      ) : (
        <>
          <span className="text-caption text-sub">
            {state.set && at ? `${at.getMonth() + 1}월 ${at.getDate()}일에 맞춰 두었어요 · 배경화면을 바꾸면 다시 골라 주세요` : "아직 안 맞췄어요"}
          </span>
          {pending && (
            <span className="flex flex-wrap gap-2">
              {pending.layouts.map((l) => (
                <Chip key={l.key} label={l.label || l.key} onClick={() => !busy && void apply(pending.file, l)} />
              ))}
            </span>
          )}
          <span className="flex flex-wrap gap-2">
            <label
              aria-disabled={busy || undefined}
              className={cx(
                "flex h-10 items-center justify-center rounded-field border border-line bg-card px-4 text-caption font-semibold text-ink",
                busy ? "pointer-events-none opacity-50" : "cursor-pointer active:bg-fill",
              )}
            >
              {busy ? "맞추는 중…" : state.set ? "다시 고르기" : "빈 페이지 스크린샷 고르기"}
              <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => void onShot(e)} />
            </label>
            {state.set && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void clear()}>
                지우기
              </Button>
            )}
          </span>
          {pending && <span className="text-micro text-faint">홈 화면 설정에 맞는 것을 눌러 주세요</span>}
          <span className="text-micro text-faint">이 아이폰에만 저장돼요. 잠금화면 위젯 · 가방 바로가기 위젯에는 쓰지 않아요.</span>
        </>
      )}
    </section>
  );
}
