// 가방 안 메모 본문을 bags/{bagId}/notes/{packId}로 한꺼번에 옮긴다(2026-10-08, 메모 본문 분리 3단계).
//
// 미리 보기(아무것도 안 바꿈):  node scripts/migrate-bag-notes.mjs
// 실제로 옮기기:               node scripts/migrate-bag-notes.mjs --apply
//
// - 먼저 scripts/backup-firestore.mjs로 백업한 뒤에 실행한다.
// - 가방마다 트랜잭션 하나: 최신 가방 문서를 읽고, 본문이 들어 있는 메모만 notes로 옮기고, 가방 문서에는 요약만 남긴다
//   (lib/bagNotesCore.ts splitPacksPlain과 같은 규칙. 미리보기 120자 / 검색 텍스트 2,000자 / 첨부 목록).
// - 이미 옮긴 가방(본문이 남은 메모가 없음)은 건너뛴다. 여러 번 실행해도 안전하다.
// - 이미 notes 문서가 있는 메모는 notes를 그대로 두고 가방 안 본문만 지운다(새 앱이 쓴 notes가 더 최신이다).
// - packsRev를 1 올리고 notesV를 2로 둔다(firestore.rules - 옛 앱이 다시 가방 안에 본문을 써넣지 못하게).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const PREVIEW_MAX = 120;
const SEARCH_MAX = 2000;

function readServiceAccount() {
  const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const line = envText.split(/\r?\n/).find((l) => l.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY="));
  if (!line) throw new Error(".env.local에 FIREBASE_SERVICE_ACCOUNT_KEY가 없어요");
  let raw = line.slice("FIREBASE_SERVICE_ACCOUNT_KEY=".length).trim();
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) raw = raw.slice(1, -1);
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/\\n/g, "\n"));
  }
}

// lib/editorDocLimits.ts getEditorDocFullText와 같은 규칙
function fullText(doc) {
  const parts = [];
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (typeof n.text === "string" && n.text) parts.push(n.text);
    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
      if (n.type && n.type !== "text") parts.push(" ");
    }
  };
  walk(doc);
  return parts.join("").replace(/\s+/g, " ").trim();
}
function preview(doc) {
  const t = fullText(doc);
  return t.length <= PREVIEW_MAX ? t : t.slice(0, PREVIEW_MAX).trimEnd() + "…";
}
// lib/editorDocAttachmentUtils.ts extractDocAttachmentUrls와 같은 규칙
function attachmentUrls(doc) {
  const urls = [];
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if ((n.type === "imageAttachment" || n.type === "image" || n.type === "fileAttachment") && typeof n.attrs?.src === "string") {
      urls.push(n.attrs.src);
    }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return urls;
}

function parseDoc(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) ?? undefined;
    } catch {
      return undefined;
    }
  }
  return value;
}

async function main() {
  const app = initializeApp({ credential: cert(readServiceAccount()) });
  const db = getFirestore(app);
  const bagsSnap = await db.collection("bags").get();
  console.log(`${APPLY ? "[옮기기]" : "[미리 보기 - 아무것도 바꾸지 않아요]"} 가방 ${bagsSnap.size}개를 확인해요\n`);

  let bagsToMigrate = 0;
  let notesToWrite = 0;
  let bytesMoved = 0;
  let failed = 0;

  for (const bagDoc of bagsSnap.docs) {
    const data = bagDoc.data();
    const packs = Array.isArray(data.packs) ? data.packs : [];
    const inline = packs.filter((p) => p?.kind === "editor" && p.editorDoc !== undefined && p.editorDoc !== null);
    if (inline.length === 0) continue;
    bagsToMigrate++;
    notesToWrite += inline.length;
    const size = inline.reduce((n, p) => n + (typeof p.editorDoc === "string" ? p.editorDoc.length : JSON.stringify(p.editorDoc).length), 0);
    bytesMoved += size;
    console.log(`- ${bagDoc.id} "${data.name ?? ""}": 메모 ${inline.length}개, 약 ${Math.round(size / 1024)}KB`);
    if (!APPLY) continue;

    try {
      await db.runTransaction(async (tx) => {
        const bagRef = bagDoc.ref;
        const fresh = await tx.get(bagRef);
        if (!fresh.exists) return;
        const freshData = fresh.data();
        const freshPacks = Array.isArray(freshData.packs) ? freshData.packs : [];
        const targets = freshPacks.filter((p) => p?.kind === "editor" && p.editorDoc !== undefined && p.editorDoc !== null);
        if (targets.length === 0) return;
        const noteSnaps = await Promise.all(targets.map((p) => tx.get(bagRef.collection("notes").doc(p.id))));
        const existing = new Set(noteSnaps.filter((s) => s.exists).map((s) => s.id));
        const now = new Date().toISOString();

        const nextPacks = freshPacks.map((p) => {
          if (!(p?.kind === "editor" && p.editorDoc !== undefined && p.editorDoc !== null)) return p;
          const doc = parseDoc(p.editorDoc);
          if (doc !== undefined && !existing.has(p.id)) {
            tx.set(bagRef.collection("notes").doc(p.id), { doc: JSON.stringify(doc), rev: 1, updatedAt: now, updatedBy: "migration" });
          }
          const { editorDoc: _drop, ...rest } = p;
          void _drop;
          return {
            ...rest,
            editorPreviewText: doc ? preview(doc) : p.editorPreviewText ?? "",
            searchText: doc ? fullText(doc).slice(0, SEARCH_MAX) : "",
            attachmentUrls: Array.from(new Set([...(p.images ?? []), ...(doc ? attachmentUrls(doc) : [])])),
            noteSeparated: true,
          };
        });
        tx.update(bagRef, {
          packs: nextPacks,
          notesV: 2,
          packsRev: (typeof freshData.packsRev === "number" ? freshData.packsRev : 0) + 1,
        });
      });
    } catch (err) {
      failed++;
      console.error(`  ! 실패: ${bagDoc.id}`, err?.message ?? err);
    }
  }

  console.log(`\n옮길 가방 ${bagsToMigrate}개 · 메모 ${notesToWrite}개 · 약 ${Math.round(bytesMoved / 1024)}KB`);
  if (APPLY) console.log(failed > 0 ? `실패 ${failed}개 - 다시 실행하면 실패한 가방만 다시 시도해요` : "모두 옮겼어요");
  else console.log("실제로 옮기려면: node scripts/migrate-bag-notes.mjs --apply");
}

main().catch((err) => {
  console.error("이전 실패:", err);
  process.exit(1);
});
