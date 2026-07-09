// 서버(API 라우트)에서만 import해야 하는 파일. Firebase Admin SDK는 서비스 계정 키로
// 인증하기 때문에, 클라이언트가 우회할 수 없는 진짜 서버 권한으로 Firestore/Auth에 접근한다.
//
// 필요한 환경변수: FIREBASE_SERVICE_ACCOUNT_KEY
// - Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > "새 비공개 키 생성"으로 받은 JSON 파일의
//   내용을 그대로(한 줄 문자열로) 이 환경변수에 넣는다. NEXT_PUBLIC_ 접두사를 붙이면 안 된다
//   (클라이언트로 노출되면 절대 안 되는 값).

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function adminApp() {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY가 설정되어 있지 않아요");
  }

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY 형식이 올바르지 않아요 (JSON이어야 해요)");
  }

  return initializeApp({ credential: cert(serviceAccount) });
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function adminDb() {
  return getFirestore(adminApp());
}
