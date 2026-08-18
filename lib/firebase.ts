import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  doc,
  setDoc,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { stripUndefined } from "./firestoreSanitize";

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

// TEMP DEBUG (2026-08): "Property X contains an invalid nested entity" is confirmed
// to be a real data-shape problem (an isolated write of the sanitized bag to an
// unrelated users/{uid} field failed with the exact same error). Static recursive
// checks for a literal array-directly-inside-array all report clean, so instead of
// guessing we bisect for real: write progressively smaller fragments of the actual
// bag to an isolated scratch field and see which fragment is the smallest one that
// still fails. This walks bag -> each pack -> each editorDoc.content node -> each
// node's own nested content array, recursively, stopping at the first failing leaf
// per branch. Each candidate write goes through the exact same stripUndefined
// normalization as the real save path.
//
// Call site: BagEditorScreen's save-failure catch calls debugBisectBag(bag)
// automatically. Remove this whole section + the call site once the cause is found.

async function tryIsolatedWrite(uid: string, label: string, value: unknown): Promise<boolean> {
  try {
    const sanitized = stripUndefined(value);
    await setDoc(
      doc(db, "users", uid),
      { __debugBisect: sanitized, __debugBisectLabel: label, __debugBisectAt: new Date().toISOString() },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error(`[pib-bisect] FAIL: ${label}`, err);
    return false;
  }
}

async function bisectNodeContent(uid: string, label: string, content: unknown[]): Promise<void> {
  for (let i = 0; i < content.length; i++) {
    const node = content[i] as { type?: string; content?: unknown[] };
    const nodeLabel = `${label}.content[${i}] (type=${node?.type ?? "?"})`;
    const ok = await tryIsolatedWrite(uid, nodeLabel, node);
    if (ok) {
      console.log(`[pib-bisect] ok: ${nodeLabel}`);
      continue;
    }
    // this node itself fails in isolation - if it has its own nested content array,
    // recurse into it to find the smallest failing sub-node; otherwise this leaf IS
    // the culprit.
    if (Array.isArray(node?.content) && node.content.length > 0) {
      await bisectNodeContent(uid, nodeLabel, node.content);
    } else {
      console.error(`[pib-bisect] SMALLEST FAILING LEAF FOUND: ${nodeLabel}`, JSON.stringify(node));
    }
  }
}

export async function debugBisectBag(bag: {
  packs: { id: string; name: string; editorDoc?: { content?: unknown[] } }[];
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    console.error("[pib-bisect] not signed in");
    return;
  }
  console.log("[pib-bisect] starting bisection...");
  for (const pack of bag.packs) {
    const packLabel = `pack ${pack.id} (${pack.name})`;
    const ok = await tryIsolatedWrite(uid, packLabel, pack);
    if (ok) {
      console.log(`[pib-bisect] ok: ${packLabel}`);
      continue;
    }
    const content = pack.editorDoc?.content;
    if (Array.isArray(content) && content.length > 0) {
      await bisectNodeContent(uid, packLabel, content);
    } else {
      console.error(`[pib-bisect] SMALLEST FAILING LEAF FOUND (whole pack, no content to split): ${packLabel}`);
    }
  }
  console.log("[pib-bisect] done - look above for 'SMALLEST FAILING LEAF FOUND'");
}
