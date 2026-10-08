// 가방 안 메모팩 본문 분리 저장(2026-10-08) - Firestore 쪽(브라우저 전용).
//
// 왜: 가방 문서 하나에 메모 본문(editorDoc)까지 들어 있으면, 체크 하나만 눌러도 메모 본문을 포함한 문서 전체가
// 그 가방을 구독하는 모든 멤버에게 다시 전송된다. 본문만 bags/{bagId}/notes/{packId}로 빼고, 가방 문서에는
// 이름·미리보기·검색 텍스트(2,000자)·첨부 목록만 남긴다.
//
// 화면 쪽은 거의 그대로 둔다: 열려 있는 가방(useBagDocument)만 그 가방의 notes를 구독해서 editorDoc을 다시 채운다
// (hydrateBag). 저장할 때 본문을 떼어서(splitBagForSave) notes에 쓰고 가방 문서에는 요약만 쓴다(lib/bagsService).
//
// notes 문서: { doc: string(JSON), rev: number, updatedAt: string, updatedBy: string }
// - doc은 Firestore 중첩 깊이 제한(20)을 피하려고 JSON 문자열로 저장한다(lib/editorDocSerialize와 같은 이유)
//
// 옛 데이터 호환: 가방 문서 안에 editorDoc이 그대로 있는 메모(이전 전)는 그대로 읽고, 다음 저장 때 notes로 옮긴다.
// 오프라인 모드(localStorage)는 이 파일을 쓰지 않는다(본문을 가방 안에 그대로 둔다).
// 순수 함수(분리·합치기·요약)는 lib/bagNotesCore.ts.

import { collection, doc, getDocs, deleteDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { parseNoteData, type BagNote } from "@/lib/bagNotesCore";

export function notesCol(bagId: string) {
  return collection(db, "bags", bagId, "notes");
}
export function noteRef(bagId: string, packId: string) {
  return doc(db, "bags", bagId, "notes", packId);
}

/** 가방 하나의 메모 본문들을 실시간 구독. 메모가 없는 가방이면 빈 Map이 한 번 온다 */
export function subscribeBagNotes(
  bagId: string,
  cb: (notes: Map<string, BagNote>) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    notesCol(bagId),
    (snap) => {
      const map = new Map<string, BagNote>();
      snap.docs.forEach((d) => map.set(d.id, parseNoteData(d.data())));
      cb(map);
    },
    onError,
  );
}

/** 가방을 완전히 지우기 전에 본문 문서를 지운다(가방 문서가 먼저 지워지면 규칙의 멤버 확인이 안 돼 못 지운다) */
export async function deleteAllBagNotes(bagId: string): Promise<void> {
  const snap = await getDocs(notesCol(bagId));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
}
