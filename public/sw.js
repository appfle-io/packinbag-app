// ============================================================================
// 팩인백 PWA 서비스 워커 (오프라인 지원 및 정적 리소스 캐싱 엔진)
// ============================================================================
// 전략 개요:
// 1. App Shell (HTML 네비게이션): Network-First with Cache Fallback
//    - 온라인일 때는 항상 서버의 최신 HTML을 가져와 최신 배포를 유지함 (캐시 고착 방지).
//    - 오프라인(비행기 모드 등)일 때는 캐시된 App Shell('/')을 반환하여 404 없이 즉시 실행.
// 2. Next.js 정적 번들 (/_next/static/**) 및 정적 자산: Cache-First
//    - Next.js 빌드 해시가 붙어 불변(immutable)하므로 캐시에서 즉시 꺼내 로딩 속도 극대화.
// 3. API (/api/**) 및 외부 통신 (Firebase, Auth, DB 등): Network-Only (Bypass)
//    - 새 버전 감지(/api/build-info), 사용자 인증, 실시간 동기화 등은 SW를 거치지 않고 직접 통신.
// 4. 구버전 캐시 자동 정리:
//    - CACHE_NAME 갱신 시 activate 이벤트에서 이전 캐시 버킷 자동 전수 삭제.
// ============================================================================

const CACHE_NAME = "pib-pwa-v1";

// 설치 시점에 오프라인 구동을 위해 미리 저장할 핵심 자산 목록
const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon.png",
  "/icon-192",
  "/icon-192.png",
  "/apple-icon.png",
  "/backpack-logo.png",
];

// 설치(install): 핵심 App Shell 자산 사전 캐싱
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url);
            if (res.ok) {
              await cache.put(url, res);
            }
          } catch {
            // 설치 중 개별 파일 실패가 전체 설치를 중단시키지 않도록 무시
          }
        })
      );
    })
  );
  self.skipWaiting();
});

// 활성화(activate): 구버전 캐시 청소 및 즉시 클라이언트 제어 시작
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// 패치(fetch): 요청 유형별 캐싱 전략 분기
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 1) GET 요청이 아니면 네트워크로 통과
  if (req.method !== "GET") {
    return;
  }

  const url = new URL(req.url);

  // 2) 외부 도메인(Firebase Auth/Firestore/Storage 등)은 SW 캐싱 제외하고 네트워크 전용
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3) 내부 API (/api/**)는 실시간 통신 및 배포 버전 감지를 위해 네트워크 전용
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 4) HTML 문서 네비게이션 요청 (사용자가 화면을 열거나 새로고침할 때)
  // 전략: Network-First (온라인 시 최신 페이지 가져오고 캐시 갱신, 오프라인 시 캐시 폴백)
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, clone);
              cache.put("/", networkRes.clone());
            });
          }
          return networkRes;
        })
        .catch(async () => {
          // 오프라인 상태: 해당 요청 또는 기본 App Shell ('/') 반환
          const cached = await caches.match(req);
          if (cached) return cached;
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;
          return Response.error();
        })
    );
    return;
  }

  // 5) Next.js 정적 번들 (/_next/static/**) 및 정적 에셋 (이미지, 폰트 등)
  // 전략: Cache-First (캐시에 있으면 즉시 반환, 없으면 네트워크에서 받아 캐시 저장)
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff|woff2|css|js)$/);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(req).then((networkRes) => {
          if (networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, clone);
            });
          }
          return networkRes;
        });
      })
    );
    return;
  }

  // 6) 그 외 동일 오리진 GET 요청: Network-First with Cache Fallback
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, clone);
          });
        }
        return networkRes;
      })
      .catch(() => caches.match(req))
  );
});
