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
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
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

// TEMP DEBUG (2026-08): isolate whether "invalid nested entity" is caused by the
// data shape itself, or by interaction with other concurrent writes/listeners on
// the bags/{bagId} document. This writes the exact same bag payload to the
// caller's own users/{uid} document instead (rules always allow read/write on your
// own user doc), which has no other writers/listeners touching this test field.
//
// Console usage:
//   1) copy the full bag JSON string printed after the "save failed" error log
//   2) run: window.__pibDebugTestSave(thatString)
//   3) success -> not a data-shape issue, something about concurrent bag writes/listeners
//      failure -> the data itself still has the problem (path is in the console error)
// Remove this whole block once the cause is found.
if (typeof window !== "undefined") {
  import("firebase/firestore").then(async ({ doc, setDoc }) => {
    const { stripUndefined } = await import("./firestoreSanitize");
    (window as unknown as Record<string, unknown>).__pibDebugTestSave = async (
      jsonString: string
    ) => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          console.error("[pib-debug] not signed in");
          return;
        }
        const parsed = JSON.parse(jsonString);
        const sanitized = stripUndefined(parsed);
        await setDoc(
          doc(db, "users", uid),
          { __debugTestPayload: sanitized, __debugTestAt: new Date().toISOString() },
          { merge: true }
        );
        console.log(
          "[pib-debug] SAVE SUCCEEDED - not a data shape issue. Check users/" +
            uid +
            " field __debugTestPayload"
        );
      } catch (err) {
        console.error("[pib-debug] SAVE FAILED - the data itself still has the problem:", err);
      }
    };
    console.log("[pib-debug] window.__pibDebugTestSave(bagJsonString) is ready");
  });
}
