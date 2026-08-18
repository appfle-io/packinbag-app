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

// TEMP DEBUG (2026-08): "Property X contains an invalid nested entity" confirmed to
// be a real data-shape problem. First pass bisected bag.packs and every single pack
// AND every single editorDoc.content node passed in isolation, while the pack as a
// WHOLE still failed - meaning this isn't "one bad node", it's a combination-only
// failure (something only breaks when several siblings sit together in the same
// array). This version handles that: for any array, if the whole thing fails but
// every individual element passes, it binary-splits the array, and if both halves
// pass alone too, it falls back to testing every cross-half PAIR to find the
// specific two elements that only fail when written together.
// Call site: BagEditorScreen's save-failure catch calls debugBisectBag(bag).
// Remove this whole section + the call site once the cause is found.

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

async function bisectArrayCombo(uid: string, label: string, arr: unknown[]): Promise<void> {
  if (arr.length <= 1) {
    console.error(`[pib-bisect] SMALLEST FAILING LEAF FOUND: ${label}`, JSON.stringify(arr));
    return;
  }
  const mid = Math.floor(arr.length / 2);
  const left = arr.slice(0, mid);
  const right = arr.slice(mid);
  const leftLabel = `${label}[0:${mid}]`;
  const rightLabel = `${label}[${mid}:${arr.length}]`;
  const leftOk = await tryIsolatedWrite(uid, leftLabel, left);
  const rightOk = await tryIsolatedWrite(uid, rightLabel, right);

  if (!leftOk) {
    console.log(`[pib-bisect] narrowing into left half: ${leftLabel}`);
    await bisectValue(uid, leftLabel, left);
  }
  if (!rightOk) {
    console.log(`[pib-bisect] narrowing into right half: ${rightLabel}`);
    await bisectValue(uid, rightLabel, right);
  }
  if (leftOk && rightOk) {
    // Neither half alone reproduces it, but the full array does - so it's specifically
    // a cross-half interaction. Brute-force every (left element, right element) pair.
    console.log(
      `[pib-bisect] both halves pass alone but combined array fails - trying ${left.length}x${right.length} cross pairs for ${label}`
    );
    let found = false;
    for (let i = 0; i < left.length; i++) {
      for (let j = 0; j < right.length; j++) {
        const pairLabel = `${label} pair(${i} x ${mid + j})`;
        const pairOk = await tryIsolatedWrite(uid, pairLabel, [left[i], right[j]]);
        if (!pairOk) {
          console.error(
            `[pib-bisect] PAIR FAILS TOGETHER: ${pairLabel}`,
            "\nELEMENT A:", JSON.stringify(left[i]),
            "\nELEMENT B:", JSON.stringify(right[j])
          );
          found = true;
        }
      }
    }
    if (!found) {
      console.error(
        `[pib-bisect] no single pair reproduces it either for ${label} - likely needs 3+ elements together, or it's a count/size threshold rather than specific content`
      );
    }
  }
}

async function bisectValue(uid: string, label: string, value: unknown): Promise<void> {
  const ok = await tryIsolatedWrite(uid, label, value);
  if (ok) {
    console.log(`[pib-bisect] ok: ${label}`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length <= 1) {
      console.error(`[pib-bisect] SMALLEST FAILING LEAF FOUND: ${label}`, JSON.stringify(value));
      return;
    }
    let anyChildFailed = false;
    for (let i = 0; i < value.length; i++) {
      const childOk = await tryIsolatedWrite(uid, `${label}[${i}]`, value[i]);
      if (childOk) {
        console.log(`[pib-bisect] ok: ${label}[${i}]`);
      } else {
        anyChildFailed = true;
        await bisectValue(uid, `${label}[${i}]`, value[i]);
      }
    }
    if (!anyChildFailed) {
      console.log(
        `[pib-bisect] every element of ${label} passes alone, but the array together fails - switching to combo search`
      );
      await bisectArrayCombo(uid, label, value);
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length <= 1) {
      console.error(`[pib-bisect] SMALLEST FAILING LEAF FOUND: ${label}`, JSON.stringify(value));
      return;
    }
    let anyChildFailed = false;
    for (const [k, v] of entries) {
      const childOk = await tryIsolatedWrite(uid, `${label}.${k}`, v);
      if (childOk) {
        console.log(`[pib-bisect] ok: ${label}.${k}`);
      } else {
        anyChildFailed = true;
        await bisectValue(uid, `${label}.${k}`, v);
      }
    }
    if (!anyChildFailed) {
      console.error(
        `[pib-bisect] every field of ${label} passes alone, but the object together fails - this needs manual inspection (combo search across object keys isn't implemented, only arrays)`
      );
    }
    return;
  }
  console.error(`[pib-bisect] SMALLEST FAILING LEAF FOUND (primitive?!): ${label}`, JSON.stringify(value));
}

export async function debugBisectBag(bag: Record<string, unknown>): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    console.error("[pib-bisect] not signed in");
    return;
  }
  console.log("[pib-bisect] starting full generic bisection of the whole bag object...");
  await bisectValue(uid, "bag", bag);
  console.log("[pib-bisect] done - look above for 'SMALLEST FAILING LEAF FOUND' or 'PAIR FAILS TOGETHER'");
}
