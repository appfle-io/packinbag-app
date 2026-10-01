import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { UI_V2 } from "@/lib/v2/flags";

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
    <html lang="ko" className={`h-full antialiased ${pretendard.variable}`} suppressHydrationWarning>
      <head>
        <Script
          id="set-initial-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: setInitialTheme }}
        />
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
