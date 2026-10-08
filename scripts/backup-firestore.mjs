// Firestore 전체를 내 컴퓨터에 JSON 파일로 백업한다(2026-10-08, 메모 본문 분리 작업 전 백업용).
//
// 실행:  node scripts/backup-firestore.mjs
// 결과:  backups/firestore-YYYYMMDD-HHMMSS.json   (backups/는 .gitignore - 절대 커밋하지 않는다)
//
// - .env.local의 FIREBASE_SERVICE_ACCOUNT_KEY(서버 키)로 접속한다. 운영 데이터를 "읽기만" 한다.
// - 모든 최상위 컬렉션과 하위 컬렉션(bags/{id}/presence 등)을 끝까지 따라가며 저장한다.
// - 문서 1개 = 읽기 1번. 지금 규모에서는 비용이 거의 없다.
// - Timestamp 같은 Firestore 전용 값은 { "__type": "timestamp", "iso": ... } 처럼 표시해서 저장한다(나중에 되살릴 때 구분용).

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from "firebase-admin/firestore";

function readServiceAccount() {
  const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const line = envText.split(/\r?\n/).find((l) => l.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY="));
  if (!line) throw new Error(".env.local에 FIREBASE_SERVICE_ACCOUNT_KEY가 없어요");
  let raw = line.slice("FIREBASE_SERVICE_ACCOUNT_KEY=".length).trim();
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    raw = raw.slice(1, -1);
  }
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/\\n/g, "\n"));
  }
}

function encode(value) {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Timestamp) return { __type: "timestamp", iso: value.toDate().toISOString() };
  if (value instanceof GeoPoint) return { __type: "geopoint", lat: value.latitude, lng: value.longitude };
  if (value instanceof DocumentReference) return { __type: "ref", path: value.path };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __type: "bytes", base64: Buffer.from(value).toString("base64") };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = encode(v);
    return out;
  }
  return value;
}

let docCount = 0;

async function dumpCollection(colRef) {
  const out = {};
  const snap = await colRef.get();
  for (const d of snap.docs) {
    docCount++;
    const entry = { data: encode(d.data()) };
    const subs = await d.ref.listCollections();
    if (subs.length > 0) {
      entry.subcollections = {};
      for (const sub of subs) entry.subcollections[sub.id] = await dumpCollection(sub);
    }
    out[d.id] = entry;
  }
  return out;
}

async function main() {
  const app = initializeApp({ credential: cert(readServiceAccount()) });
  const db = getFirestore(app);

  const started = Date.now();
  const result = { exportedAt: new Date().toISOString(), projectId: app.options.credential?.projectId ?? null, collections: {} };
  const roots = await db.listCollections();
  for (const col of roots) {
    process.stdout.write(`- ${col.id} ... `);
    const before = docCount;
    result.collections[col.id] = await dumpCollection(col);
    console.log(`${docCount - before}개`);
  }

  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  mkdirSync(resolve(process.cwd(), "backups"), { recursive: true });
  const file = resolve(process.cwd(), "backups", `firestore-${stamp}.json`);
  writeFileSync(file, JSON.stringify(result));

  console.log(`\n완료: 문서 ${docCount}개, ${Math.round((Date.now() - started) / 1000)}초`);
  console.log(`파일: ${file}`);
}

main().catch((err) => {
  console.error("백업 실패:", err);
  process.exit(1);
});
