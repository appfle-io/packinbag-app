// ============================================================================
// 최소 서비스 워커 (설치 가능(installability) 조건 충족용)
// ----------------------------------------------------------------------------
// 목적: 안드로이드 크롬이 PWA 설치 배너(beforeinstallprompt)를 띄우려면
// "fetch 핸들러가 있는 서비스 워커"가 등록되어 있어야 한다는 조건이 있음.
// 그 조건만 채우는 게 목적이라 캐싱은 전혀 하지 않고 그냥 네트워크로 패스스루함.
//
// 캐싱을 넣지 않은 이유: 이미 만들어둔 "새 버전 감지" 폴링 시스템
// (/api/build-info 10분마다 폴링 + 포그라운드 복귀 시)이 최신 배포를 감지하는데,
// 서비스 워커 캐싱을 넣으면 캐시된 예전 페이지/자산이 새 버전 감지 로직과
// 충돌하거나 사용자가 "새로고침해도 예전 화면이 보이는" 문제가 생길 수 있음.
// 나중에 오프라인 지원이나 FCM 푸시 알림을 붙일 때 이 파일을 확장하면 됨
// (알림 벨 UI는 이미 push 수신을 받을 수 있게 설계돼 있음).
//
// 등록은 app/layout.tsx에서 하고, Capacitor 네이티브 앱(iOS 등)에서는
// 등록하지 않음 (lib/installPromptUtils.ts의 isCapacitorNative()로 분기).
// ============================================================================

self.addEventListener("install", () => {
  // 설치 즉시 활성화 (대기 중인 이전 서비스 워커를 기다리지 않음)
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // 캐싱 없이 그냥 네트워크로 통과시킴 (installability 조건만 채우는 용도)
  event.respondWith(fetch(event.request));
});
