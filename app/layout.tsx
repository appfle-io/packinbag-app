import type { Metadata, Viewport } from "next";
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
    var ACCENTS = {
      blue:   { light: ["#2563eb","#1d4ed8","#dbeafe"], dark: ["#3b82f6","#60a5fa","#172554"] },
      red:    { light: ["#dc2626","#b91c1c","#fee2e2"], dark: ["#f87171","#fca5a5","#450a0a"] },
      orange: { light: ["#ea580c","#c2410c","#ffedd5"], dark: ["#fb923c","#fdba74","#431407"] },
      amber:  { light: ["#d97706","#b45309","#fef3c7"], dark: ["#fbbf24","#fcd34d","#451a03"] },
      green:  { light: ["#16a34a","#15803d","#dcfce7"], dark: ["#4ade80","#86efac","#052e12"] },
      teal:   { light: ["#0d9488","#0f766e","#ccfbf1"], dark: ["#2dd4bf","#5eead4","#042f2c"] },
      purple: { light: ["#7c3aed","#6d28d9","#ede9fe"], dark: ["#a78bfa","#c4b5fd","#2e1065"] },
      pink:   { light: ["#db2777","#be185d","#fce7f3"], dark: ["#f472b6","#f9a8d4","#500724"] },
      gray:   { light: ["#4b5563","#374151","#e5e7eb"], dark: ["#9ca3af","#d1d5db","#27272a"] }
    };
    var stored = window.localStorage.getItem('packinbag-theme') || 'system';
    var resolved = stored === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : stored;
    document.documentElement.setAttribute('data-theme', resolved);

    var accentId = window.localStorage.getItem('packinbag-accent') || 'blue';
    var resolvedTone;
    if (accentId === 'custom') {
      var customHex = window.localStorage.getItem('packinbag-accent-custom') || '#8b5cf6';
      var hex = customHex.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(function(c){ return c + c; }).join('');
      var num = parseInt(hex, 16) || 0;
      var r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
      var rn = r / 255, gn = g / 255, bn = b / 255;
      var max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
      var h = 0, s = 0, l = (max + min) / 2, d = max - min;
      if (d !== 0) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
        else if (max === gn) h = (bn - rn) / d + 2;
        else h = (rn - gn) / d + 4;
        h /= 6;
      }
      function hue2rgb(p, q, t) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      }
      function hslToHex(hh, ss, ll) {
        hh = ((hh % 360) + 360) % 360 / 360; ss /= 100; ll /= 100;
        var rr, gg, bb;
        if (ss === 0) { rr = gg = bb = ll; }
        else {
          var q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
          var p = 2 * ll - q;
          rr = hue2rgb(p, q, hh + 1/3); gg = hue2rgb(p, q, hh); bb = hue2rgb(p, q, hh - 1/3);
        }
        function toHex(v) { return Math.round(Math.min(255, Math.max(0, v * 255))).toString(16).padStart(2, '0'); }
        return '#' + toHex(rr) + toHex(gg) + toHex(bb);
      }
      var strongL = resolved === 'light' ? 38 : 68;
      var softL = resolved === 'light' ? 94 : 16;
      var softS = Math.min(55, Math.max(15, s * 100 * 0.6));
      var satPct = Math.min(95, Math.max(40, s * 100));
      resolvedTone = ['#' + hex, hslToHex(h * 360, satPct, strongL), hslToHex(h * 360, softS, softL)];
    } else {
      resolvedTone = (ACCENTS[accentId] || ACCENTS.blue)[resolved];
    }
    document.documentElement.style.setProperty('--accent', resolvedTone[0]);
    document.documentElement.style.setProperty('--accent-strong', resolvedTone[1]);
    document.documentElement.style.setProperty('--accent-soft', resolvedTone[2]);
  } catch (e) {}
})();
`;

// 서비스 워커 등록 스크립트.
// public/sw.js는 캐싱 없는 최소 버전(fetch 핸들러만 있음) - 안드로이드
// 설치 배너 조건만 채우는 용도라, 기존 새 버전 감지(build-info 폴링) 로직과
// 캐싱 대상이 겹치지 않아서 충돌 없음.
const registerServiceWorker = `
(function () {
  try {
    // Capacitor 네이티브 앱(iOS 등) 안에서는 PWA 설치가 의미 없어서
    // 서비스 워커 등록도 하지 않고 건너뜀.
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      return;
    }
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {
          // 등록 실패해도 앱 사용 자체엔 영향 없음 (설치 배너만 안 뜸)
        });
      });
    }
  } catch (e) {}
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
        <script dangerouslySetInnerHTML={{ __html: setInitialTheme }} />
        {/* 안드로이드 크롬 PWA 설치 배너(beforeinstallprompt)가 뜨려면
            fetch 핸들러가 있는 서비스 워커 등록이 필수라서 추가함.
            Capacitor 네이티브 앱(iOS 등)에서는 PWA 설치가 의미 없으니
            window.Capacitor.isNativePlatform() 체크로 등록을 건너뜀
            (lib/installPromptUtils.ts의 isCapacitorNative()와 동일한 판별 로직,
            여긴 head 인라인 스크립트라 같은 체크를 그대로 복사해서 씀). */}
        <script dangerouslySetInnerHTML={{ __html: registerServiceWorker }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
