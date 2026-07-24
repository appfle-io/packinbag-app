import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "팩인백 · Pack In Bag",
  description: "부부가 같이 짐을 싸는 체크리스트, 팩인백",
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
  themeColor: "#2563eb",
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
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
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
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
