// iOS Safari에 "홈 화면에 추가" 안내 배너를 띄우기 위한 환경 판별 유틸.
// 네이티브 앱(Capacitor)이나 이미 설치된 PWA(standalone)에서는 절대 노출되면 안 된다.

const DISMISS_KEY = "packinbag-install-prompt-dismissed-at";
const SNOOZE_DAYS = 7;

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIphoneOrIpad = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+는 UA에 Macintosh로 뜨지만 터치 포인트가 있다는 걸로 구분 가능
  const isIpadOS = ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
  return isIphoneOrIpad || isIpadOS;
}

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

// 카카오톡, 인스타그램, 네이버, 라인, 페이스북 등 인앱 브라우저는
// 공유 버튼이 없거나 Safari와 동작이 달라서 별도 안내가 필요함
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua);
}

// Capacitor는 네이티브 웹뷰에 window.Capacitor 전역 객체를 주입한다.
// server.url 방식으로 원격 페이지를 불러오는 경우에도 동일하게 주입되므로
// 패키지를 따로 import하지 않고 전역 객체 존재 여부만 확인하면 충분하다.
export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  return !!w.Capacitor?.isNativePlatform?.();
}

export function shouldShowInstallHint(): boolean {
  if (isCapacitorNative()) return false;
  if (isStandalonePWA()) return false;
  if (!isIosDevice()) return false;

  const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
  if (dismissedAt) {
    const elapsedDays =
      (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
    if (elapsedDays < SNOOZE_DAYS) return false;
  }
  return true;
}

export function snoozeInstallHint(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
}
