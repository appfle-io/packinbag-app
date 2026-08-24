"use client";

import { Capacitor } from "@capacitor/core";

// 짐/메모/에디터팩 안의 링크를 눌렀을 때 여는 공용 함수. 웹에서는 새 탭으로 열고,
// Capacitor(iOS 등) 네이티브 앱에서도 그대로 window.open을 쓴다 - Capacitor WebView는
// capacitor.config.ts의 server.url과 다른 호스트로 가는 네비게이션(302 리다이렉트로
// 도달한 곳 포함)을 기본적으로 시스템 브라우저(Safari)로 넘겨주기 때문에, 별도
// 플러그인(@capacitor/browser) 없이도 동일한 코드로 웹/네이티브 둘 다 동작한다.
// 나중에 "앱 안에서 반투명 브라우저로 열기" 같은 더 매끄러운 UX가 필요해지면
// @capacitor/browser를 설치해서 Capacitor.isNativePlatform() 분기에서 Browser.open()으로
// 바꾸면 된다(그 전까지는 새 네이티브 의존성/캡 sync 없이 이 방식으로 충분하다).
export function openExternalLink(url: string) {
  if (!url) return;
  try {
    let targetUrl = url.trim();
    if (
      !targetUrl.startsWith("http://") &&
      !targetUrl.startsWith("https://") &&
      !targetUrl.startsWith("mailto:") &&
      !targetUrl.startsWith("tel:")
    ) {
      targetUrl = `https://${targetUrl}`;
    }
    // Capacitor.isNativePlatform() 체크는 지금 당장은 분기가 필요 없지만, 나중에 네이티브
    // 전용 브라우저 플러그인으로 바꿀 자리를 남겨두기 위해 남겨둔다.
    void Capacitor.isNativePlatform();
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  } catch (err) {
    console.error("[팩인백] 링크 열기 실패:", err);
  }
}
