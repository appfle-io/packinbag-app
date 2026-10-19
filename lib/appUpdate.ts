// 새 버전 확인(2026-10-19). 설정 > 버전 정보를 열 때만 확인한다(예전 10분 폴링 · 알림 종 점은 없앰).
// 사용자에게는 "새 버전이 있어요 · 업데이트" 하나로 보이고, 무엇을 할지는 여기서 고른다.
// - store: iOS 앱인데 App Store에 더 새 앱 버전이 있다 → App Store로 보낸다(새 빌드가 필요한 기능 · 위젯 등)
// - web:   앱 버전은 최신이고 웹(Vercel)만 새로 배포됐다 → 다시 불러오면 끝(iOS 앱도 server.url이라 같음)
// - latest: 둘 다 최신
// App Store 버전은 서버(/api/build-info)가 Apple 조회 API에서 받아 온다(1시간 캐시). 못 받으면 null → 웹만 비교

export type UpdateKind = "store" | "web" | "latest";

// "1.7" · "1.7.1" · "1.10" 같은 점 구분 숫자 비교. a > b면 양수. 숫자가 아닌 칸은 0으로 본다
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function decideUpdate(input: {
  clientBuild: string;
  serverBuild: string | null | undefined;
  // iOS 앱이면 설치된 앱 버전(App.getInfo), 웹이면 null
  nativeVersion: string | null;
  // App Store에 올라가 있는 버전. 모르면 null
  storeVersion: string | null | undefined;
}): UpdateKind {
  const { clientBuild, serverBuild, nativeVersion, storeVersion } = input;
  if (nativeVersion && storeVersion && compareVersions(storeVersion, nativeVersion) > 0) return "store";
  if (serverBuild && serverBuild !== clientBuild) return "web";
  return "latest";
}
