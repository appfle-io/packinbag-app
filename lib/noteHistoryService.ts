// 메모 이전 버전(2026-11-07, memo.md MEMO-HIST).
// 편집기를 연 뒤 처음 본문이 바뀌어 저장할 때, 고치기 직전 모습을 한 번 남긴다(편집 한 번에 쓰기 1번).
// - 가방 안 메모: bags/{bagId}/noteHistory/{id} (멤버가 읽고 남기고 지움, 가방 완전삭제 때 같이 지움)
// - 보관함 메모: users/{uid}/noteHistory/{id} (본인만, 완전삭제 · 탈퇴 때 같이 지움)
// 목록은 이전 버전 시트를 열 때만 읽는다(packId 하나로만 거르고 정렬은 화면에서 → 색인 없음). 열 때 MAX보다 오래된 것은 지운다.
import { addDoc, collection, deleteDoc, getDocs, query, where, type CollectionReference } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { extractPlainTextPreview } from "@/lib/editorDocLimits";
import { extractDocAttachmentUrls } from "@/lib/editorDocAttachmentUtils";

export type NoteHistoryScope = { kind: "bag"; bagId: string } | { kind: "library"; uid: string };

export interface NoteHistoryEntry {
  id: string;
  packId: string;
  doc: object | undefined;
  name: string;
  preview: string;
  createdAt: string;
  byUid: string | null;
  byName: string | null;
}

// 메모 하나에 남기는 이전 버전 수
export const NOTE_HISTORY_MAX = 20;
// 규칙(firestore.rules noteHistory)과 같은 상한. 본문 300KB 제한보다 넉넉하다
const MAX_RAW_CHARS = 1_000_000;

function historyCol(scope: NoteHistoryScope): CollectionReference {
  return scope.kind === "bag"
    ? collection(db, "bags", scope.bagId, "noteHistory")
    : collection(db, "users", scope.uid, "noteHistory");
}

// 글도 첨부도 없는 메모는 남길 것이 없다
function isEmptyDoc(docJson: unknown): boolean {
  if (!docJson || typeof docJson !== "object") return true;
  return !extractPlainTextPreview(docJson as object).trim() && extractDocAttachmentUrls(docJson as object).length === 0;
}

/** 고치기 전 모습을 남긴다. 빈 메모 · 너무 큰 본문은 건너뛴다. 실패는 조용히(편집에는 영향 없음) */
export async function saveNoteHistory(
  scope: NoteHistoryScope,
  packId: string,
  entry: { doc: unknown; name: string; byName: string | null },
): Promise<void> {
  if (isEmptyDoc(entry.doc)) return;
  const raw = JSON.stringify(entry.doc);
  if (raw.length >= MAX_RAW_CHARS) return;
  await addDoc(historyCol(scope), {
    packId,
    doc: raw,
    name: entry.name.slice(0, 200),
    preview: extractPlainTextPreview(entry.doc as object),
    createdAt: new Date().toISOString(),
    byUid: auth.currentUser?.uid ?? null,
    byName: entry.byName,
  });
}

/** 이 메모의 이전 버전(최신 먼저, 최대 NOTE_HISTORY_MAX). 넘친 오래된 것은 지운다 */
export async function listNoteHistory(scope: NoteHistoryScope, packId: string): Promise<NoteHistoryEntry[]> {
  const snap = await getDocs(query(historyCol(scope), where("packId", "==", packId)));
  const all = snap.docs
    .map((d) => {
      const data = d.data();
      let parsed: object | undefined;
      try {
        parsed = typeof data.doc === "string" ? ((JSON.parse(data.doc) as object | null) ?? undefined) : undefined;
      } catch {
        parsed = undefined;
      }
      return {
        id: d.id,
        packId,
        doc: parsed,
        name: typeof data.name === "string" ? data.name : "",
        preview: typeof data.preview === "string" ? data.preview : "",
        createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
        byUid: typeof data.byUid === "string" ? data.byUid : null,
        byName: typeof data.byName === "string" ? data.byName : null,
        ref: d.ref,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const extra = all.slice(NOTE_HISTORY_MAX);
  if (extra.length) void Promise.all(extra.map((e) => deleteDoc(e.ref).catch(() => {})));
  return all.slice(0, NOTE_HISTORY_MAX).map(({ ref: _ref, ...rest }) => (void _ref, rest));
}

/** 가방 완전삭제 전: 그 가방의 이전 버전을 모두 지운다(가방 문서가 먼저 지워지면 멤버 확인이 안 돼 못 지운다) */
export async function deleteBagNoteHistory(bagId: string): Promise<void> {
  const snap = await getDocs(historyCol({ kind: "bag", bagId }));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
}

/** 보관함 메모 완전삭제: 그 메모의 이전 버전을 지운다 */
export async function deleteLibraryNoteHistory(uid: string, packId: string): Promise<void> {
  const snap = await getDocs(query(historyCol({ kind: "library", uid }), where("packId", "==", packId)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
}
