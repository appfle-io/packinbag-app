"use client";

// 설정 > 위젯 맨 위 "투명 위젯" 카드(1.12, 2026-11-01. 1.11에는 위젯 꾸미기 맨 아래 "팩 위젯 배경화면" 카드였음).
// 보통 · 투명 그림 + 한 줄 + 이 아이폰 상태 + [투명 위젯 맞추기](TransparentWizard). 맞춘 조각은 이 기기 App Group에만(서버에 안 올림)
import { Button } from "@/components/v2/ui";
import type { HomeWallpaperState } from "@/lib/v2/nativeBridge";

export function TransparentWidgetCard({
  state,
  premium,
  busy,
  onStart,
  onClear,
}: {
  // null = 이 앱 빌드는 팩 위젯 투명을 못 씀(1.10 이하) · 가방 바로가기는 됨
  state: HomeWallpaperState | null;
  premium: boolean;
  busy: boolean;
  onStart: () => void;
  onClear: () => void;
}) {
  const at = state?.setAt ? new Date(state.setAt) : null;
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-card p-4">
      <div className="pib-tw-wall flex h-36 items-center justify-center gap-8 overflow-hidden rounded-field" aria-hidden="true">
        <DemoWidget clear={false} />
        <DemoWidget clear />
      </div>
      <span className="flex items-center gap-2">
        <span className="text-body-lg font-bold text-ink">투명 위젯</span>
        <span className="rounded-full bg-brand-soft px-2 text-micro font-semibold text-brand">1분</span>
      </span>
      <span className="text-body text-sub">위젯 뒤로 배경화면이 이어져 보여요. 스크린샷 한 장이면 돼요.</span>
      {!premium ? (
        <span className="text-caption text-faint">프리미엄에서 쓸 수 있어요</span>
      ) : (
        <>
          <span className="flex items-center gap-2 text-caption text-sub">
            <span className={state?.set ? "size-2 shrink-0 rounded-full bg-brand" : "size-2 shrink-0 rounded-full bg-line-strong"} />
            {state?.set && at
              ? `${at.getMonth() + 1}월 ${at.getDate()}일에 맞췄어요 · 아이콘 크기나 배경화면을 바꾸면 다시 맞춰요`
              : state === null
                ? "이 앱에서는 가방 바로가기에만 쓸 수 있어요 · 앱을 업데이트하면 팩 위젯도"
                : "이 아이폰 · 아직 안 맞췄어요"}
          </span>
          <Button block disabled={busy} onClick={onStart}>
            {state?.set ? "다시 맞추기" : "투명 위젯 맞추기"}
          </Button>
          {state?.set && (
            <Button size="sm" variant="text" disabled={busy} onClick={onClear} className="self-center">
              투명 지우기
            </Button>
          )}
        </>
      )}
    </section>
  );
}

// 보통 · 투명 비교 그림(글자 줄은 막대로)
function DemoWidget({ clear }: { clear: boolean }) {
  return (
    <span className="flex flex-col items-center gap-2">
      <span
        className={
          clear
            ? "flex size-24 flex-col gap-2 rounded-widget border border-white/50 bg-white/10 p-3 text-white"
            : "flex size-24 flex-col gap-2 rounded-widget bg-white p-3 text-ink"
        }
      >
        <span className="text-micro font-bold">기저귀 팩 3/8</span>
        <span className={clear ? "h-1 w-11/12 rounded-full bg-white/70" : "h-1 w-11/12 rounded-full bg-line"} />
        <span className={clear ? "h-1 w-2/3 rounded-full bg-white/70" : "h-1 w-2/3 rounded-full bg-line"} />
        <span className={clear ? "h-1 w-4/5 rounded-full bg-white/70" : "h-1 w-4/5 rounded-full bg-line"} />
      </span>
      <span className="rounded-full bg-black/40 px-2 text-micro font-semibold text-white">{clear ? "투명" : "보통"}</span>
    </span>
  );
}
