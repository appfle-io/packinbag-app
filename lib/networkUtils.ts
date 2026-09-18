/**
 * 네트워크 연결 상태 및 폐쇄망 도달 가능성 판별 유틸리티
 * Electron, PWA, 모바일/데스크톱 브라우저 환경을 모두 지원합니다.
 */

export async function checkIsOnline(timeoutMs = 2000): Promise<boolean> {
  if (typeof window === "undefined") return true;

  // 1. Electron 환경인 경우: 메인 프로세스의 HTTPS 실제 인증서/도메인 검증 IPC 호출
  if ((window as any).electronAPI?.checkInternet) {
    try {
      const ok = await (window as any).electronAPI.checkInternet();
      return Boolean(ok);
    } catch {
      return false;
    }
  }

  // 2. 브라우저/PWA 환경: OS/브라우저 수준에서 네트워크 단절인 경우 즉시 false
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }

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
