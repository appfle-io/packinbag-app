import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { UI_V2 } from "@/lib/v2/flags";
import { INITIAL_FONT_SCRIPT } from "@/lib/v2/appFonts";

// 리디자인 v2 기본 폰트. 폐쇄망/Electron 오프라인에서도 동작해야 해서 CDN 대신 앱에 포함한다.
// (Pretendard Variable, SIL OFL 1.1) 구 UI는 globals.css body font-family를 그대로 쓰고,
// v2 화면만 .pib-v2 클래스로 var(--font-ui)를 쓴다.
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
  preload: false,
});

// 리디자인 v2 고를 수 있는 앱 글꼴(설정 > 화면 > 글꼴, lib/v2/appFonts.ts). preload: false라 고른 글꼴만 내려받는다.
// 크기·줄 높이 보정(숫자는 폰트 파일을 재서 얻은 값, 2026-10-04)
// - size-adjust: 한글 높이 비율과 한글 폭 비율(Pretendard 대비)의 평균. 글꼴을 바꿔도 줄이 넘치거나 줄어들지 않게
//     지마켓 높이 1.00·폭 0.90 → 95% / D2코딩 높이 0.93·폭 0.86 → 90% / 개구 높이 0.99·폭 1.05 → 102%
// - ascent/descent/line-gap-override: Pretendard 값(95.2% / 24.1% / 0)을 size-adjust로 나눈 값.
//     버튼·칩 안 글자가 위아래로 치우치지 않고, 줄 높이 토큰(text-body 등)이 글꼴과 상관없이 같게 보인다
const gmarket = localFont({
  src: [
    { path: "./fonts/GmarketSansLight.woff2", weight: "300" },
    { path: "./fonts/GmarketSansMedium.woff2", weight: "500" },
    { path: "./fonts/GmarketSansBold.woff2", weight: "700" },
  ],
  variable: "--font-gmarket",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "size-adjust", value: "95%" },
    { prop: "ascent-override", value: "100.2%" },
    { prop: "descent-override", value: "25.4%" },
    { prop: "line-gap-override", value: "0%" },
  ],
});
const d2coding = localFont({
  src: [
    { path: "./fonts/D2Coding-Regular.woff2", weight: "400" },
    { path: "./fonts/D2Coding-Bold.woff2", weight: "700" },
  ],
  variable: "--font-d2coding",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "size-adjust", value: "90%" },
    { prop: "ascent-override", value: "105.8%" },
    { prop: "descent-override", value: "26.8%" },
    { prop: "line-gap-override", value: "0%" },
  ],
});
const gaegu = localFont({
  src: [
    { path: "./fonts/Gaegu-Regular.woff2", weight: "400" },
    { path: "./fonts/Gaegu-Bold.woff2", weight: "700" },
  ],
  variable: "--font-gaegu",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "size-adjust", value: "102%" },
    { prop: "ascent-override", value: "93.3%" },
    { prop: "descent-override", value: "23.6%" },
    { prop: "line-gap-override", value: "0%" },
  ],
});

export const metadata: Metadata = {
  title: "팩인백 · Pack In Bag",
  description: "부부가 같이 아이템을 싸는 체크리스트, 팩인백",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "팩인백",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1e" },
  ],
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

const setInitialTheme = `
(function () {
  try {
    var stored = localStorage.getItem('packinbag-theme') || 'system';
    var resolved = stored === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : stored;
    document.documentElement.setAttribute('data-theme', resolved);
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

const registerServiceWorker = `
(function () {
  try {
    var w = window;
    var cap = w.Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return;
  } catch (e) {}
  if ('serviceWorker' in navigator) {
    w.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`h-full antialiased ${pretendard.variable} ${gmarket.variable} ${d2coding.variable} ${gaegu.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="set-initial-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: setInitialTheme }}
        />
        {/* v2: 고른 앱 글꼴을 첫 화면부터(리액트보다 먼저) 적용해 글꼴이 바뀌며 깜빡이지 않게 */}
        {UI_V2 && (
          <Script
            id="set-initial-font"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: INITIAL_FONT_SCRIPT }}
          />
        )}
        {/* 안드로이드 크롬 PWA 설치 배너(beforeinstallprompt)가 뜨려면
            fetch 핸들러가 있는 서비스 워커 등록이 필수라서 추가함.
            Capacitor 네이티브 앱(iOS 등)에서는 PWA 설치가 의미 없으니
            window.Capacitor.isNativePlatform() 체크로 등록을 건너뜀
            (lib/installPromptUtils.ts의 isCapacitorNative()와 동일한 판별 로직,
            여긴 head 인라인 스크립트라 같은 체크를 그대로 복사해서 씀). */}
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: registerServiceWorker }}
        />
      </head>
      {/* v2: 재사용 중인 구 컴포넌트·게스트 보기의 색·폰트를 v2 토큰으로 (globals.css .pib-v2-legacy) */}
      <body className={`min-h-full flex flex-col${UI_V2 ? " pib-v2-legacy" : ""}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
