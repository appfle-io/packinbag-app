// 공유 링크 브리지(2026-10-12). 카톡 같은 앱 안 브라우저로 공유 링크(/v/{token}?code=…)를 열면 로그인이 없어서
// 다시 로그인해야 했다. 그래서 링크를 연 곳에 따라 앱이나 기본 브라우저로 넘긴다.
// - 아이폰: 팩인백 앱을 연다(packinbag://open?to=경로 → 앱이 그 경로로 이동, lib/v2/bagReminders.onBagNotificationTap).
//   앱이 안 열리면(설치 안 됨) 앱스토어로. 웹에서는 설치 여부를 직접 알 수 없어서 "열어 보고 안 되면" 방식
// - 안드로이드(갤럭시) · 앱 안 브라우저: 기본 브라우저에서 같은 주소를 연다(카톡은 kakaotalk://web/openExternal, 그 밖은 intent://)
// - PC · 보통 브라우저: 그대로(이미 로그인돼 있음)
// - 팩인백 앱 안(Capacitor)에서는 아무것도 하지 않는다
// 유니버설 링크(링크를 누르면 바로 앱)는 1.6 네이티브에서 Associated Domains를 붙이면 메시지 · 메모 · 사파리에서도 된다(카톡 안 브라우저는 여전히 이 브리지)

export const APP_STORE_ID = "6793290752";
export const APP_STORE_URL = `https://apps.apple.com/kr/app/id${APP_STORE_ID}`;

type InAppBrowser = "kakao" | "other" | null;

export interface BridgeEnv {
  ios: boolean;
  android: boolean;
  inApp: InAppBrowser;
  nativeApp: boolean;
}

export function detectBridgeEnv(): BridgeEnv {
  if (typeof navigator === "undefined") return { ios: false, android: false, inApp: null, nativeApp: false };
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const inApp: InAppBrowser = /KAKAOTALK/i.test(ua)
    ? "kakao"
    : /NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|Whale\/.*Mobile.*inapp/i.test(ua)
      ? "other"
      : null;
  const w = typeof window !== "undefined" ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }) : undefined;
  return { ios, android, inApp, nativeApp: !!w?.Capacitor?.isNativePlatform?.() };
}

// 앱 안에서 열 경로는 이 사이트 안 경로만(다른 사이트로 보내지 않게)
export function isSafeAppPath(path: string | null | undefined): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && path.length < 500;
}

function appSchemeUrl(path: string): string {
  return `packinbag://open?to=${encodeURIComponent(path)}`;
}

// 앱 안 브라우저 → 기본 브라우저
export function externalBrowserUrl(absoluteUrl: string, env: BridgeEnv): string | null {
  if (env.inApp === "kakao") return `kakaotalk://web/openExternal?url=${encodeURIComponent(absoluteUrl)}`;
  if (env.android && env.inApp) {
    const u = new URL(absoluteUrl);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
  }
  return null;
}

// 아이폰: 앱 열기를 시도하고, 화면을 떠나지 않으면(앱이 없음) 앱스토어로.
// 앱 열기 확인 창("팩인백에서 열까요?")이 떠도 blur가 오므로 그때는 앱스토어로 보내지 않는다
export function tryOpenIosApp(path: string, opts: { fallbackToStore: boolean; waitMs?: number } = { fallbackToStore: true }): () => void {
  let left = false;
  const mark = () => {
    left = true;
  };
  const onVisibility = () => document.visibilityState === "hidden" && mark();
  window.addEventListener("blur", mark);
  window.addEventListener("pagehide", mark);
  document.addEventListener("visibilitychange", onVisibility);
  const cleanup = () => {
    window.removeEventListener("blur", mark);
    window.removeEventListener("pagehide", mark);
    document.removeEventListener("visibilitychange", onVisibility);
  };
  const timer = window.setTimeout(() => {
    cleanup();
    if (!left && opts.fallbackToStore) window.location.href = APP_STORE_URL;
  }, opts.waitMs ?? 2200);
  window.location.href = appSchemeUrl(path);
  return () => {
    window.clearTimeout(timer);
    cleanup();
  };
}

// "열기 · 참여하기" 버튼: 브리지가 맡았으면 true(링크 기본 동작을 막는다)
export function openViaBridge(path: string): boolean {
  if (!isSafeAppPath(path)) return false;
  const env = detectBridgeEnv();
  if (env.nativeApp) return false;
  // 아이폰 사파리는 로그인이 남아 있어 웹으로 그대로 간다(앱이 없을 때 뜨는 사파리 오류 창을 피함). 앱으로는 AppBridge 카드에서
  if (env.ios && env.inApp) {
    tryOpenIosApp(path, { fallbackToStore: true });
    return true;
  }
  if (env.inApp) {
    const ext = externalBrowserUrl(new URL(path, window.location.origin).toString(), env);
    if (ext) {
      window.location.href = ext;
      return true;
    }
  }
  return false;
}
