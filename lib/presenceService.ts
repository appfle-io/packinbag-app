import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// 가방을 지금 열어보고 있는 사람들을 표시하기 위한 실시간 접속 정보.
// bags/{bagId}/presence/{uid} 문서로 저장하고, 주기적으로 updatedAt을 갱신(heartbeat)해서
// 죽은 접속(브라우저를 그냥 닫아버린 경우)은 클라이언트에서 오래된 항목으로 판단해 걸러낸다.

const HEARTBEAT_MS = 20000; // 20초마다 살아있다고 갱신
export const PRESENCE_STALE_MS = 45000; // 45초 넘게 갱신 없으면 나간 것으로 간주

function presenceCol(bagId: string) {
  return collection(db, "bags", bagId, "presence");
}

export interface RawPresence {
  uid: string;
  nickname: string;
  avatarId: string;
  updatedAtMs: number;
  // 지금 이 사람이 편집 중인 에디터팩(자유문서형 메모 팩)의 id. 없거나 null이면 지금
  // 어떤 팩도 편집 중이 아님(가방만 열어놓은 상태 포함). 같은 팩을 두 명 이상이 동시에
  // 열어서 덮어쓰는 사고를 막기 위해 배지로 알려주는 용도(PackNoteEditorScreen).
  editingPackId?: string | null;
}

export function subscribeToPresence(
  bagId: string,
  callback: (entries: RawPresence[]) => void
) {
  return onSnapshot(
    presenceCol(bagId),
    (snap) => {
      const entries = snap.docs.map((d) => {
        const data = d.data();
        const ts = data.updatedAt;
        const ms =
          ts && typeof ts.toMillis === "function" ? ts.toMillis() : Date.now();
        return {
          uid: d.id,
          nickname: (data.nickname as string) ?? "",
          avatarId: (data.avatarId as string) ?? "cat",
          updatedAtMs: ms,
          editingPackId: (data.editingPackId as string | null | undefined) ?? null,
        };
      });
      callback(entries);
    },
    () => {
      // 가방이 아직 저장 전이거나 접근 권한이 사라진 경우 등 - 접속자 표시는
      // 부가 기능이라 실패해도 조용히 무시하고 빈 목록으로 처리한다.
      callback([]);
    }
  );
}

// 가방을 여는 동안 호출: 즉시 등록 + 주기적 heartbeat. 반환된 함수를 unmount 시 호출해 정리한다.
export function joinPresence(
  bagId: string,
  uid: string,
  nickname: string,
  avatarId: string
): () => void {
  const ref = doc(presenceCol(bagId), uid);
  const beat = () =>
    setDoc(
      ref,
      { nickname, avatarId, updatedAt: serverTimestamp() },
      { merge: true }
    ).catch(() => {});

  beat();
  const interval = window.setInterval(beat, HEARTBEAT_MS);

  const handleUnload = () => {
    deleteDoc(ref).catch(() => {});
  };
  window.addEventListener("pagehide", handleUnload);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("pagehide", handleUnload);
    deleteDoc(ref).catch(() => {});
  };
}

// 지금 이 사람이 편집 중인 에디터팩(자유문서형 메모 팩) id를 알려준다. packId를 null로
// 넘기면 "지금 아무 메모팩도 편집 중이 아님"으로 지운다. joinPresence로 이미 만들어진
// presence 문서에 merge로 필드 하나만 얹는 방식이라(문서가 아직 없으면 heartbeat가 곧
// nickname/avatarId까지 채워준다), 가방 전체 접속 표시(PresenceBar)와 독립적으로 동작한다.
export function setEditingNotePack(
  bagId: string,
  uid: string,
  packId: string | null
): Promise<void> {
  const ref = doc(presenceCol(bagId), uid);
  return setDoc(ref, { editingPackId: packId, updatedAt: serverTimestamp() }, { merge: true }).catch(
    () => {}
  );
}
