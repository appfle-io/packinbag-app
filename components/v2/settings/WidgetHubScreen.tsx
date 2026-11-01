"use client";

// 설정 > 위젯(1.12, 2026-11-01. 그 전에는 "위젯 꾸미기" = 가방 바로가기 꾸미기 목록).
// 맨 위 투명 위젯 카드(이 아이폰 한 번 맞추기) + 위젯 종류를 따로: 팩 위젯(꾸미기는 홈 화면 위젯 편집, 안내 화면) ·
// 가방 바로가기(꾸미기는 여기서, WidgetStylesScreen). 사용자 "가방 바로가기와 다른 위젯을 확실히 나누기"
import { useEffect, useMemo, useState } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import type { Bag } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { isPremiumUser } from "@/lib/premiumLimits";
import SlideScreen from "@/components/SlideScreen";
import { clearHomeWallpaper, homeWallpaperState, type HomeWallpaperState } from "@/lib/v2/nativeBridge";
import { SAMPLE_WIDGET_BAG, widgetBagStats } from "@/lib/v2/widgetStyles";
import { SubScreen } from "./SubScreen";
import { TransparentWidgetCard } from "./HomeWallpaperCard";
import { TransparentWizard } from "./TransparentWizard";
import { PackWidgetGuide } from "./PackWidgetGuide";
import { WidgetStylesScreen } from "./WidgetStylesScreen";

type View = "wizard" | "pack" | "bookmark" | null;

export function WidgetHubScreen({ onBack, bags }: { onBack: () => void; bags: Bag[] }) {
  const { profile } = useAuth();
  const { show } = useToast();
  const premium = isPremiumUser(profile?.email, profile);
  const styleCount = profile?.widgetStyles?.length ?? 0;
  // undefined = 아직 모름, null = 이 앱 빌드는 팩 위젯 투명을 못 씀(1.10 이하)
  const [wall, setWall] = useState<HomeWallpaperState | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [view, setViewRaw] = useState<View>(null);
  // 닫히는 애니메이션(SlideScreen 280ms) 동안 내용을 남기고, 끝나면 내려서 다음에 열 때 처음부터
  const [mounted, setMounted] = useState<Partial<Record<Exclude<View, null>, boolean>>>({});
  const setView = (v: View) => {
    setViewRaw(v);
    if (v) setMounted((m) => ({ ...m, [v]: true }));
  };
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(view ? { [view]: true } : {}), 320);
    return () => window.clearTimeout(t);
  }, [view]);
  const isOn = (v: Exclude<View, null>) => view === v || !!mounted[v];

  useEffect(() => {
    let alive = true;
    void homeWallpaperState().then((s) => alive && setWall(s));
    return () => {
      alive = false;
    };
  }, []);

  const bagStats = useMemo(() => {
    const b = bags.find((x) => !x.trashedByOwnerAt);
    return b ? widgetBagStats(b) : SAMPLE_WIDGET_BAG;
  }, [bags]);

  const clear = async () => {
    setBusy(true);
    try {
      setWall(await clearHomeWallpaper());
      show("투명을 지웠어요. 투명을 고른 팩 위젯은 기본 바탕이 돼요");
    } catch {
      show("지우지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const close = () => setView(null);

  return (
    <SubScreen title="위젯" onBack={onBack} bodyClassName="gap-6">
      {wall !== undefined && (
        <TransparentWidgetCard state={wall} premium={premium} busy={busy} onStart={() => setView("wizard")} onClear={() => void clear()} />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="m-0 px-1 text-caption font-semibold text-sub">위젯 종류</h2>
        <KindCard
          title="팩 위젯"
          size="작게 · 중간 · 크게"
          line="체크리스트를 보며 바로 체크해요"
          how="꾸미기: 홈 화면에서 위젯을 길게 눌러요"
          thumb={<PackThumb />}
          onClick={() => setView("pack")}
        />
        <KindCard
          title="가방 바로가기"
          size="작게"
          line="누르면 그 가방이 바로 열려요"
          how={styleCount > 0 ? `꾸미기: 여기서 만들어요 · ${styleCount}개` : "꾸미기: 여기서 만들어요"}
          thumb={<BookmarkThumb />}
          onClick={() => setView("bookmark")}
        />
      </section>

      <p className="m-0 px-1 text-micro text-faint">잠금화면 위젯에는 투명을 쓸 수 없어요.</p>

      <SlideScreen active={view === "wizard"} onBackdropClick={close} swipeBack>
        {isOn("wizard") && (
          <TransparentWizard
            onClose={close}
            state={wall ?? null}
            bagStats={bagStats}
            onFitted={setWall}
            onPack={() => setView("pack")}
            onBookmarkSaved={() => setView("bookmark")}
          />
        )}
      </SlideScreen>
      <SlideScreen active={view === "pack"} onBackdropClick={close} swipeBack>
        {isOn("pack") && <PackWidgetGuide onBack={close} state={wall ?? null} onStartWizard={() => setView("wizard")} />}
      </SlideScreen>
      <SlideScreen active={view === "bookmark"} onBackdropClick={close} swipeBack>
        {isOn("bookmark") && <WidgetStylesScreen onBack={close} bags={bags} />}
      </SlideScreen>
    </SubScreen>
  );
}

function KindCard({
  title,
  size,
  line,
  how,
  thumb,
  onClick,
}: {
  title: string;
  size: string;
  line: string;
  how: string;
  thumb: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-4 rounded-card border border-line bg-card p-4 text-left active:bg-fill">
      {thumb}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className="text-body-lg font-bold text-ink">{title}</span>
          <span className="text-caption text-sub">{size}</span>
        </span>
        <span className="text-body text-sub">{line}</span>
        <span className="text-micro text-faint">{how}</span>
      </span>
      <IconChevronRight size={20} stroke={2} className="shrink-0 text-faint" aria-hidden="true" />
    </button>
  );
}

function PackThumb() {
  return (
    <span className="flex size-16 shrink-0 flex-col gap-1 rounded-card bg-fill p-2" aria-hidden="true">
      <span className="text-micro font-bold text-ink">기저귀 팩</span>
      {[true, false, false].map((done, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className={done ? "size-2 rounded-control bg-brand" : "size-2 rounded-control border border-faint"} />
          <span className={i === 2 ? "h-1 w-1/2 rounded-full bg-line-strong" : "h-1 flex-1 rounded-full bg-line-strong"} />
        </span>
      ))}
    </span>
  );
}

function BookmarkThumb() {
  return (
    <span className="flex size-16 shrink-0 flex-col justify-between rounded-card bg-brand p-2 text-on-brand" aria-hidden="true">
      <span className="self-start rounded-full border border-current px-1 text-micro font-bold">D-7</span>
      <span className="text-micro font-bold">시우 가방</span>
      <span className="flex h-1 rounded-full bg-white/30">
        <span className="w-3/5 rounded-full bg-white" />
      </span>
    </span>
  );
}
