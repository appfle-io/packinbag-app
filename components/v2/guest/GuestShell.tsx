"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconBackpack, IconBulb, IconBulbOff, IconMoon, IconSun, IconTextSize } from "@tabler/icons-react";
import { IconButton, cx } from "@/components/v2/ui";

// 공유 보기(/v 가방, /p 팩 · 폴더 · 메모)의 v2 틀(2026-10-15, share.md 확인 필요 7 · 9).
// - 화면 모드 · 글자 크기는 이 보기 전용 키에 저장한다(packinbag_guest_theme · packinbag_guest_font_scale).
//   예전에는 앱과 같은 키(packinbag-theme)에 써서 같은 브라우저의 앱 화면 모드가 바뀌었다
// - 글자 크기는 이 화면 루트의 data-font-scale로만 바꾼다(v2 글자 토큰이 따라감). 화면 모드는 html에 적는다(시트 · 메모 보기까지)
// - 루트 레이아웃에는 ThemeProvider가 없어서 여기서 정한 값이 그대로 유지된다
type Scale = "sm" | "md" | "lg";
const THEME_KEY = "packinbag_guest_theme";
const SCALE_KEY = "packinbag_guest_font_scale";
const SCALE_LABEL: Record<Scale, string> = { sm: "작게", md: "보통", lg: "크게" };
const NEXT_SCALE: Record<Scale, Scale> = { sm: "md", md: "lg", lg: "sm" };

function readScale(): Scale {
  try {
    const v = localStorage.getItem(SCALE_KEY);
    if (v === "sm" || v === "md" || v === "lg") return v;
    // 예전 값(normal · large · xlarge)
    if (v === "large" || v === "xlarge") return "lg";
  } catch {}
  return "md";
}

function applyTheme(dark: boolean) {
  const el = document.documentElement;
  el.setAttribute("data-theme", dark ? "dark" : "light");
  el.classList.toggle("dark", dark);
}

export function GuestShell({
  badge,
  wakeLock = false,
  children,
  footer,
}: {
  // 위 줄 오른쪽 작은 라벨(예: "보기 전용")
  badge?: React.ReactNode;
  // 화면 켜두기 버튼(가방 보기에서)
  wakeLock?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [dark, setDark] = useState(false);
  const [scale, setScale] = useState<Scale>("md");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let initial = document.documentElement.getAttribute("data-theme") === "dark";
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "dark" || stored === "light") initial = stored === "dark";
    } catch {}
    applyTheme(initial);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 이 기기 저장값을 처음 한 번 읽는다
    setDark(initial);
    setScale(readScale());
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {}
  };

  const cycleScale = () => {
    const next = NEXT_SCALE[scale];
    setScale(next);
    try {
      localStorage.setItem(SCALE_KEY, next);
    } catch {}
  };

  // 화면 켜두기(Wake Lock). 탭을 다녀오면 다시 켠다
  const [awake, setAwake] = useState(false);
  const sentinelRef = useRef<{ release: () => Promise<void> } | null>(null);
  const request = async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (!nav.wakeLock) return false;
      sentinelRef.current = await nav.wakeLock.request("screen");
      return true;
    } catch {
      return false;
    }
  };
  const toggleAwake = async () => {
    if (awake) {
      await sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
      setAwake(false);
      return;
    }
    if (await request()) setAwake(true);
    else setNotice("이 브라우저에서는 화면 켜두기를 쓸 수 없어요");
  };
  useEffect(() => {
    if (!awake) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [awake]);
  useEffect(() => () => void sentinelRef.current?.release().catch(() => {}), []);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(t);
  }, [notice]);

  return (
    <main
      data-font-scale={scale === "md" ? undefined : scale}
      className="pib-v2 flex h-dvh w-full flex-col overflow-hidden bg-canvas text-ink"
    >
      <header className="pt-safe shrink-0 border-b border-line bg-canvas">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 px-2 text-ink no-underline">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-field bg-brand text-on-brand">
              <IconBackpack size={16} stroke={2} />
            </span>
            <span className="truncate text-body font-bold">팩인백</span>
            {badge}
          </Link>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={cycleScale}
              aria-label={`글자 크기 ${SCALE_LABEL[scale]}`}
              className="inline-flex h-11 items-center gap-1 rounded-field px-2 text-caption text-sub active:bg-fill"
            >
              <IconTextSize size={18} stroke={1.75} />
              {SCALE_LABEL[scale]}
            </button>
            {wakeLock && (
              <IconButton label={awake ? "화면 켜두기 끄기" : "화면 켜두기"} onClick={toggleAwake}>
                {awake ? <IconBulb size={20} stroke={1.75} className="text-brand" /> : <IconBulbOff size={20} stroke={1.75} />}
              </IconButton>
            )}
            <IconButton label={dark ? "밝은 화면" : "어두운 화면"} onClick={toggleTheme}>
              {dark ? <IconSun size={20} stroke={1.75} /> : <IconMoon size={20} stroke={1.75} />}
            </IconButton>
          </div>
        </div>
      </header>

      <div className="pib-v2-no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

      {footer && (
        <footer className="pb-safe-4 shrink-0 border-t border-line bg-card">
          <div className="mx-auto w-full max-w-5xl px-4 pt-3">{footer}</div>
        </footer>
      )}

      {notice && (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-5">
          <span className={cx("rounded-card bg-ink px-4 py-3 text-body text-on-ink")}>{notice}</span>
        </div>
      )}
    </main>
  );
}

// 공유가 끝났거나 없는 링크
export function GuestEnded({ title, message }: { title: string; message: string }) {
  return (
    <main className="pib-v2 flex h-dvh w-full items-center justify-center bg-canvas p-5 text-ink">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-card border border-line bg-card p-8 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-fill text-sub">
          <IconBackpack size={24} stroke={1.75} />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-body-lg font-bold">{title}</h1>
          <p className="m-0 text-caption text-sub">{message}</p>
        </div>
        <Link
          href="/"
          className="inline-flex h-12 w-full items-center justify-center rounded-card bg-ink text-body font-semibold text-on-ink no-underline"
        >
          팩인백 홈으로
        </Link>
      </div>
    </main>
  );
}
