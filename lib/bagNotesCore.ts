// 가방 안 메모 본문 분리 - Firebase를 부르지 않는 순수 함수(브라우저·서버 API 공용, 2026-10-08).
// 저장 위치·구독은 lib/bagNotesService.ts.

import type { Bag, Pack } from "@/lib/types";
import { extractPlainTextPreview, getEditorDocFullText } from "@/lib/editorDocLimits";
import { extractDocAttachmentUrls } from "@/lib/editorDocAttachmentUtils";

export const NOTE_SEARCH_TEXT_MAX = 2000;
export const NOTES_VERSION = 2;

export interface BagNote {
  doc: object | undefined;
  raw: string; // 저장된 JSON 문자열 그대로(바뀌었는지 비교용)
  rev: number;
  updatedAt?: string;
}

export interface NoteWrite {
  packId: string;
  raw: string;
}

export function rawOf(docJson: object | undefined): string {
  return JSON.stringify(docJson ?? null);
}

export function parseNoteData(data: Record<string, unknown>): BagNote {
  const raw = typeof data.doc === "string" ? data.doc : JSON.stringify(data.doc ?? null);
  let parsed: object | undefined;
  try {
    parsed = raw ? ((JSON.parse(raw) as object | null) ?? undefined) : undefined;
  } catch {
    parsed = undefined;
  }
  return {
    doc: parsed,
    raw,
    rev: typeof data.rev === "number" ? data.rev : 0,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
  };
}

/** notes의 본문을 가방의 메모팩에 채워 넣는다(화면용). 본문이 notes에 없으면(이전 전 데이터) 그대로 둔다 */
export function hydrateBag(bag: Bag, notes: Map<string, BagNote> | null): Bag {
  if (!notes || notes.size === 0) return bag;
  let changed = false;
  const packs = bag.packs.map((p) => {
    if (p.kind !== "editor") return p;
    const n = notes.get(p.id);
    if (!n) return p;
    if (p.editorDoc !== undefined && rawOf(p.editorDoc) === n.raw) return p;
    changed = true;
    return { ...p, editorDoc: n.doc };
  });
  return changed ? { ...bag, packs } : bag;
}

/** 본문에서 가방 문서에 남길 요약을 만든다 */
export function noteSummary(pack: Pack, docJson: object | undefined): Pick<Pack, "editorPreviewText" | "searchText" | "attachmentUrls"> {
  const fullText = docJson ? getEditorDocFullText(docJson) : "";
  return {
    editorPreviewText: docJson ? extractPlainTextPreview(docJson) : pack.editorPreviewText ?? "",
    searchText: fullText.slice(0, NOTE_SEARCH_TEXT_MAX),
    attachmentUrls: Array.from(new Set([...(pack.images ?? []), ...extractDocAttachmentUrls(docJson)])),
  };
}

function stripPack(p: Pack, docJson: object | undefined): Pack {
  const { editorDoc: _drop, ...rest } = p;
  void _drop;
  return { ...rest, ...noteSummary(p, docJson), noteSeparated: true } as Pack;
}

/**
 * 저장할 가방에서 메모 본문을 떼어 낸다.
 * - known: 지금 서버에 있다고 알고 있는 본문(packId → raw). 열린 가방이 notes 구독을 받은 뒤에만 넘긴다.
 *   null이면(목록에서 바로 저장 등) 본문이 붙어 있는 메모는 모두 쓰고, 지우기는 하지 않는다.
 * - 본문이 바뀐 메모만 noteWrites에 넣는다. known에 있었는데 가방에서 사라진 메모는 noteDeletes.
 * - 본문이 안 붙은 메모(본문 도착 전, 목록에서 저장)는 가방 문서의 요약을 그대로 둔다.
 */
export function splitBagForSave(
  bag: Bag,
  known: Map<string, string> | null,
): { stripped: Bag; noteWrites: NoteWrite[]; noteDeletes: string[] } {
  const noteWrites: NoteWrite[] = [];
  const editorIds = new Set<string>();
  const packs = bag.packs.map((p) => {
    if (p.kind !== "editor") return p;
    editorIds.add(p.id);
    if (p.editorDoc === undefined) return p;
    const raw = rawOf(p.editorDoc);
    if (!known || known.get(p.id) !== raw) noteWrites.push({ packId: p.id, raw });
    return stripPack(p, p.editorDoc);
  });
  const noteDeletes = known ? [...known.keys()].filter((id) => !editorIds.has(id)) : [];
  return { stripped: { ...bag, packs }, noteWrites, noteDeletes };
}

/** 서버(Admin SDK)에서 쓰는 분리 - create-bag, 일괄 이전. editorDoc이 JSON 문자열(직렬화된 상태)이어도 받는다 */
export function splitPacksPlain(packs: Pack[]): { packs: Pack[]; notes: NoteWrite[] } {
  const notes: NoteWrite[] = [];
  const out = packs.map((p) => {
    if (p.kind !== "editor") return p;
    let docJson: unknown = p.editorDoc;
    if (typeof docJson === "string") {
      try {
        docJson = JSON.parse(docJson);
      } catch {
        docJson = undefined;
      }
    }
    if (docJson === undefined || docJson === null) return p;
    notes.push({ packId: p.id, raw: rawOf(docJson as object) });
    return stripPack(p, docJson as object);
  });
  return { packs: out, notes };
}
