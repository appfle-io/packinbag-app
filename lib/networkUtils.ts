/**
 * 네트워크 연결 상태 및 폐쇄망 도달 가능성 판별 유틸리티
 * Electron, PWA, 모바일/데스크톱 브라우저 환경을 모두 지원합니다.
 */

type ElectronWindow = Window & { electronAPI?: { checkInternet?: () => Promise<boolean> } };

export async function checkIsOnline(timeoutMs = 2000): Promise<boolean> {
  if (typeof window === "undefined") return true;
  const electronAPI = (window as ElectronWindow).electronAPI;

  // 1. Electron 환경인 경우: 메인 프로세스의 HTTPS 실제 인증서/도메인 검증 IPC 호출
  if (electronAPI?.checkInternet) {
    try {
      const ok = await electronAPI.checkInternet();
      return Boolean(ok);
    } catch {
      return false;
    }
  }

  // 2. 브라우저/PWA 환경: navigator.onLine이 false여도 바로 끊김으로 단정하지 않고 실제로 확인한다.
  //    iOS 웹뷰·PWA는 다시 연결된 뒤에도 onLine이 false로 남거나 online 이벤트가 안 오는 경우가 있어서,
  //    여기서 바로 false를 돌려주면 앱을 다시 켤 때까지 "끊김"에 갇힌다(10/4 실기기 확인).
  //    정말 끊겼으면 아래 요청이 금방 실패하므로 비용은 거의 없다.

  // 3. 브라우저/PWA 환경에서 LAN선/Wi-Fi는 연결되어 있으나 외부 인터넷이 막힌 폐쇄망 검사
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    // 실제 서비스 대표 도메인으로 최소 트래픽 검증
    await fetch(`https://packinbag.seeuson.com?t=${Date.now()}`, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
}

/**
 * 포터블(Electron) 앱인지. 포터블은 로컬 서버(127.0.0.1)에서 돌고, 새 창(https)은 전부 기본 브라우저로
 * 넘기기 때문에 Firebase 팝업 로그인(Google·Apple)이 동작하지 않는다 → 로그인 화면에서 그 버튼을 숨기는 데 쓴다.
 */
export function isElectronApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & { electronAPI?: { isElectron?: boolean } };
  return Boolean(w.electronAPI?.isElectron) || navigator.userAgent.toLowerCase().includes("electron");
}
