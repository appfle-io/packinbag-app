import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDehl5IukN6jpkPDVo9ZJwkKqWclDDkTPI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "packinbag-f1983.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "packinbag-f1983",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "packinbag-f1983.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "510272302140",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:510272302140:web:a4fdc4f672d1297b7ce739",
};

// Next.js는 파일을 여러 번 로드할 수 있어서, 이미 초기화됐으면 재사용
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Firestore 로컬(IndexedDB) 캐시. 스플래시가 유저 문서(users/{uid}) 최초 스냅샷을 기다리는
// 동안 매번 서버 왕복이 필요했던 게 콜드스타트 지연의 주 원인이었음 - 캐시가 있으면 그 값으로
// 먼저 화면을 그리고 서버 동기화는 백그라운드에서 이어진다.
// 싱글탭 매니저를 쓰는 이유: 이 앱은 대부분 모바일 PWA(단일 탭)로 쓰이고, 데스크톱에서
// 두 번째 탭을 열어도 그 탭이 그냥 메모리 캐시로 동작할 뿐 앱이 죽거나 에러를 던지진 않음
// (구버전 enableIndexedDbPersistence와 달리 최신 SDK는 이 경우를 조용히 처리함).
// SSR이나 IndexedDB를 못 쓰는 환경(사파리 프라이버시 모드 등)을 대비해 실패하면
// 일반 getFirestore로 폴백한다. Next.js Fast Refresh로 이 모듈이 다시 실행돼도
// (initializeFirestore는 앱당 한 번만 가능) 이 폴백 덕분에 개발 중 에러 없이 기존
// 인스턴스를 그대로 재사용한다.
function createFirestore() {
  if (typeof window === "undefined") {
    return getFirestore(app);
  }
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
    });
  } catch {
    return getFirestore(app);
  }
}

export const db = createFirestore();
export const storage = getStorage(app);
export default app;
