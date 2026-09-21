// 데스크톱 포터블(Electron) 및 웹 환경 공용 API URL 리졸버.
// 포터블 앱이 온라인 계정으로 실행될 때 로컬(127.0.0.1) 대신 실제 원격 서버 API를 호출하도록 지원합니다.

export const REMOTE_API_ORIGIN = "https://packinbag.seeuson.com";

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    const isElectron =
      Boolean((window as unknown as { electronAPI?: unknown }).electronAPI) ||
      navigator.userAgent.toLowerCase().includes("electron");
    if (isElectron) {
      return `${REMOTE_API_ORIGIN}${cleanPath}`;
    }
  }
  return cleanPath;
}
