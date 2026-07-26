// 서버(API 라우트)에서만 import해야 하는 파일. Firebase Admin SDK는 서비스 계정 키로
// 인증하기 때문에, 클라이언트가 우회할 수 없는 진짜 서버 권한으로 Firestore/Auth에 접근한다.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

export function adminApp() {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.warn("[팩인백] FIREBASE_SERVICE_ACCOUNT_KEY 환경변수가 없습니다.");
    return null;
  }

  let serviceAccount: Record<string, unknown>;
  try {
    // 1차 일반 파싱 시도
    serviceAccount = JSON.parse(raw);
  } catch {
    try {
      // 2차 .env.local 개행 이스케이프 (\\n -> \n) 치환 파싱 시도
      serviceAccount = JSON.parse(raw.replace(/\\n/g, "\n"));
    } catch (parseErr) {
      console.error("[팩인백] FIREBASE_SERVICE_ACCOUNT_KEY JSON 파싱 실패:", parseErr);
      return null;
    }
  }

  try {
    return initializeApp({ credential: cert(serviceAccount) });
  } catch (initErr) {
    console.error("[팩인백] Firebase Admin initializeApp 실패:", initErr);
    return null;
  }
}

export function adminAuth(): Auth {
  const app = adminApp();
  if (!app) return null as unknown as Auth;
  return getAuth(app);
}

export function adminDb(): Firestore {
  const app = adminApp();
  if (!app) return null as unknown as Firestore;
  return getFirestore(app);
}
